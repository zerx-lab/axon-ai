/**
 * AI 渠道商设置组件
 * 用于配置 AI 服务提供商和 API Key
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Key,
  Check,
  Loader2,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Search,
  Copy,
  Globe,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useOpencode } from "@/hooks";

// Provider 类型定义
interface Model {
  id: string;
  name: string;
}

interface Provider {
  id: string;
  name: string;
  env: string[];
  models: Record<string, Model>;
}

interface ProviderAuthMethod {
  type: "oauth" | "api";
  label: string;
}

// OAuth 授权响应类型
interface OAuthAuthorization {
  url: string;
  method: "auto" | "code";
  instructions: string;
}

// OAuth 对话框状态
interface OAuthDialogState {
  isOpen: boolean;
  providerId: string;
  providerName: string;
  methodIndex: number;
  authorization: OAuthAuthorization | null;
  authCode: string;
  isSubmitting: boolean;
}

// Provider 元数据
const providerMeta: Record<string, { color: string; desc: string }> = {
  anthropic: { color: "bg-orange-500/10 text-orange-600", desc: "Claude" },
  openai: { color: "bg-green-500/10 text-green-600", desc: "GPT" },
  google: { color: "bg-blue-500/10 text-blue-600", desc: "Gemini" },
  azure: { color: "bg-sky-500/10 text-sky-600", desc: "Azure OpenAI" },
  groq: { color: "bg-purple-500/10 text-purple-600", desc: "Groq" },
  ollama: { color: "bg-gray-500/10 text-gray-600", desc: "Local" },
  deepseek: { color: "bg-indigo-500/10 text-indigo-600", desc: "DeepSeek" },
  xai: { color: "bg-slate-500/10 text-slate-600", desc: "Grok" },
  bedrock: { color: "bg-amber-500/10 text-amber-600", desc: "AWS" },
  mistral: { color: "bg-rose-500/10 text-rose-600", desc: "Mistral" },
  openrouter: { color: "bg-teal-500/10 text-teal-600", desc: "OpenRouter" },
  together: { color: "bg-cyan-500/10 text-cyan-600", desc: "Together" },
  fireworks: { color: "bg-red-500/10 text-red-600", desc: "Fireworks" },
  perplexity: { color: "bg-violet-500/10 text-violet-600", desc: "Perplexity" },
};

// OAuth 对话框初始状态
const initialOAuthDialogState: OAuthDialogState = {
  isOpen: false,
  providerId: "",
  providerName: "",
  methodIndex: 0,
  authorization: null,
  authCode: "",
  isSubmitting: false,
};

export function ProviderSettings() {
  const { t } = useTranslation();
  const { client, isConnected, state, connect } = useOpencode();
  
  // 从全局状态获取连接状态和后端状态
  const connectionStatus = state.connectionState.status;
  const backendStatus = state.backendStatus.type;
  
  // 判断是否正在加载中（包括后端初始化、下载、启动、连接中）
  const isInitializing = backendStatus === "uninitialized" || 
                         backendStatus === "downloading" || 
                         backendStatus === "starting" ||
                         connectionStatus === "connecting";
  
  // 判断是否有错误（后端错误或连接错误，但排除初始化中的状态）
  const hasError = (connectionStatus === "error" || backendStatus === "error") && !isInitializing;
  const errorMessage = connectionStatus === "error" 
    ? state.connectionState.message 
    : (backendStatus === "error" ? (state.backendStatus as { message: string }).message : null);
  
  const [providers, setProviders] = useState<Provider[]>([]);
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
  const [authMethods, setAuthMethods] = useState<Record<string, ProviderAuthMethod[]>>({});
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // OAuth 对话框状态
  const [oauthDialog, setOAuthDialog] = useState<OAuthDialogState>(initialOAuthDialogState);

  // 从 instructions 中提取验证码
  const extractDeviceCode = (instructions: string): string | null => {
    // 匹配常见的设备码格式：XXXX-XXXX 或 XXXXXXXX
    const match = instructions.match(/[A-Z0-9]{4}-[A-Z0-9]{4}/i) || 
                  instructions.match(/:\s*([A-Z0-9-]{6,12})/i);
    return match ? (match[1] || match[0]).toUpperCase() : null;
  };

  // 复制验证码到剪贴板
  const handleCopyDeviceCode = async () => {
    if (!oauthDialog.authorization?.instructions) return;
    
    const code = extractDeviceCode(oauthDialog.authorization.instructions);
    const textToCopy = code || oauthDialog.authorization.instructions;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success(t("settings.providerSettings.copySuccess"));
    } catch (error) {
      console.error("复制失败:", error);
      toast.error(t("settings.providerSettings.copyFailed"));
    }
  };

  // 过滤后的 Provider 列表
  const filteredProviders = useMemo(() => {
    if (!searchQuery.trim()) return providers;
    const query = searchQuery.toLowerCase();
    return providers.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query) ||
        (providerMeta[p.id]?.desc || "").toLowerCase().includes(query)
    );
  }, [providers, searchQuery]);

  // 加载 Provider 列表
  const loadProviders = useCallback(async () => {
    if (!client || !isConnected) return;
    
    setIsLoadingProviders(true);
    try {
      const providerResult = await client.provider.list();
      if (providerResult.data) {
        const data = providerResult.data as unknown as { 
          all: Provider[]; 
          connected: string[];
        };
        setProviders(data.all || []);
        setConnectedProviders(new Set(data.connected || []));
      }
      
      const authResult = await client.provider.auth();
      if (authResult.data) {
        setAuthMethods(authResult.data as unknown as Record<string, ProviderAuthMethod[]>);
      }
    } catch (error) {
      console.error("加载 Provider 失败:", error);
      toast.error(t("errors.unknownError"));
    } finally {
      setIsLoadingProviders(false);
    }
  }, [client, isConnected, t]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  // 保存 API Key
  const handleSaveApiKey = async (providerId: string) => {
    if (!client) return;
    
    const apiKey = apiKeys[providerId];
    if (!apiKey?.trim()) {
      toast.error(t("settings.providerSettings.enterApiKey"));
      return;
    }
    
    setSavingProvider(providerId);
    try {
      await client.auth.set({
        providerID: providerId,
        auth: { type: "api", key: apiKey.trim() },
      });
      
      toast.success(t("notifications.settingsSaved"));
      setApiKeys((prev) => ({ ...prev, [providerId]: "" }));
      // 刷新 Provider 状态缓存（API Key 保存后 auth.json 已更新，但 Provider.state 有缓存）
      await client.instance.dispose();
      await loadProviders();
    } catch (error) {
      console.error("保存 API Key 失败:", error);
      toast.error(t("errors.unknownError"));
    } finally {
      setSavingProvider(null);
    }
  };

  // OAuth 授权 - 打开对话框
  const handleOAuthAuthorize = async (providerId: string, providerName: string, methodIndex: number = 0) => {
    if (!client) return;
    
    setSavingProvider(providerId);
    try {
      const result = await client.provider.oauth.authorize({
        providerID: providerId,
        method: methodIndex,
      });
      
      if (result.error) {
        console.error("OAuth 授权失败:", result.error);
        toast.error(`${t("settings.providerSettings.authFailed")}: ${JSON.stringify(result.error)}`);
        return;
      }
      
      if (result.data) {
        // 解析授权响应
        const data = result.data as unknown as { 
          url?: string; 
          method?: "auto" | "code";
          instructions?: string;
          authorization?: OAuthAuthorization;
        };
        
        const authorization: OAuthAuthorization = data.authorization || {
          url: data.url || "",
          method: data.method || "code",
          instructions: data.instructions || t("settings.providerSettings.authDialogDescription"),
        };
        
        if (!authorization.url) {
          toast.error(t("settings.providerSettings.noAuthUrl"));
          return;
        }
        
        // 打开对话框显示授权信息
        setOAuthDialog({
          isOpen: true,
          providerId,
          providerName,
          methodIndex,
          authorization,
          authCode: "",
          isSubmitting: false,
        });
        
        // auto 模式：自动打开浏览器并调用 callback（后端阻塞等待授权完成）
        if (authorization.method === "auto") {
          await openUrl(authorization.url);
          // 设置提交状态并调用回调（后端会阻塞直到用户完成授权）
          setOAuthDialog(prev => ({ ...prev, isSubmitting: true }));
          handleAutoOAuthCallback(providerId, providerName, methodIndex);
        }
      }
    } catch (error) {
      console.error("OAuth 授权失败:", error);
      toast.error(t("errors.unknownError"));
    } finally {
      setSavingProvider(null);
    }
  };

  // 处理 OAuth 回调 - 提交授权码 (code 模式)
  const handleOAuthCallback = async () => {
    if (!client || !oauthDialog.authCode.trim()) return;
    
    setOAuthDialog((prev) => ({ ...prev, isSubmitting: true }));
    
    try {
      const result = await client.provider.oauth.callback({
        providerID: oauthDialog.providerId,
        method: oauthDialog.methodIndex,
        code: oauthDialog.authCode.trim(),
      });
      
      if (result.error) {
        console.error("OAuth 回调失败:", result.error);
        toast.error(`${t("settings.providerSettings.authFailed")}: ${JSON.stringify(result.error)}`);
        setOAuthDialog((prev) => ({ ...prev, isSubmitting: false }));
        return;
      }
      
      toast.success(t("settings.providerSettings.authSuccess", { name: oauthDialog.providerName }));
      setOAuthDialog(initialOAuthDialogState);
      // 刷新 Provider 状态缓存（OAuth 成功后 auth.json 已更新，但 Provider.state 有缓存）
      // 参考 OpenCode TUI 的做法：通过 instance.dispose 销毁实例来刷新状态
      await client.instance.dispose();
      await loadProviders();
    } catch (error) {
      console.error("OAuth 回调失败:", error);
      toast.error(t("errors.unknownError"));
      setOAuthDialog((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // 处理 auto 模式 OAuth 回调 - 后端阻塞等待用户完成授权
  const handleAutoOAuthCallback = async (providerId: string, providerName: string, methodIndex: number) => {
    if (!client) return;
    
    try {
      // 调用 callback 时不传 code 参数，后端会阻塞等待用户在浏览器中完成授权
      const result = await client.provider.oauth.callback({
        providerID: providerId,
        method: methodIndex,
      });
      
      if (result.error) {
        console.error("OAuth 授权失败:", result.error);
        toast.error(`${t("settings.providerSettings.authFailed")}: ${JSON.stringify(result.error)}`);
        setOAuthDialog((prev) => ({ ...prev, isSubmitting: false }));
        return;
      }
      
      // 授权成功
      toast.success(t("settings.providerSettings.authSuccess", { name: providerName }));
      setOAuthDialog(initialOAuthDialogState);
      // 刷新 Provider 状态缓存（OAuth 成功后 auth.json 已更新，但 Provider.state 有缓存）
      await client.instance.dispose();
      await loadProviders();
    } catch (error) {
      console.error("OAuth 授权失败:", error);
      toast.error(t("errors.unknownError"));
      setOAuthDialog((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // 复制授权链接到剪贴板
  const handleCopyUrl = async () => {
    if (!oauthDialog.authorization?.url) return;
    
    try {
      await navigator.clipboard.writeText(oauthDialog.authorization.url);
      toast.success(t("settings.providerSettings.authLinkCopied"));
    } catch (error) {
      console.error("复制失败:", error);
      toast.error(t("settings.providerSettings.copyFailed"));
    }
  };

  // 在浏览器中打开授权链接
  const handleOpenInBrowser = async () => {
    if (!oauthDialog.authorization?.url) return;
    
    try {
      await openUrl(oauthDialog.authorization.url);
    } catch (error) {
      console.error("打开浏览器失败:", error);
      toast.error(t("settings.providerSettings.openBrowserFailed"));
    }
  };

  // 关闭 OAuth 对话框
  const handleCloseOAuthDialog = () => {
    if (oauthDialog.isSubmitting) return;
    setOAuthDialog(initialOAuthDialogState);
  };

  const isProviderConnected = (providerId: string) => connectedProviders.has(providerId);
  
  const toggleExpand = (providerId: string) => {
    setExpandedProvider(expandedProvider === providerId ? null : providerId);
  };

  const isContentLoading = isInitializing || isLoadingProviders;

  const getLoadingMessage = () => {
    if (backendStatus === "downloading") return t("settings.providerSettings.downloading");
    if (backendStatus === "starting") return t("settings.providerSettings.starting");
    if (backendStatus === "uninitialized") return t("settings.providerSettings.initializing");
    return t("settings.providerSettings.connecting");
  };

  const renderContent = () => {
    if (isInitializing) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{getLoadingMessage()}</p>
        </div>
      );
    }

    if (hasError || !isConnected) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="mt-3 text-sm text-muted-foreground">
            {errorMessage || t("settings.providerSettings.serviceUnavailable")}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => connect()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("settings.providerSettings.retry")}
          </Button>
        </div>
      );
    }

    if (isLoadingProviders && providers.length === 0) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (filteredProviders.length === 0) {
      return (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {searchQuery ? t("settings.providerSettings.noProvidersFound") : t("settings.providerSettings.noProviders")}
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        {filteredProviders.map((provider) => {
          const meta = providerMeta[provider.id] || { color: "bg-gray-500/10 text-gray-600", desc: "" };
          const isExpanded = expandedProvider === provider.id;
          const isConnected = isProviderConnected(provider.id);
          const methods = authMethods[provider.id] || [];
          const modelCount = Object.keys(provider.models || {}).length;

          return (
            <div
              key={provider.id}
              className="rounded-md border border-border/50 bg-card transition-colors"
            >
              <button
                onClick={() => toggleExpand(provider.id)}
                className="flex w-full items-center gap-2.5 p-2.5 text-left hover:bg-accent/40"
              >
                <div className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                  meta.color
                )}>
                  {provider.name.charAt(0).toUpperCase()}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{provider.name}</span>
                    {meta.desc && (
                      <span className="text-xs text-muted-foreground/60 hidden sm:inline">
                        {meta.desc}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                    <span>{modelCount} {t("settings.providerSettings.models")}</span>
                    {isConnected && (
                      <span className="flex items-center gap-0.5 text-green-500">
                        <Check className="h-2.5 w-2.5" />
                        {t("settings.providerSettings.configured")}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-150",
                  isExpanded && "rotate-90"
                )} />
              </button>

              {isExpanded && (
                <div className="border-t border-border/40 px-2.5 py-2.5 space-y-2.5">
                  {provider.env.length > 0 && (
                    <p className="text-xs text-muted-foreground/70 bg-muted/40 rounded px-2 py-1">
                      {t("settings.providerSettings.envVar")}: {provider.env.join(", ")}
                    </p>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("settings.providerSettings.apiKey")}</Label>
                    <div className="flex gap-1.5">
                      <Input
                        type="password"
                        placeholder={isConnected ? t("settings.providerSettings.apiKeyConfigured") : t("settings.providerSettings.apiKeyPlaceholder")}
                        value={apiKeys[provider.id] || ""}
                        onChange={(e) => setApiKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                        className="h-7 text-xs"
                      />
                      <Button
                        size="sm"
                        className="h-7 px-2.5"
                        onClick={() => handleSaveApiKey(provider.id)}
                        disabled={!apiKeys[provider.id]?.trim() || savingProvider === provider.id}
                      >
                        {savingProvider === provider.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Key className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {methods.filter((m) => m.type === "oauth").map((method, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleOAuthAuthorize(provider.id, provider.name, index)}
                      disabled={savingProvider === provider.id}
                    >
                      {savingProvider === provider.id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <ExternalLink className="mr-1 h-3 w-3" />
                      )}
                      {method.label || t("settings.providerSettings.oauthAuthorize")}
                    </Button>
                  ))}

                  {modelCount > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">{t("settings.providerSettings.models")}</Label>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(provider.models).slice(0, 6).map(([id, model]) => (
                          <span key={id} className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px]">
                            {model.name || id}
                          </span>
                        ))}
                        {modelCount > 6 && (
                          <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            +{modelCount - 6}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">{t("settings.providerSettings.title")}</h2>
          <p className="text-[13px] text-muted-foreground/80">
            {t("settings.providerSettings.description")}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={loadProviders} disabled={isContentLoading} className="h-7 w-7">
          <RefreshCw className={cn("h-3.5 w-3.5", isContentLoading && "animate-spin")} />
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          placeholder={t("settings.providerSettings.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-8 text-[13px]"
          disabled={isContentLoading || hasError}
        />
      </div>

      <div className="min-h-[180px]">
        {renderContent()}
      </div>

      {!isContentLoading && !hasError && (
        <div className="flex items-start gap-2 rounded-md bg-muted/30 p-2.5 border border-border/30">
          <Key className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 mt-0.5" />
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            {t("settings.providerSettings.hint")}
          </p>
        </div>
      )}

      {/* OAuth 授权对话框 */}
      <Dialog open={oauthDialog.isOpen} onOpenChange={(open) => !open && handleCloseOAuthDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t("settings.providerSettings.authDialogTitle", { name: oauthDialog.providerName })}
            </DialogTitle>
            {oauthDialog.authorization?.method !== "auto" && (
              <DialogDescription>
                {t("settings.providerSettings.authDialogDescription")}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* auto 模式：显示设备码/验证码 */}
            {oauthDialog.authorization?.method === "auto" && oauthDialog.authorization?.instructions && (
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  {t("settings.providerSettings.deviceCodeHint")}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-2xl font-mono font-bold tracking-wider text-primary select-all">
                    {extractDeviceCode(oauthDialog.authorization.instructions) || 
                     oauthDialog.authorization.instructions}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleCopyDeviceCode}
                    title={t("settings.providerSettings.copyUrl")}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {oauthDialog.authorization.instructions}
                </p>
              </div>
            )}

            {/* 授权链接 */}
            <div className="space-y-2">
              <Label className="text-sm">{t("settings.providerSettings.authUrl")}</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={oauthDialog.authorization?.url || ""}
                  className="h-9 text-xs font-mono bg-muted"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={handleCopyUrl}
                  title={t("settings.providerSettings.copyUrl")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={handleOpenInBrowser}
              >
                <Globe className="mr-2 h-4 w-4" />
                {t("settings.providerSettings.openInBrowser")}
              </Button>
            </div>

            {/* code 模式：授权码输入 */}
            {oauthDialog.authorization?.method === "code" && (
              <div className="space-y-2">
                <Label className="text-sm">{t("settings.providerSettings.authCode")}</Label>
                <Input
                  placeholder={t("settings.providerSettings.authCodePlaceholder")}
                  value={oauthDialog.authCode}
                  onChange={(e) => setOAuthDialog((prev) => ({ ...prev, authCode: e.target.value }))}
                  disabled={oauthDialog.isSubmitting}
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">
                  {t("settings.providerSettings.authCodeHint")}
                </p>
              </div>
            )}

            {/* auto 模式：等待提示 */}
            {oauthDialog.authorization?.method === "auto" && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t("settings.providerSettings.waitingAuth")}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCloseOAuthDialog}
              disabled={oauthDialog.isSubmitting}
            >
              {oauthDialog.authorization?.method === "auto" ? t("common.close") : t("common.cancel")}
            </Button>
            {oauthDialog.authorization?.method === "code" && (
              <Button
                onClick={handleOAuthCallback}
                disabled={!oauthDialog.authCode.trim() || oauthDialog.isSubmitting}
              >
                {oauthDialog.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("settings.providerSettings.verifying")}
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    {t("settings.providerSettings.completeAuth")}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
