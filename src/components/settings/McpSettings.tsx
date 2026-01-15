/**
 * MCP 服务器设置组件
 * 用于查看和编辑 Model Context Protocol (MCP) 服务器配置
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Server,
  Cloud,
  Check,
  X,
  Loader2,
  RefreshCw,
  Plus,
  Link,
  Unlink,
  AlertCircle,
  ChevronRight,
  Search,
  Settings2,
  Lock,
  Terminal,
  Pencil,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useOpencode } from "@/hooks";
import { useServiceStore } from "@/stores/service";

// MCP 状态类型定义
type McpStatus =
  | { status: "connected" }
  | { status: "disabled" }
  | { status: "failed"; error: string }
  | { status: "needs_auth" }
  | { status: "needs_client_registration"; error: string };

// MCP 本地配置类型
interface McpLocalConfig {
  type: "local";
  command: string[];
  environment?: Record<string, string>;
  enabled?: boolean;
  timeout?: number;
}

// MCP 远程配置类型
interface McpRemoteConfig {
  type: "remote";
  url: string;
  enabled?: boolean;
  headers?: Record<string, string>;
  oauth?: { clientId?: string; clientSecret?: string; scope?: string } | false;
  timeout?: number;
}

type McpConfig = McpLocalConfig | McpRemoteConfig;

// 添加 MCP 对话框状态
interface AddMcpDialogState {
  isOpen: boolean;
  name: string;
  type: "local" | "remote";
  command: string;
  environment: string;
  url: string;
  headers: string;
  enabled: boolean;
  timeout: string;
  isSubmitting: boolean;
}

const initialAddDialogState: AddMcpDialogState = {
  isOpen: false,
  name: "",
  type: "local",
  command: "",
  environment: "",
  url: "",
  headers: "",
  enabled: true,
  timeout: "5000",
  isSubmitting: false,
};

// 编辑 MCP 对话框状态
interface EditMcpDialogState {
  isOpen: boolean;
  originalName: string;
  name: string;
  type: "local" | "remote";
  command: string;
  environment: string;
  url: string;
  headers: string;
  enabled: boolean;
  timeout: string;
  isSubmitting: boolean;
}

const initialEditDialogState: EditMcpDialogState = {
  isOpen: false,
  originalName: "",
  name: "",
  type: "local",
  command: "",
  environment: "",
  url: "",
  headers: "",
  enabled: true,
  timeout: "5000",
  isSubmitting: false,
};

// MCP 配置缓存（用于编辑时获取原始配置）
interface McpConfigCache {
  [name: string]: McpConfig;
}

export function McpSettings() {
  const { t } = useTranslation();
  const { client, isConnected, state, connect } = useOpencode();

  // 使用 ServiceStore 的统一重启方法
  const restart = useServiceStore(s => s.restart);
  const isRestarting = useServiceStore(s => s.isRestarting);

  // 从全局状态获取连接状态和后端状态
  const connectionStatus = state.connectionState.status;
  const backendStatus = state.backendStatus.type;

  // 判断是否正在加载中
  const isInitializing =
    backendStatus === "uninitialized" ||
    backendStatus === "downloading" ||
    backendStatus === "starting" ||
    connectionStatus === "connecting";

  // 判断是否有错误
  const hasError =
    (connectionStatus === "error" || backendStatus === "error") &&
    !isInitializing;
  const errorMessage =
    connectionStatus === "error"
      ? state.connectionState.message
      : backendStatus === "error"
        ? (state.backendStatus as { message: string }).message
        : null;

  const [mcpServers, setMcpServers] = useState<Record<string, McpStatus>>({});
  const [mcpConfigs, setMcpConfigs] = useState<McpConfigCache>({});
  const [isLoading, setIsLoading] = useState(false);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialog, setAddDialog] = useState<AddMcpDialogState>(initialAddDialogState);
  const [editDialog, setEditDialog] = useState<EditMcpDialogState>(initialEditDialogState);
  const [connectingServer, setConnectingServer] = useState<string | null>(null);

  // 过滤后的 MCP 服务器列表
  const filteredServers = useMemo(() => {
    const entries = Object.entries(mcpServers);
    if (!searchQuery.trim()) return entries;
    const query = searchQuery.toLowerCase();
    return entries.filter(([name]) => name.toLowerCase().includes(query));
  }, [mcpServers, searchQuery]);

  // 加载 MCP 服务器状态
  const loadMcpStatus = useCallback(async () => {
    if (!client || !isConnected) return;

    setIsLoading(true);
    try {
      // 同时获取状态和配置
      const [statusResult, configResult] = await Promise.all([
        client.mcp.status(),
        client.config.get(),
      ]);
      
      if (statusResult.data) {
        setMcpServers(statusResult.data as unknown as Record<string, McpStatus>);
      }
      
      // 提取 MCP 配置
      if (configResult.data) {
        const config = configResult.data as unknown as { mcp?: Record<string, McpConfig> };
        if (config.mcp) {
          setMcpConfigs(config.mcp);
        }
      }
    } catch (error) {
      console.error("加载 MCP 状态失败:", error);
      toast.error(t("errors.unknownError"));
    } finally {
      setIsLoading(false);
    }
  }, [client, isConnected, t]);

  // 刷新 MCP 服务器状态（使用统一的 ServiceStore.restart）
  // 重启服务会清除所有缓存，重启后 ServiceStore 会自动刷新 MCP 状态
  const refreshMcpStatus = useCallback(async () => {
    if (!client || !isConnected || isRestarting) return;

    try {
      // 使用统一的重启方法，重启后 ServiceStore 会自动刷新数据
      await restart({ reason: t("settings.mcpSettings.refreshing") });

      // 重启后，ServiceStore 会刷新全局的 mcpServers 状态
      // 但本地组件状态也需要同步更新
      await loadMcpStatus();

      toast.success(t("settings.mcpSettings.refreshSuccess"));
    } catch (error) {
      console.error("刷新 MCP 状态失败:", error);
      toast.error(t("errors.unknownError"));
    }
  }, [client, isConnected, isRestarting, restart, loadMcpStatus, t]);

  useEffect(() => {
    loadMcpStatus();
  }, [loadMcpStatus]);

  // 连接 MCP 服务器
  const handleConnect = async (name: string) => {
    if (!client) return;

    setConnectingServer(name);
    try {
      await client.mcp.connect({ name });
      toast.success(t("settings.mcpSettings.connectSuccess", { name }));
      await loadMcpStatus();
    } catch (error) {
      console.error("连接 MCP 服务器失败:", error);
      toast.error(t("settings.mcpSettings.connectFailed", { name }));
    } finally {
      setConnectingServer(null);
    }
  };

  // 断开 MCP 服务器
  const handleDisconnect = async (name: string) => {
    if (!client) return;

    setConnectingServer(name);
    try {
      await client.mcp.disconnect({ name });
      toast.success(t("settings.mcpSettings.disconnectSuccess", { name }));
      await loadMcpStatus();
    } catch (error) {
      console.error("断开 MCP 服务器失败:", error);
      toast.error(t("settings.mcpSettings.disconnectFailed", { name }));
    } finally {
      setConnectingServer(null);
    }
  };

  // 添加 MCP 服务器
  const handleAddMcp = async () => {
    if (!client || !addDialog.name.trim()) return;

    setAddDialog((prev) => ({ ...prev, isSubmitting: true }));
    try {
      let config: McpConfig;

      if (addDialog.type === "local") {
        // 解析命令数组
        const command = addDialog.command
          .split(/\s+/)
          .filter((s) => s.trim());
        if (command.length === 0) {
          toast.error(t("settings.mcpSettings.commandRequired"));
          setAddDialog((prev) => ({ ...prev, isSubmitting: false }));
          return;
        }

        // 解析环境变量
        let environment: Record<string, string> | undefined;
        if (addDialog.environment.trim()) {
          try {
            environment = JSON.parse(addDialog.environment);
          } catch {
            toast.error(t("settings.mcpSettings.invalidEnvFormat"));
            setAddDialog((prev) => ({ ...prev, isSubmitting: false }));
            return;
          }
        }

        config = {
          type: "local",
          command,
          environment,
          enabled: addDialog.enabled,
          timeout: addDialog.timeout ? parseInt(addDialog.timeout) : undefined,
        };
      } else {
        if (!addDialog.url.trim()) {
          toast.error(t("settings.mcpSettings.urlRequired"));
          setAddDialog((prev) => ({ ...prev, isSubmitting: false }));
          return;
        }

        // 解析请求头
        let headers: Record<string, string> | undefined;
        if (addDialog.headers.trim()) {
          try {
            headers = JSON.parse(addDialog.headers);
          } catch {
            toast.error(t("settings.mcpSettings.invalidHeadersFormat"));
            setAddDialog((prev) => ({ ...prev, isSubmitting: false }));
            return;
          }
        }

        config = {
          type: "remote",
          url: addDialog.url.trim(),
          headers,
          enabled: addDialog.enabled,
          timeout: addDialog.timeout ? parseInt(addDialog.timeout) : undefined,
        };
      }

      const mcpName = addDialog.name.trim();
      
      // 使用 config.update 持久化 MCP 配置到配置文件
      // POST /mcp 只是运行时添加，重启后会丢失
      await client.config.update({
        config: {
          mcp: {
            [mcpName]: config,
          },
        },
      });

      toast.success(t("settings.mcpSettings.addSuccess", { name: mcpName }));
      setAddDialog(initialAddDialogState);
      // 刷新 MCP 状态缓存（config.update 更新配置文件后，MCP.state 有缓存需要刷新）
      await client.instance.dispose();
      await loadMcpStatus();
    } catch (error) {
      console.error("添加 MCP 服务器失败:", error);
      toast.error(t("errors.unknownError"));
    } finally {
      setAddDialog((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // 打开编辑对话框
  const handleOpenEditDialog = (name: string) => {
    const config = mcpConfigs[name];
    if (!config) {
      toast.error(t("errors.unknownError"));
      return;
    }

    if (config.type === "local") {
      setEditDialog({
        isOpen: true,
        originalName: name,
        name,
        type: "local",
        command: config.command.join(" "),
        environment: config.environment ? JSON.stringify(config.environment, null, 2) : "",
        url: "",
        headers: "",
        enabled: config.enabled !== false,
        timeout: config.timeout?.toString() || "5000",
        isSubmitting: false,
      });
    } else {
      setEditDialog({
        isOpen: true,
        originalName: name,
        name,
        type: "remote",
        command: "",
        environment: "",
        url: config.url,
        headers: config.headers ? JSON.stringify(config.headers, null, 2) : "",
        enabled: config.enabled !== false,
        timeout: config.timeout?.toString() || "5000",
        isSubmitting: false,
      });
    }
  };

  // 保存编辑的 MCP 服务器
  const handleSaveEdit = async () => {
    if (!client || !editDialog.name.trim()) return;

    setEditDialog((prev) => ({ ...prev, isSubmitting: true }));
    try {
      let config: McpConfig;

      if (editDialog.type === "local") {
        const command = editDialog.command
          .split(/\s+/)
          .filter((s) => s.trim());
        if (command.length === 0) {
          toast.error(t("settings.mcpSettings.commandRequired"));
          setEditDialog((prev) => ({ ...prev, isSubmitting: false }));
          return;
        }

        let environment: Record<string, string> | undefined;
        if (editDialog.environment.trim()) {
          try {
            environment = JSON.parse(editDialog.environment);
          } catch {
            toast.error(t("settings.mcpSettings.invalidEnvFormat"));
            setEditDialog((prev) => ({ ...prev, isSubmitting: false }));
            return;
          }
        }

        config = {
          type: "local",
          command,
          environment,
          enabled: editDialog.enabled,
          timeout: editDialog.timeout ? parseInt(editDialog.timeout) : undefined,
        };
      } else {
        if (!editDialog.url.trim()) {
          toast.error(t("settings.mcpSettings.urlRequired"));
          setEditDialog((prev) => ({ ...prev, isSubmitting: false }));
          return;
        }

        // 解析请求头
        let headers: Record<string, string> | undefined;
        if (editDialog.headers.trim()) {
          try {
            headers = JSON.parse(editDialog.headers);
          } catch {
            toast.error(t("settings.mcpSettings.invalidHeadersFormat"));
            setEditDialog((prev) => ({ ...prev, isSubmitting: false }));
            return;
          }
        }

        config = {
          type: "remote",
          url: editDialog.url.trim(),
          headers,
          enabled: editDialog.enabled,
          timeout: editDialog.timeout ? parseInt(editDialog.timeout) : undefined,
        };
      }

      const mcpName = editDialog.name.trim();
      
      // 使用 config.update 持久化 MCP 配置到配置文件
      await client.config.update({
        config: {
          mcp: {
            [mcpName]: config,
          },
        },
      });

      toast.success(t("settings.mcpSettings.editSuccess", { name: mcpName }));
      setEditDialog(initialEditDialogState);
      // 刷新 MCP 状态缓存（config.update 更新配置文件后，MCP.state 有缓存需要刷新）
      await client.instance.dispose();
      await loadMcpStatus();
    } catch (error) {
      console.error("编辑 MCP 服务器失败:", error);
      toast.error(t("errors.unknownError"));
    } finally {
      setEditDialog((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // 获取状态显示信息
  const getStatusInfo = (status: McpStatus) => {
    switch (status.status) {
      case "connected":
        return {
          icon: <Check className="h-3.5 w-3.5" />,
          text: t("settings.mcpSettings.statusConnected"),
          color: "text-green-500",
          bgColor: "bg-green-500/10",
        };
      case "disabled":
        return {
          icon: <X className="h-3.5 w-3.5" />,
          text: t("settings.mcpSettings.statusDisabled"),
          color: "text-muted-foreground",
          bgColor: "bg-muted",
        };
      case "failed":
        return {
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          text: t("settings.mcpSettings.statusFailed"),
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          error: status.error,
        };
      case "needs_auth":
        return {
          icon: <Lock className="h-3.5 w-3.5" />,
          text: t("settings.mcpSettings.statusNeedsAuth"),
          color: "text-yellow-500",
          bgColor: "bg-yellow-500/10",
        };
      case "needs_client_registration":
        return {
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          text: t("settings.mcpSettings.statusNeedsRegistration"),
          color: "text-orange-500",
          bgColor: "bg-orange-500/10",
          error: status.error,
        };
      default:
        return {
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          text: t("settings.mcpSettings.statusUnknown"),
          color: "text-muted-foreground",
          bgColor: "bg-muted",
        };
    }
  };

  const isContentLoading = isInitializing || isLoading;

  const getLoadingMessage = () => {
    if (backendStatus === "downloading") return t("settings.mcpSettings.downloading");
    if (backendStatus === "starting") return t("settings.mcpSettings.starting");
    if (backendStatus === "uninitialized") return t("settings.mcpSettings.initializing");
    return t("settings.mcpSettings.connecting");
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
            {errorMessage || t("settings.mcpSettings.serviceUnavailable")}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => connect()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("settings.mcpSettings.retry")}
          </Button>
        </div>
      );
    }

    if (isLoading && Object.keys(mcpServers).length === 0) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (filteredServers.length === 0) {
      return (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {searchQuery
            ? t("settings.mcpSettings.noServersFound")
            : t("settings.mcpSettings.noServers")}
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        {filteredServers.map(([name, status]) => {
          const statusInfo = getStatusInfo(status);
          const isExpanded = expandedServer === name;
          const isConnecting = connectingServer === name;

          return (
            <div key={name} className="rounded-md border border-border/50 bg-card transition-colors">
              <button
                onClick={() => setExpandedServer(isExpanded ? null : name)}
                className="flex w-full items-center gap-2.5 p-2.5 text-left hover:bg-accent/40"
              >
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                    statusInfo.bgColor,
                    statusInfo.color
                  )}
                >
                  {status.status === "connected" ? (
                    <Server className="h-3.5 w-3.5" />
                  ) : (
                    <Cloud className="h-3.5 w-3.5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium",
                        statusInfo.bgColor,
                        statusInfo.color
                      )}
                    >
                      {statusInfo.icon}
                      <span>{statusInfo.text}</span>
                    </span>
                  </div>
                </div>

                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-150",
                    isExpanded && "rotate-90"
                  )}
                />
              </button>

              {isExpanded && (
                <div className="border-t border-border/40 px-2.5 py-2.5 space-y-2.5">
                  {"error" in status && status.error && (
                    <div className="rounded bg-red-500/10 px-2.5 py-2 text-xs text-red-500">
                      {status.error}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {status.status === "connected" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleDisconnect(name)}
                        disabled={isConnecting}
                      >
                        {isConnecting ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Unlink className="mr-1 h-3 w-3" />
                        )}
                        {t("settings.mcpSettings.disconnect")}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleConnect(name)}
                        disabled={isConnecting}
                      >
                        {isConnecting ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Link className="mr-1 h-3 w-3" />
                        )}
                        {t("settings.mcpSettings.connect")}
                      </Button>
                    )}
                    
                    {mcpConfigs[name] && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleOpenEditDialog(name)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        {t("common.edit")}
                      </Button>
                    )}
                  </div>
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
          <h2 className="text-lg font-semibold tracking-tight">
            {t("settings.mcpSettings.title")}
          </h2>
          <p className="text-[13px] text-muted-foreground/80">
            {t("settings.mcpSettings.description")}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddDialog((prev) => ({ ...prev, isOpen: true }))}
            disabled={isContentLoading || hasError}
            className="h-7 text-xs"
          >
            <Plus className="mr-1 h-3 w-3" />
            {t("settings.mcpSettings.add")}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={refreshMcpStatus} disabled={isContentLoading} className="h-7 w-7">
            <RefreshCw className={cn("h-3.5 w-3.5", isContentLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          placeholder={t("settings.mcpSettings.searchPlaceholder")}
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
          <Settings2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 mt-0.5" />
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            {t("settings.mcpSettings.hint")}
          </p>
        </div>
      )}

      {/* 添加 MCP 对话框 */}
      <Dialog
        open={addDialog.isOpen}
        onOpenChange={(open) => !addDialog.isSubmitting && setAddDialog({ ...initialAddDialogState, isOpen: open })}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              {t("settings.mcpSettings.addDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("settings.mcpSettings.addDialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 名称 */}
            <div className="space-y-2">
              <Label>{t("settings.mcpSettings.name")}</Label>
              <Input
                placeholder={t("settings.mcpSettings.namePlaceholder")}
                value={addDialog.name}
                onChange={(e) => setAddDialog((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* 类型选择 */}
            <div className="space-y-2">
              <Label>{t("settings.mcpSettings.type")}</Label>
              <Select
                value={addDialog.type}
                onValueChange={(value: "local" | "remote") =>
                  setAddDialog((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      {t("settings.mcpSettings.typeLocal")}
                    </div>
                  </SelectItem>
                  <SelectItem value="remote">
                    <div className="flex items-center gap-2">
                      <Cloud className="h-4 w-4" />
                      {t("settings.mcpSettings.typeRemote")}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 本地类型配置 */}
            {addDialog.type === "local" && (
              <>
                <div className="space-y-2">
                  <Label>{t("settings.mcpSettings.command")}</Label>
                  <Input
                    placeholder={t("settings.mcpSettings.commandPlaceholder")}
                    value={addDialog.command}
                    onChange={(e) => setAddDialog((prev) => ({ ...prev, command: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("settings.mcpSettings.commandHint")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t("settings.mcpSettings.environment")}</Label>
                  <Textarea
                    placeholder={t("settings.mcpSettings.environmentPlaceholder")}
                    value={addDialog.environment}
                    onChange={(e) =>
                      setAddDialog((prev) => ({ ...prev, environment: e.target.value }))
                    }
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("settings.mcpSettings.environmentHint")}
                  </p>
                </div>
              </>
            )}

            {/* 远程类型配置 */}
            {addDialog.type === "remote" && (
              <>
                <div className="space-y-2">
                  <Label>{t("settings.mcpSettings.url")}</Label>
                  <Input
                    placeholder={t("settings.mcpSettings.urlPlaceholder")}
                    value={addDialog.url}
                    onChange={(e) => setAddDialog((prev) => ({ ...prev, url: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("settings.mcpSettings.headers")}</Label>
                  <Textarea
                    placeholder={t("settings.mcpSettings.headersPlaceholder")}
                    value={addDialog.headers}
                    onChange={(e) =>
                      setAddDialog((prev) => ({ ...prev, headers: e.target.value }))
                    }
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("settings.mcpSettings.headersHint")}
                  </p>
                </div>
              </>
            )}

            {/* 超时设置 */}
            <div className="space-y-2">
              <Label>{t("settings.mcpSettings.timeout")}</Label>
              <Input
                type="number"
                placeholder="5000"
                value={addDialog.timeout}
                onChange={(e) => setAddDialog((prev) => ({ ...prev, timeout: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                {t("settings.mcpSettings.timeoutHint")}
              </p>
            </div>

            {/* 启用开关 */}
            <div className="flex items-center justify-between">
              <Label>{t("settings.mcpSettings.enabled")}</Label>
              <Switch
                checked={addDialog.enabled}
                onCheckedChange={(checked) =>
                  setAddDialog((prev) => ({ ...prev, enabled: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialog(initialAddDialogState)}
              disabled={addDialog.isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleAddMcp}
              disabled={!addDialog.name.trim() || addDialog.isSubmitting}
            >
              {addDialog.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("common.add")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑 MCP 对话框 */}
      <Dialog
        open={editDialog.isOpen}
        onOpenChange={(open) => !editDialog.isSubmitting && setEditDialog({ ...initialEditDialogState, isOpen: open })}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              {t("settings.mcpSettings.editDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("settings.mcpSettings.editDialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 名称（只读） */}
            <div className="space-y-2">
              <Label>{t("settings.mcpSettings.name")}</Label>
              <Input
                value={editDialog.name}
                disabled
                className="bg-muted"
              />
            </div>

            {/* 类型显示（只读） */}
            <div className="space-y-2">
              <Label>{t("settings.mcpSettings.type")}</Label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-sm">
                {editDialog.type === "local" ? (
                  <>
                    <Server className="h-4 w-4" />
                    {t("settings.mcpSettings.typeLocal")}
                  </>
                ) : (
                  <>
                    <Cloud className="h-4 w-4" />
                    {t("settings.mcpSettings.typeRemote")}
                  </>
                )}
              </div>
            </div>

            {/* 本地类型配置 */}
            {editDialog.type === "local" && (
              <>
                <div className="space-y-2">
                  <Label>{t("settings.mcpSettings.command")}</Label>
                  <Input
                    placeholder={t("settings.mcpSettings.commandPlaceholder")}
                    value={editDialog.command}
                    onChange={(e) => setEditDialog((prev) => ({ ...prev, command: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("settings.mcpSettings.commandHint")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t("settings.mcpSettings.environment")}</Label>
                  <Textarea
                    placeholder={t("settings.mcpSettings.environmentPlaceholder")}
                    value={editDialog.environment}
                    onChange={(e) =>
                      setEditDialog((prev) => ({ ...prev, environment: e.target.value }))
                    }
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("settings.mcpSettings.environmentHint")}
                  </p>
                </div>
              </>
            )}

            {/* 远程类型配置 */}
            {editDialog.type === "remote" && (
              <>
                <div className="space-y-2">
                  <Label>{t("settings.mcpSettings.url")}</Label>
                  <Input
                    placeholder={t("settings.mcpSettings.urlPlaceholder")}
                    value={editDialog.url}
                    onChange={(e) => setEditDialog((prev) => ({ ...prev, url: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("settings.mcpSettings.headers")}</Label>
                  <Textarea
                    placeholder={t("settings.mcpSettings.headersPlaceholder")}
                    value={editDialog.headers}
                    onChange={(e) =>
                      setEditDialog((prev) => ({ ...prev, headers: e.target.value }))
                    }
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("settings.mcpSettings.headersHint")}
                  </p>
                </div>
              </>
            )}

            {/* 超时设置 */}
            <div className="space-y-2">
              <Label>{t("settings.mcpSettings.timeout")}</Label>
              <Input
                type="number"
                placeholder="5000"
                value={editDialog.timeout}
                onChange={(e) => setEditDialog((prev) => ({ ...prev, timeout: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                {t("settings.mcpSettings.timeoutHint")}
              </p>
            </div>

            {/* 启用开关 */}
            <div className="flex items-center justify-between">
              <Label>{t("settings.mcpSettings.enabled")}</Label>
              <Switch
                checked={editDialog.enabled}
                onCheckedChange={(checked) =>
                  setEditDialog((prev) => ({ ...prev, enabled: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog(initialEditDialogState)}
              disabled={editDialog.isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={editDialog.isSubmitting}
            >
              {editDialog.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {t("common.save")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
