import { useState, useMemo } from "react";
import { ArrowLeft, ChevronDown, ExternalLink, Loader2, CheckCircle2, Info, KeyRound, Link2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useProviderStore } from "@/stores/provider";
import { cn } from "@/lib/utils";
import type { UserProviderConfig, CustomConfig, ProviderAuthMethod, OAuthAuthorization } from "@/types/provider";
import type { OpencodeClient } from "@/services/opencode/types";
import { openUrl } from "@tauri-apps/plugin-opener";

interface StandardProviderFormProps {
  registryId: string;
  onBack: () => void;
  onComplete: () => void;
  editingProvider?: UserProviderConfig | null;
  client?: OpencodeClient | null;
}

// 认证方法选择卡片（仅在新增模式下使用）
function AuthMethodCard({
  method,
  selected,
  onSelect,
  disabled = false,
}: {
  method: ProviderAuthMethod;
  index: number;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const isOAuth = method.type === "oauth";
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 w-full p-3 rounded-lg border text-left transition-all duration-150",
        disabled && "opacity-50 cursor-not-allowed",
        selected
          ? "border-primary bg-primary/5"
          : "border-border/60 hover:border-border hover:bg-accent/50"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded flex items-center justify-center shrink-0",
        selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      )}>
        {isOAuth ? <Link2 className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{method.label}</p>
        <p className="text-xs text-muted-foreground/70">
          {isOAuth ? "通过浏览器授权登录" : "手动输入 API Key"}
        </p>
      </div>
      {selected && (
        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
      )}
    </button>
  );
}

export function StandardProviderForm({
  registryId,
  onBack,
  onComplete,
  editingProvider,
  client,
}: StandardProviderFormProps) {
  const { registry, authMethods, connectedProviders, addProvider, updateProvider, startOAuthAuthorize, completeOAuthCallback } = useProviderStore();
  const entry = registry[registryId];
  const providerAuthMethods = authMethods[registryId] || [];
  
  // 判断是否为编辑模式（有 id 且不为空表示编辑已存在的 provider）
  const isEditMode = !!editingProvider && !!editingProvider.id;

  // 判断是否为"已连接但无本地配置"模式（通过 auth.json 配置但未在 Axon 中添加）
  // 这种情况下应该允许直接编辑高级配置，不需要重新认证
  const isConnectedWithoutLocalConfig = !isEditMode && connectedProviders.has(registryId);

  // 判断该 provider 是否已连接（通过 OpenCode API 返回的状态 或 本地 auth 状态）
  const isAlreadyConnected = connectedProviders.has(registryId) || (
    editingProvider?.auth.type === "api"
      ? !!editingProvider?.auth.key
      : editingProvider?.auth.type === "oauth" || editingProvider?.auth.type === "subscription"
        ? editingProvider?.auth.connected
        : false
  );

  // 判断编辑时是否已有自定义配置
  const hasExistingCustomConfig = useMemo(() => {
    if (!editingProvider?.customConfig) return false;
    const cfg = editingProvider.customConfig;
    return !!(
      cfg.baseURL ||
      cfg.enterpriseUrl ||
      cfg.setCacheKey ||
      cfg.timeout !== undefined ||
      (cfg.headers && Object.keys(cfg.headers).length > 0) ||
      (cfg.whitelist && cfg.whitelist.length > 0) ||
      (cfg.blacklist && cfg.blacklist.length > 0)
    );
  }, [editingProvider]);

  // 当前选择的认证方法索引（仅在新增模式下使用）
  const [selectedAuthMethodIndex, setSelectedAuthMethodIndex] = useState<number>(0);
  
  const selectedAuthMethod = providerAuthMethods[selectedAuthMethodIndex];
  // 新增模式下根据选择决定是否为 OAuth 模式
  // 编辑模式下不涉及授权选择
  const isOAuthMode = !isEditMode && selectedAuthMethod?.type === "oauth";

  // OAuth 授权状态（仅在新增模式下使用）
  const [oauthStatus, setOAuthStatus] = useState<"idle" | "authorizing" | "waiting" | "success" | "error">("idle");
  const [oauthAuthorization, setOAuthAuthorization] = useState<OAuthAuthorization | null>(null);
  const [oauthCode, setOAuthCode] = useState("");
  const [oauthErrorMessage, setOAuthErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: editingProvider?.name || entry?.name || "",
    apiKey: "", // API Key 总是空的，用户需要重新输入才会更新
    useCustomConfig: hasExistingCustomConfig,
    customBaseURL: editingProvider?.customConfig?.baseURL || "",
    customHeaders: editingProvider?.customConfig?.headers || {},
    enterpriseUrl: editingProvider?.customConfig?.enterpriseUrl || "",
    setCacheKey: editingProvider?.customConfig?.setCacheKey || false,
    timeout: editingProvider?.customConfig?.timeout?.toString() || "300000",
    whitelist: editingProvider?.customConfig?.whitelist?.join(", ") || "",
    blacklist: editingProvider?.customConfig?.blacklist?.join(", ") || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 用于管理 headers 的新增/编辑状态
  const [newHeaderKey, setNewHeaderKey] = useState("");
  const [newHeaderValue, setNewHeaderValue] = useState("");

  // 启动 OAuth 授权（仅新增模式）
  const handleStartOAuth = async () => {
    if (!client || !selectedAuthMethod) return;
    
    setOAuthStatus("authorizing");
    setOAuthErrorMessage(null);
    try {
      const authorization = await startOAuthAuthorize(client, registryId, selectedAuthMethodIndex);
      if (authorization) {
        setOAuthAuthorization(authorization);
        setOAuthStatus("waiting");
        
        // 打开浏览器授权页面
        await openUrl(authorization.url);
        
        // 如果是自动模式（如 GitHub Copilot Device Flow），调用 callback 等待授权完成
        if (authorization.method === "auto") {
          try {
            const success = await completeOAuthCallback(client, registryId, selectedAuthMethodIndex);
            if (success) {
              setOAuthStatus("success");
            } else {
              setOAuthStatus("error");
              setOAuthErrorMessage("授权失败，请重试");
            }
          } catch (error) {
            console.error("OAuth callback 失败:", error);
            setOAuthStatus("error");
            setOAuthErrorMessage(String(error));
          }
        }
      } else {
        setOAuthStatus("error");
        setOAuthErrorMessage("启动授权失败，请检查 OpenCode 服务状态");
      }
    } catch (error) {
      console.error("OAuth 授权失败:", error);
      setOAuthStatus("error");
      setOAuthErrorMessage(String(error));
    }
  };

  // 处理手动输入授权码（仅新增模式）
  const handleSubmitOAuthCode = async () => {
    if (!client || !oauthCode.trim()) return;
    
    setOAuthStatus("authorizing");
    try {
      const success = await completeOAuthCallback(client, registryId, selectedAuthMethodIndex, oauthCode.trim());
      if (success) {
        setOAuthStatus("success");
      } else {
        setOAuthStatus("error");
      }
    } catch (error) {
      console.error("OAuth 授权码验证失败:", error);
      setOAuthStatus("error");
    }
  };

  const handleSubmit = async () => {
    // ==================== 编辑模式 ====================
    // 编辑模式下只保存配置，不涉及授权
    if (isEditMode && editingProvider) {
      setIsSubmitting(true);
      try {
        // 解析 whitelist 和 blacklist
        const parseListInput = (input: string): string[] | undefined => {
          const items = input.split(",").map(s => s.trim()).filter(Boolean);
          return items.length > 0 ? items : undefined;
        };

        const customConfig: CustomConfig | undefined = formData.useCustomConfig
          ? {
              baseURL: formData.customBaseURL || undefined,
              headers: Object.keys(formData.customHeaders).length > 0 ? formData.customHeaders : undefined,
              enterpriseUrl: formData.enterpriseUrl || undefined,
              setCacheKey: formData.setCacheKey || undefined,
              timeout: formData.timeout === "false" ? false : (parseInt(formData.timeout) || undefined),
              whitelist: parseListInput(formData.whitelist),
              blacklist: parseListInput(formData.blacklist),
            }
          : undefined;

        // 编辑模式下只更新 name 和 customConfig，不修改 auth
        await updateProvider(editingProvider.id, {
          name: formData.name,
          customConfig,
        }, client || undefined);

        onComplete();
      } catch (error) {
        console.error("更新服务商失败:", error);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 解析 whitelist 和 blacklist 的辅助函数
    const parseListInput = (input: string): string[] | undefined => {
      const items = input.split(",").map(s => s.trim()).filter(Boolean);
      return items.length > 0 ? items : undefined;
    };

    // ==================== 已连接但无本地配置模式 ====================
    // 这种情况下不需要认证，只需要创建本地配置记录并同步高级配置
    if (isConnectedWithoutLocalConfig) {
      setIsSubmitting(true);
      try {
        const customConfig: CustomConfig | undefined = formData.useCustomConfig
          ? {
              baseURL: formData.customBaseURL || undefined,
              headers: Object.keys(formData.customHeaders).length > 0 ? formData.customHeaders : undefined,
              enterpriseUrl: formData.enterpriseUrl || undefined,
              setCacheKey: formData.setCacheKey || undefined,
              timeout: formData.timeout === "false" ? false : (parseInt(formData.timeout) || undefined),
              whitelist: parseListInput(formData.whitelist),
              blacklist: parseListInput(formData.blacklist),
            }
          : undefined;

        // 创建本地配置记录（auth 标记为已连接的 oauth 类型，因为凭证已在 auth.json 中）
        await addProvider({
          registryId,
          name: formData.name,
          auth: { type: "oauth", connected: true, method: 0 },
          customConfig,
        }, client || undefined);

        onComplete();
      } catch (error) {
        console.error("保存配置失败:", error);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // ==================== 新增模式（未连接） ====================

    // OAuth 模式
    if (isOAuthMode) {
      // 如果还没有授权成功，开始 OAuth 授权流程
      if (oauthStatus !== "success") {
        await handleStartOAuth();
        return;
      }

      // OAuth 已授权成功，保存配置
      setIsSubmitting(true);
      try {
        const customConfig: CustomConfig | undefined = formData.useCustomConfig
          ? {
              baseURL: formData.customBaseURL || undefined,
              headers: Object.keys(formData.customHeaders).length > 0 ? formData.customHeaders : undefined,
              enterpriseUrl: formData.enterpriseUrl || undefined,
              setCacheKey: formData.setCacheKey || undefined,
              timeout: formData.timeout === "false" ? false : (parseInt(formData.timeout) || undefined),
              whitelist: parseListInput(formData.whitelist),
              blacklist: parseListInput(formData.blacklist),
            }
          : undefined;

        await addProvider({
          registryId,
          name: formData.name,
          auth: { type: "oauth", connected: true, method: selectedAuthMethodIndex },
          customConfig,
        }, client || undefined);

        onComplete();
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // API Key 模式
    if (!formData.apiKey.trim()) {
      alert("请输入 API Key");
      return;
    }

    setIsSubmitting(true);
    try {
      const customConfig: CustomConfig | undefined = formData.useCustomConfig
        ? {
            baseURL: formData.customBaseURL || undefined,
            headers: Object.keys(formData.customHeaders).length > 0 ? formData.customHeaders : undefined,
            enterpriseUrl: formData.enterpriseUrl || undefined,
            setCacheKey: formData.setCacheKey || undefined,
            timeout: formData.timeout === "false" ? false : (parseInt(formData.timeout) || undefined),
            whitelist: parseListInput(formData.whitelist),
            blacklist: parseListInput(formData.blacklist),
          }
        : undefined;

      await addProvider({
        registryId,
        name: formData.name,
        auth: {
          type: "api",
          key: formData.apiKey.trim(),
        },
        customConfig,
      }, client || undefined);

      onComplete();
    } catch (error) {
      console.error("添加服务商失败:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!entry) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        未找到服务商信息
      </div>
    );
  }

  // 渲染编辑模式下的连接状态提示
  const renderEditModeStatus = () => {
    if (isAlreadyConnected) {
      return (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">已连接</p>
            <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-0.5">
              该服务商已配置凭证。如需修改凭证，请先退出登录后重新添加。
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">未连接</p>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
            该服务商当前没有有效凭证。如需添加凭证，请删除此配置后重新添加。
          </p>
        </div>
      </div>
    );
  };

  // 渲染 OAuth 授权状态（仅在新增模式下使用）
  const renderOAuthStatus = () => {
    if (oauthStatus === "success") {
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">已授权</p>
              <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-0.5">
                已成功连接到 {entry.name}，点击下方"添加"按钮完成配置。
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartOAuth}
            className="w-full"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            重新授权
          </Button>
        </div>
      );
    }

    if (oauthStatus === "waiting" && oauthAuthorization) {
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400">等待授权中...</p>
              <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-0.5">
                {oauthAuthorization.instructions || "请在浏览器中完成授权"}
              </p>
            </div>
          </div>
          
          {oauthAuthorization.method === "code" && (
            <div className="space-y-2">
              <Label className="text-xs">授权码</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="请输入授权码"
                  value={oauthCode}
                  onChange={(e) => setOAuthCode(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSubmitOAuthCode} 
                  disabled={!oauthCode.trim()}
                  size="sm"
                >
                  验证
                </Button>
              </div>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => openUrl(oauthAuthorization.url)}
            className="w-full"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            重新打开授权页面
          </Button>
        </div>
      );
    }

    if (oauthStatus === "error") {
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <Info className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">授权失败</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                {oauthErrorMessage || "请重试或使用 API Key 方式进行认证"}
              </p>
            </div>
          </div>
          {oauthErrorMessage?.includes("端口") && (
            <div className="text-xs text-muted-foreground/70 p-2 rounded bg-muted/50">
              <p className="font-medium mb-1">解决方法:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>检查是否有其他程序占用端口 1455</li>
                <li>关闭占用该端口的程序</li>
                <li>或者使用 API Key 方式进行认证</li>
              </ol>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleStartOAuth} className="flex-1">
              重试
            </Button>
            {providerAuthMethods.some(m => m.type === "api") && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  const apiIndex = providerAuthMethods.findIndex(m => m.type === "api");
                  if (apiIndex >= 0) {
                    setSelectedAuthMethodIndex(apiIndex);
                    setOAuthStatus("idle");
                    setOAuthErrorMessage(null);
                  }
                }}
                className="flex-1"
              >
                使用 API Key
              </Button>
            )}
          </div>
        </div>
      );
    }

    // 默认状态 - 显示授权按钮
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground/70">
          点击下方按钮将打开浏览器进行授权，完成后自动返回应用。
        </p>
        <Button
          onClick={handleStartOAuth}
          disabled={oauthStatus === "authorizing"}
          className="w-full"
        >
          {oauthStatus === "authorizing" ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              正在启动授权...
            </>
          ) : (
            <>
              <ExternalLink className="w-4 h-4 mr-2" />
              通过浏览器授权
            </>
          )}
        </Button>
      </div>
    );
  };

  return (
    <>
      <DialogHeader className="flex-row items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <DialogTitle>{(isEditMode || isConnectedWithoutLocalConfig) ? "编辑" : "配置"} {entry.name}</DialogTitle>
          <DialogDescription>
            {entry.id}
            {editingProvider && !editingProvider.id && !isConnectedWithoutLocalConfig && " • 将创建本地配置"}
          </DialogDescription>
        </div>
      </DialogHeader>

      <div className="space-y-4 overflow-y-auto flex-1 py-2">
        <div>
          <Label>显示名称</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={entry.name}
          />
        </div>

        {/* ==================== 编辑模式 或 已连接但无本地配置 ==================== */}
        {(isEditMode || isConnectedWithoutLocalConfig) && (
          <div className="space-y-2">
            <Label>连接状态</Label>
            {renderEditModeStatus()}
          </div>
        )}

        {/* ==================== 新增模式（未连接） ==================== */}
        {!isEditMode && !isConnectedWithoutLocalConfig && (
          <>
            {/* 认证方式选择 - 只有当有多种认证方式时显示 */}
            {providerAuthMethods.length > 1 && (
              <div className="space-y-2">
                <Label>认证方式</Label>
                <div className="grid gap-2">
                  {providerAuthMethods.map((method, index) => (
                    <AuthMethodCard
                      key={index}
                      method={method}
                      index={index}
                      selected={selectedAuthMethodIndex === index}
                      onSelect={() => {
                        setSelectedAuthMethodIndex(index);
                        setOAuthStatus("idle");
                        setOAuthAuthorization(null);
                        setOAuthCode("");
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 根据认证方式显示不同的配置项 */}
            {isOAuthMode ? (
              <div className="space-y-2">
                <Label>OAuth 授权</Label>
                {renderOAuthStatus()}
              </div>
            ) : (
              <div>
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder={`请输入 ${entry.env[0] || "API Key"}`}
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                />
                <p className="text-xs text-muted-foreground/70 mt-1.5">
                  请前往服务商官网获取 API Key
                </p>
              </div>
            )}
          </>
        )}

        <Collapsible
          open={formData.useCustomConfig}
          onOpenChange={(open) =>
            setFormData({ ...formData, useCustomConfig: open })
          }
        >
          <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground/70 hover:text-foreground transition-colors">
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                formData.useCustomConfig ? "rotate-180" : ""
              }`}
            />
            高级配置
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            <div>
              <Label>自定义 Base URL</Label>
              <Input
                placeholder={entry.api || "https://api.example.com"}
                value={formData.customBaseURL}
                onChange={(e) =>
                  setFormData({ ...formData, customBaseURL: e.target.value })
                }
              />
              {entry.api && (
                <p className="text-xs text-muted-foreground/70 mt-1.5">
                  默认: {entry.api}
                </p>
              )}
            </div>

            {entry.id === "github-copilot" && (
              <div>
                <Label>Enterprise URL</Label>
                <Input
                  placeholder="https://github.company.com"
                  value={formData.enterpriseUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, enterpriseUrl: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground/70 mt-1.5">
                  GitHub Enterprise 服务器地址
                </p>
              </div>
            )}

            <div>
              <Label>请求超时 (毫秒)</Label>
              <Input
                placeholder="300000"
                value={formData.timeout}
                onChange={(e) =>
                  setFormData({ ...formData, timeout: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground/70 mt-1.5">
                默认 300000 (5分钟)，输入 "false" 禁用超时
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="setCacheKey"
                checked={formData.setCacheKey}
                onChange={(e) =>
                  setFormData({ ...formData, setCacheKey: e.target.checked })
                }
                className="w-4 h-4"
              />
              <Label htmlFor="setCacheKey" className="cursor-pointer">
                启用 Prompt Cache Key (promptCacheKey)
              </Label>
            </div>

            {/* 自定义 Headers */}
            <div className="space-y-2">
              <Label>自定义 Headers</Label>
              <div className="space-y-2">
                {Object.entries(formData.customHeaders).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Input value={key} disabled className="flex-1 bg-muted/50" />
                    <Input value={value} disabled className="flex-1 bg-muted/50" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        const newHeaders = { ...formData.customHeaders };
                        delete newHeaders[key];
                        setFormData({ ...formData, customHeaders: newHeaders });
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Header 名称"
                    value={newHeaderKey}
                    onChange={(e) => setNewHeaderKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newHeaderKey.trim()) {
                        e.preventDefault();
                        setFormData({
                          ...formData,
                          customHeaders: {
                            ...formData.customHeaders,
                            [newHeaderKey.trim()]: newHeaderValue,
                          },
                        });
                        setNewHeaderKey("");
                        setNewHeaderValue("");
                      }
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Header 值"
                    value={newHeaderValue}
                    onChange={(e) => setNewHeaderValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newHeaderKey.trim()) {
                        e.preventDefault();
                        setFormData({
                          ...formData,
                          customHeaders: {
                            ...formData.customHeaders,
                            [newHeaderKey.trim()]: newHeaderValue,
                          },
                        });
                        setNewHeaderKey("");
                        setNewHeaderValue("");
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={!newHeaderKey.trim()}
                    onClick={() => {
                      if (newHeaderKey.trim()) {
                        setFormData({
                          ...formData,
                          customHeaders: {
                            ...formData.customHeaders,
                            [newHeaderKey.trim()]: newHeaderValue,
                          },
                        });
                        setNewHeaderKey("");
                        setNewHeaderValue("");
                      }
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/70">
                输入后按回车或点击 + 按钮添加自定义请求头
              </p>
            </div>

            {/* 模型过滤 */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <p className="text-sm font-medium text-muted-foreground">模型过滤</p>

              <div>
                <Label>模型白名单</Label>
                <Input
                  placeholder="model-1, model-2, ..."
                  value={formData.whitelist}
                  onChange={(e) =>
                    setFormData({ ...formData, whitelist: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground/70 mt-1.5">
                  只显示这些模型（用逗号分隔）
                </p>
              </div>

              <div>
                <Label>模型黑名单</Label>
                <Input
                  placeholder="model-1, model-2, ..."
                  value={formData.blacklist}
                  onChange={(e) =>
                    setFormData({ ...formData, blacklist: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground/70 mt-1.5">
                  隐藏这些模型（用逗号分隔）
                </p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onBack}>
          返回
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || (!isEditMode && !isConnectedWithoutLocalConfig && isOAuthMode && (oauthStatus === "authorizing" || oauthStatus === "waiting"))}
        >
          {isSubmitting ? "保存中..." :
           (isEditMode || isConnectedWithoutLocalConfig) ? "保存" :
           // 新增模式：OAuth 未授权时显示"开始授权"
           (isOAuthMode && oauthStatus !== "success") ? "开始授权" : "添加"}
        </Button>
      </DialogFooter>
    </>
  );
}
