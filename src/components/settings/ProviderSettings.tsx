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
import { Card, CardContent } from "@/components/ui/card";
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
      toast.success("验证码已复制");
    } catch (error) {
      console.error("复制失败:", error);
      toast.error("复制失败");
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
      toast.error("请输入 API Key");
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
        toast.error(`授权失败: ${JSON.stringify(result.error)}`);
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
          instructions: data.instructions || "请在浏览器中完成授权，然后输入授权码",
        };
        
        if (!authorization.url) {
          toast.error("未获取到授权链接");
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
        toast.error(`授权失败: ${JSON.stringify(result.error)}`);
        setOAuthDialog((prev) => ({ ...prev, isSubmitting: false }));
        return;
      }
      
      toast.success(`${oauthDialog.providerName} 授权成功`);
      setOAuthDialog(initialOAuthDialogState);
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
        toast.error(`授权失败: ${JSON.stringify(result.error)}`);
        setOAuthDialog((prev) => ({ ...prev, isSubmitting: false }));
        return;
      }
      
      // 授权成功
      toast.success(`${providerName} 授权成功`);
      setOAuthDialog(initialOAuthDialogState);
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
      toast.success("授权链接已复制到剪贴板");
    } catch (error) {
      console.error("复制失败:", error);
      toast.error("复制失败，请手动复制");
    }
  };

  // 在浏览器中打开授权链接
  const handleOpenInBrowser = async () => {
    if (!oauthDialog.authorization?.url) return;
    
    try {
      await openUrl(oauthDialog.authorization.url);
    } catch (error) {
      console.error("打开浏览器失败:", error);
      toast.error("无法打开浏览器");
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

  // 渲染连接状态 UI（初始化中或连接失败）
  const renderConnectionStatus = () => {
    // 正在初始化/连接中（显示 loading）
    if (isInitializing) {
      // 根据不同阶段显示不同的提示文字
      let loadingMessage = "正在连接到 OpenCode 服务...";
      if (backendStatus === "downloading") {
        loadingMessage = "正在下载 OpenCode...";
      } else if (backendStatus === "starting") {
        loadingMessage = "正在启动 OpenCode 服务...";
      } else if (backendStatus === "uninitialized") {
        loadingMessage = "正在初始化...";
      }
      
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">AI 服务提供商</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              配置 AI 模型服务提供商的 API Key
            </p>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">{loadingMessage}</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    // 连接失败或有错误
    if (hasError || !isConnected) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">AI 服务提供商</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              配置 AI 模型服务提供商的 API Key
            </p>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <p className="mt-3 text-sm text-muted-foreground">
                {errorMessage || "无法连接到 OpenCode 服务"}
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => connect()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                重试连接
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return null;
  };

  // 如果未连接，显示连接状态 UI
  const connectionStatusUI = renderConnectionStatus();
  if (connectionStatusUI) {
    return connectionStatusUI;
  }

  return (
    <div className="space-y-6">
      {/* 标题和刷新按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">AI 服务提供商</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            配置 AI 模型服务提供商的 API Key
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={loadProviders} disabled={isLoadingProviders}>
          <RefreshCw className={cn("h-4 w-4", isLoadingProviders && "animate-spin")} />
        </Button>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索服务商..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Provider 列表 */}
      <div className="space-y-2">
        {isLoadingProviders && providers.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {searchQuery ? "未找到匹配的服务商" : "暂无可用的服务商"}
          </div>
        ) : (
          filteredProviders.map((provider) => {
            const meta = providerMeta[provider.id] || { color: "bg-gray-500/10 text-gray-600", desc: "" };
            const isExpanded = expandedProvider === provider.id;
            const isConnected = isProviderConnected(provider.id);
            const methods = authMethods[provider.id] || [];
            const modelCount = Object.keys(provider.models || {}).length;

            return (
              <div
                key={provider.id}
                className="rounded-lg border bg-card transition-colors"
              >
                {/* 头部 - 紧凑版 */}
                <button
                  onClick={() => toggleExpand(provider.id)}
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
                >
                  {/* 图标 */}
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold",
                    meta.color
                  )}>
                    {provider.name.charAt(0).toUpperCase()}
                  </div>
                  
                  {/* 名称和状态 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{provider.name}</span>
                      {meta.desc && (
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {meta.desc}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{modelCount} 模型</span>
                      {isConnected && (
                        <span className="flex items-center gap-0.5 text-green-500">
                          <Check className="h-3 w-3" />
                          已配置
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 展开图标 */}
                  <ChevronRight className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isExpanded && "rotate-90"
                  )} />
                </button>

                {/* 展开内容 */}
                {isExpanded && (
                  <div className="border-t px-3 py-3 space-y-3">
                    {/* 环境变量提示 */}
                    {provider.env.length > 0 && (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                        环境变量: {provider.env.join(", ")}
                      </p>
                    )}

                    {/* API Key 输入 */}
                    <div className="space-y-2">
                      <Label className="text-xs">API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder={isConnected ? "已配置 (输入新值更新)" : "输入 API Key"}
                          value={apiKeys[provider.id] || ""}
                          onChange={(e) => setApiKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                          className="h-8 text-sm"
                        />
                        <Button
                          size="sm"
                          className="h-8 px-3"
                          onClick={() => handleSaveApiKey(provider.id)}
                          disabled={!apiKeys[provider.id]?.trim() || savingProvider === provider.id}
                        >
                          {savingProvider === provider.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Key className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* OAuth 授权按钮 */}
                    {methods.filter((m) => m.type === "oauth").map((method, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => handleOAuthAuthorize(provider.id, provider.name, index)}
                        disabled={savingProvider === provider.id}
                      >
                        {savingProvider === provider.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {method.label || "OAuth 授权"}
                      </Button>
                    ))}

                    {/* 模型预览 */}
                    {modelCount > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">模型</Label>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(provider.models).slice(0, 6).map(([id, model]) => (
                            <span key={id} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                              {model.name || id}
                            </span>
                          ))}
                          {modelCount > 6 && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
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
          })
        )}
      </div>

      {/* 帮助提示 */}
      <div className="flex items-start gap-2.5 rounded-lg bg-muted/40 p-3">
        <Key className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          访问服务商官网获取 API Key，或使用环境变量配置。部分服务商支持 OAuth 一键授权。
        </p>
      </div>

      {/* OAuth 授权对话框 */}
      <Dialog open={oauthDialog.isOpen} onOpenChange={(open) => !open && handleCloseOAuthDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {oauthDialog.providerName} 授权
            </DialogTitle>
            {oauthDialog.authorization?.method !== "auto" && (
              <DialogDescription>
                请在浏览器中完成授权，然后输入授权码
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* auto 模式：显示设备码/验证码 */}
            {oauthDialog.authorization?.method === "auto" && oauthDialog.authorization?.instructions && (
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  请在浏览器中输入以下验证码
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
                    title="复制验证码"
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
              <Label className="text-sm">授权链接</Label>
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
                  title="复制链接"
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
                在浏览器中打开
              </Button>
            </div>

            {/* code 模式：授权码输入 */}
            {oauthDialog.authorization?.method === "code" && (
              <div className="space-y-2">
                <Label className="text-sm">授权码</Label>
                <Input
                  placeholder="粘贴授权码..."
                  value={oauthDialog.authCode}
                  onChange={(e) => setOAuthDialog((prev) => ({ ...prev, authCode: e.target.value }))}
                  disabled={oauthDialog.isSubmitting}
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">
                  在浏览器完成授权后，复制授权码并粘贴到上方输入框
                </p>
              </div>
            )}

            {/* auto 模式：等待提示 */}
            {oauthDialog.authorization?.method === "auto" && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>等待浏览器授权完成...</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCloseOAuthDialog}
              disabled={oauthDialog.isSubmitting}
            >
              {oauthDialog.authorization?.method === "auto" ? "关闭" : "取消"}
            </Button>
            {oauthDialog.authorization?.method === "code" && (
              <Button
                onClick={handleOAuthCallback}
                disabled={!oauthDialog.authCode.trim() || oauthDialog.isSubmitting}
              >
                {oauthDialog.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    验证中...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    完成授权
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
