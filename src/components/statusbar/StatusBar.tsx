/**
 * 状态栏组件
 * 位于页面底部，显示 MCP 服务器状态等信息
 * 设计风格：Zed-style - 扁平、精致、极简
 * 
 * 与 opencode desktop 实现一致：
 * - 显示连接数/总数
 * - 点击展开列表
 * - 支持启用/禁用切换
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Blocks,
  Loader2,
  RefreshCw,
  StopCircle,
  PlayCircle,
  Wrench,
  Check,
  HelpCircle,
  X,
  ChevronRight,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useOpencode } from "@/hooks";
import type { McpStatus, McpServersStatus } from "@/types/mcp";
import { getMcpStatusStats } from "@/types/mcp";
import { LspStatusButton } from "./LspStatusButton";
import { getToolsSimple, CATEGORY_NAMES, getToolCategory } from "@/services/opencode/tools";
import { settings as tauriSettings, fs as tauriFs, opencode as tauriOpencode } from "@/services/tauri";
import {
  type PermissionActionType,
  type PermissionConfig,
  getActionDisplayName,
} from "@/types/permission";

// 工具权限类型
interface ToolWithPermission {
  id: string;
  description?: string;
  permission: PermissionActionType;
}

export function StatusBar() {
  const { t } = useTranslation();
  const { client, isConnected, state } = useOpencode();

  const [mcpServers, setMcpServers] = useState<McpServersStatus>({});
  const [isLoading, setIsLoading] = useState(false);
  const [togglingServer, setTogglingServer] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const [tools, setTools] = useState<ToolWithPermission[]>([]);
  // permissionConfig 用于 handlePermissionChange 中更新权限配置
  const [, setPermissionConfig] = useState<PermissionConfig>({});
  const [isToolsLoading, setIsToolsLoading] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [updatingPermission, setUpdatingPermission] = useState<string | null>(null);
  
  // 使用 ref 存储 client，避免依赖变化
  const clientRef = useRef(client);
  clientRef.current = client;
  
  // 跟踪是否已加载
  const hasLoadedRef = useRef(false);

  const closePermissionMenu = useCallback(() => {
    // 关闭权限菜单时的清理逻辑（如果需要）
  }, []);

  useEffect(() => {
    if (!isToolsOpen) {
      closePermissionMenu();
    }
  }, [isToolsOpen, closePermissionMenu]);

  // 判断后端是否就绪
  const isBackendReady = state.backendStatus.type === "running" && isConnected;

  // 加载 MCP 服务器状态
  const loadMcpStatus = useCallback(async () => {
    const currentClient = clientRef.current;
    if (!currentClient || !isConnected) return;

    setIsLoading(true);
    try {
      const result = await currentClient.mcp.status();
      if (result.data) {
        setMcpServers(result.data as unknown as McpServersStatus);
      }
    } catch (error) {
      console.error("加载 MCP 状态失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  const loadTools = useCallback(async () => {
    const currentClient = clientRef.current;
    if (!currentClient || !isConnected) return;

    setIsToolsLoading(true);
    try {
      // 并行获取工具列表和权限配置
      const [toolsResult, configResult] = await Promise.all([
        getToolsSimple(),
        currentClient.config.get(),
      ]);
      
      // 解析权限配置
      const config = configResult.data as unknown as { permission?: PermissionConfig };
      const permConfig = config?.permission || {};
      setPermissionConfig(permConfig);
      
      // 获取默认权限（优先从配置中取，否则默认 "allow"）
      const defaultPermission = (
        typeof permConfig["*"] === "string" 
          ? permConfig["*"] 
          : "allow"
      ) as PermissionActionType;
      
      // 为每个工具添加权限信息
      const toolsWithPermission: ToolWithPermission[] = toolsResult.map(tool => {
        const configValue = permConfig[tool.id];
        let permission: PermissionActionType;
        
        if (configValue === undefined) {
          // 未配置，使用默认权限
          permission = defaultPermission;
        } else if (typeof configValue === "string") {
          // 简单权限值
          permission = configValue;
        } else if (typeof configValue === "object" && configValue !== null) {
          // 复杂权限对象，取默认值
          permission = (configValue["*"] || "ask") as PermissionActionType;
        } else {
          permission = defaultPermission;
        }
        
        return {
          id: tool.id,
          description: tool.description,
          permission,
        };
      });
      
      setTools(toolsWithPermission);
    } catch (error) {
      console.error("加载工具列表失败:", error);
    } finally {
      setIsToolsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isBackendReady && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadMcpStatus();
      loadTools();
    }
    
    // 断开连接时重置标记
    if (!isBackendReady) {
      hasLoadedRef.current = false;
    }
  }, [isBackendReady, loadMcpStatus, loadTools]);

  // 计算统计信息
  const stats = useMemo(() => getMcpStatusStats(mcpServers), [mcpServers]);

  const toolsByCategory = useMemo(() => {
    const grouped: Record<string, typeof tools> = {};
    tools.forEach(tool => {
      const category = getToolCategory(tool.id);
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(tool);
    });
    return grouped;
  }, [tools]);

  // 保存权限配置并重启服务
  const handlePermissionChange = useCallback(async (toolId: string, newAction: PermissionActionType) => {
    if (!client) return;

    setUpdatingPermission(toolId);
    try {
      // 获取 opencode.json 配置文件路径
      const configPath = await tauriSettings.getOpencodeConfigPath();
      
      // 读取现有配置
      let existingConfig: Record<string, unknown> = {};
      try {
        const content = await tauriFs.readFileContent(configPath);
        existingConfig = JSON.parse(content);
      } catch {
        // 文件不存在或解析失败，使用空配置
      }
      
      // 更新权限配置
      const currentPermConfig = (existingConfig.permission || {}) as PermissionConfig;
      const currentValue = currentPermConfig[toolId];
      
      let newPermConfig: PermissionConfig;
      if (typeof currentValue === "object" && currentValue !== null) {
        // 复杂权限对象，只更新默认值
        newPermConfig = {
          ...currentPermConfig,
          [toolId]: {
            ...currentValue,
            "*": newAction,
          },
        };
      } else {
        // 简单权限或新增
        newPermConfig = {
          ...currentPermConfig,
          [toolId]: newAction,
        };
      }
      
      // 合并并写入配置
      const mergedConfig = {
        ...existingConfig,
        permission: newPermConfig,
      };
      
      await tauriFs.writeFileContent(configPath, JSON.stringify(mergedConfig, null, 2));
      setPermissionConfig(newPermConfig);
      
      // 清理 SDK 缓存
      await client.instance.dispose();
      
      // 重启后端服务以使权限配置生效
      toast.info(t("statusBar.permissionRestarting"));
      try {
        await tauriOpencode.restart();
        toast.success(t("statusBar.permissionUpdated"));
        // 重新加载工具列表以刷新权限状态
        await loadTools();
      } catch (restartError) {
        console.error("重启服务失败:", restartError);
        toast.warning(t("statusBar.permissionRestartFailed"));
      }
    } catch (error) {
      console.error("保存权限配置失败:", error);
      toast.error(t("statusBar.permissionSaveFailed"));
    } finally {
      setUpdatingPermission(null);
    }
  }, [client, t, loadTools]);

  // 切换 MCP 服务器状态（启用/禁用）
  // 与 opencode desktop 实现一致：connected -> disconnect, 其他状态 -> connect
  const handleToggle = async (name: string) => {
    if (!client) return;

    const status = mcpServers[name];
    const isEnabled = status?.status === "connected";

    setTogglingServer(name);
    try {
      if (isEnabled) {
        // 禁用：断开连接
        await client.mcp.disconnect({ name });
      } else {
        // 启用/重试：连接
        await client.mcp.connect({ name });
      }
      await loadMcpStatus();
    } catch (error) {
      console.error("切换 MCP 服务器状态失败:", error);
    } finally {
      setTogglingServer(null);
    }
  };

  // 重启所有服务器
  const handleRestartAll = async () => {
    if (!client) return;

    setIsLoading(true);
    try {
      const connectedServers = Object.entries(mcpServers)
        .filter(([, status]) => status.status === "connected")
        .map(([name]) => name);

      for (const name of connectedServers) {
        await client.mcp.disconnect({ name });
      }
      for (const name of connectedServers) {
        await client.mcp.connect({ name });
      }
      await loadMcpStatus();
    } catch (error) {
      console.error("重启 MCP 服务器失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 停止所有服务器
  const handleStopAll = async () => {
    if (!client) return;

    setIsLoading(true);
    try {
      const connectedServers = Object.entries(mcpServers)
        .filter(([, status]) => status.status === "connected")
        .map(([name]) => name);

      for (const name of connectedServers) {
        await client.mcp.disconnect({ name });
      }
      await loadMcpStatus();
    } catch (error) {
      console.error("停止 MCP 服务器失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 获取状态显示信息
  const getStatusInfo = (status: McpStatus): {
    color: string;
    bgColor: string;
    text: string;
    canRetry: boolean;
  } => {
    switch (status.status) {
      case "connected":
        return {
          color: "text-green-500",
          bgColor: "bg-green-500",
          text: t("statusBar.enabled"),
          canRetry: false,
        };
      case "disabled":
        return {
          color: "text-muted-foreground",
          bgColor: "bg-muted-foreground/50",
          text: t("statusBar.disabled"),
          canRetry: true,
        };
      case "failed":
        return {
          color: "text-red-500",
          bgColor: "bg-red-500",
          text: status.error || t("statusBar.failed"),
          canRetry: true,
        };
      case "needs_auth":
        return {
          color: "text-yellow-500",
          bgColor: "bg-yellow-500",
          text: t("statusBar.needsAuth"),
          canRetry: true,
        };
      case "needs_client_registration":
        return {
          color: "text-orange-500",
          bgColor: "bg-orange-500",
          text: status.error || t("statusBar.needsRegistration"),
          canRetry: true,
        };
      default:
        return {
          color: "text-muted-foreground",
          bgColor: "bg-muted-foreground/50",
          text: t("statusBar.unknown"),
          canRetry: true,
        };
    }
  };

  // 获取总体状态指示器颜色
  const getOverallStatusColor = () => {
    if (stats.total === 0) return "bg-muted-foreground/50";
    if (stats.failed > 0) return "bg-red-500";
    if (stats.needsAuth > 0) return "bg-yellow-500";
    if (stats.connected === 0) return "bg-muted-foreground/50";
    return "bg-green-500";
  };

  // 判断是否有错误状态
  const hasError = stats.failed > 0 || stats.needsAuth > 0;

  // 如果后端未就绪，不显示状态栏
  if (!isBackendReady) {
    return null;
  }

  const serverEntries = Object.entries(mcpServers);

  return (
    <div className="flex items-center h-6 px-2 bg-sidebar border-t border-border/50 text-xs shrink-0">
      {/* MCP 状态 */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-1.5 px-2 h-full",
              "text-muted-foreground/70 hover:text-foreground",
              "hover:bg-accent/50",
              "transition-colors duration-150"
            )}
          >
            {/* 状态指示点 */}
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                getOverallStatusColor()
              )}
            />
            {/* MCP 图标 */}
            <Blocks className={cn("h-3.5 w-3.5", hasError && "text-yellow-500")} />
            {/* 统计文本 */}
            <span className="tabular-nums">
              {stats.connected} MCP
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="start"
          sideOffset={4}
          className="w-72 p-0"
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
            <span className="text-xs font-medium text-foreground">
              {t("statusBar.mcpServers")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={loadMcpStatus}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>
          </div>

          {/* 服务器列表 */}
          <ScrollArea className="max-h-64">
            {serverEntries.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                {t("statusBar.noServers")}
              </div>
            ) : (
              <div className="py-1">
                {serverEntries.map(([name, status]) => {
                  const statusInfo = getStatusInfo(status);
                  const isToggling = togglingServer === name;
                  const isEnabled = status.status === "connected";

                  return (
                    <button
                      key={name}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 w-full text-left",
                        "hover:bg-accent/50 transition-colors",
                        isToggling && "opacity-50 pointer-events-none"
                      )}
                      onClick={() => handleToggle(name)}
                      disabled={isToggling}
                    >
                      {/* 状态指示点 */}
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          statusInfo.bgColor
                        )}
                      />
                      {/* 服务器信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium truncate">{name}</span>
                          {isToggling && (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        <span className={cn("text-[10px] truncate block", statusInfo.color)}>
                          {statusInfo.text}
                        </span>
                      </div>
                      {/* 切换图标 */}
                      <div className="shrink-0">
                        {isEnabled ? (
                          <StopCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        ) : (
                          <PlayCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* 底部操作栏 */}
          {serverEntries.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-border/50">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleRestartAll}
                disabled={isLoading || stats.connected === 0}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                {t("statusBar.restartAll")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleStopAll}
                disabled={isLoading || stats.connected === 0}
              >
                <StopCircle className="h-3 w-3 mr-1" />
                {t("statusBar.stopAll")}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Tools 工具列表 */}
      <Popover open={isToolsOpen} onOpenChange={setIsToolsOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-1.5 px-2 h-full ml-2",
              "text-muted-foreground/70 hover:text-foreground",
              "hover:bg-accent/50",
              "transition-colors duration-150"
            )}
          >
            <Wrench className="h-3.5 w-3.5" />
            <span className="tabular-nums">
              {tools.length} {t("statusBar.tools", "工具")}
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="start"
          sideOffset={4}
          className="w-[420px] p-0 overflow-hidden"
        >
          <TooltipProvider delayDuration={300}>
            {/* 标题栏 - 更精致的设计 */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10">
                  <Wrench className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">
                    {t("statusBar.availableTools", "可用工具")}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {t("statusBar.totalCount", "共 {{count}} 个", { count: tools.length })}
                    </span>
                    {/* 权限统计徽章 */}
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-green-500/10 text-green-600 dark:text-green-400">
                        <Check className="h-2.5 w-2.5" />
                        {tools.filter(t => t.permission === "allow").length}
                      </span>
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                        <HelpCircle className="h-2.5 w-2.5" />
                        {tools.filter(t => t.permission === "ask").length}
                      </span>
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-red-500/10 text-red-600 dark:text-red-400">
                        <X className="h-2.5 w-2.5" />
                        {tools.filter(t => t.permission === "deny").length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md"
                onClick={loadTools}
                disabled={isToolsLoading}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isToolsLoading && "animate-spin")} />
              </Button>
            </div>

            {/* 工具列表 */}
            <ScrollArea className="h-80">
              {tools.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Wrench className="h-8 w-8 mb-2 opacity-30" />
                  <span className="text-xs">{t("statusBar.noTools", "暂无可用工具")}</span>
                </div>
              ) : (
                <div className="p-2 space-y-3">
                  {Object.entries(toolsByCategory).map(([category, categoryTools]) => (
                    <div key={category} className="space-y-1">
                      {/* 分类标题 - 更突出的设计 */}
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {CATEGORY_NAMES[category] || category}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">
                          ({categoryTools.length})
                        </span>
                        <div className="flex-1 h-px bg-border/50" />
                      </div>

                      {/* 工具项 */}
                      <div className="space-y-0.5">
                        {categoryTools.map(tool => {
                          const isUpdating = updatingPermission === tool.id;

                          // 权限状态配置
                          const permissionConfig = {
                            allow: {
                              color: "text-green-600 dark:text-green-400",
                              bg: "bg-green-500/10",
                              border: "border-green-500/20",
                              icon: Check,
                            },
                            ask: {
                              color: "text-yellow-600 dark:text-yellow-400",
                              bg: "bg-yellow-500/10",
                              border: "border-yellow-500/20",
                              icon: HelpCircle,
                            },
                            deny: {
                              color: "text-red-600 dark:text-red-400",
                              bg: "bg-red-500/10",
                              border: "border-red-500/20",
                              icon: X,
                            },
                          }[tool.permission];

                          const PermIcon = permissionConfig.icon;

                          return (
                            <div
                              key={tool.id}
                              className={cn(
                                "group flex items-center gap-3 px-2 py-2 rounded-md",
                                "hover:bg-accent/50 transition-all duration-150",
                                isUpdating && "opacity-50 pointer-events-none"
                              )}
                            >
                              {/* 权限状态指示器 */}
                              <div className={cn(
                                "flex items-center justify-center w-5 h-5 rounded shrink-0",
                                permissionConfig.bg,
                                permissionConfig.color
                              )}>
                                <PermIcon className="h-3 w-3" />
                              </div>

                              {/* 工具信息 */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <code className="text-[11px] font-mono font-medium text-foreground">
                                    {tool.id}
                                  </code>
                                  {isUpdating && (
                                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                  )}
                                </div>
                                {tool.description && (
                                  <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5 leading-tight">
                                    {tool.description}
                                  </p>
                                )}
                              </div>

                              {/* 权限选择器 */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Select
                                      value={tool.permission}
                                      onValueChange={(value) => handlePermissionChange(tool.id, value as PermissionActionType)}
                                      disabled={isUpdating}
                                    >
                                      <SelectTrigger
                                        className={cn(
                                          "h-6 px-2 gap-1 text-[10px] border rounded-md",
                                          permissionConfig.border,
                                          permissionConfig.bg,
                                          permissionConfig.color,
                                          "hover:bg-accent focus:ring-0 focus:ring-offset-0"
                                        )}
                                      >
                                        <span>{getActionDisplayName(tool.permission, t)}</span>
                                      </SelectTrigger>
                                      <SelectContent align="end" className="min-w-[100px]">
                                        <SelectItem value="allow" className="text-xs">
                                          <div className="flex items-center gap-2">
                                            <div className="flex items-center justify-center w-4 h-4 rounded bg-green-500/10">
                                              <Check className="h-2.5 w-2.5 text-green-500" />
                                            </div>
                                            <span className="text-green-600 dark:text-green-400">
                                              {getActionDisplayName("allow", t)}
                                            </span>
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="ask" className="text-xs">
                                          <div className="flex items-center gap-2">
                                            <div className="flex items-center justify-center w-4 h-4 rounded bg-yellow-500/10">
                                              <HelpCircle className="h-2.5 w-2.5 text-yellow-500" />
                                            </div>
                                            <span className="text-yellow-600 dark:text-yellow-400">
                                              {getActionDisplayName("ask", t)}
                                            </span>
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="deny" className="text-xs">
                                          <div className="flex items-center gap-2">
                                            <div className="flex items-center justify-center w-4 h-4 rounded bg-red-500/10">
                                              <X className="h-2.5 w-2.5 text-red-500" />
                                            </div>
                                            <span className="text-red-600 dark:text-red-400">
                                              {getActionDisplayName("deny", t)}
                                            </span>
                                          </div>
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs">
                                  {t("statusBar.changePermission", "修改权限")}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* 底部提示栏 */}
            <div className="px-4 py-2.5 border-t border-border/50 bg-muted/20">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{t("statusBar.permissionHint", "悬停工具项可修改权限")}</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Check className="h-2.5 w-2.5 text-green-500" />
                    {t("statusBar.permissionAllow", "允许")}
                  </span>
                  <span className="flex items-center gap-1">
                    <HelpCircle className="h-2.5 w-2.5 text-yellow-500" />
                    {t("statusBar.permissionAsk", "询问")}
                  </span>
                  <span className="flex items-center gap-1">
                    <X className="h-2.5 w-2.5 text-red-500" />
                    {t("statusBar.permissionDeny", "拒绝")}
                  </span>
                </div>
              </div>
            </div>
          </TooltipProvider>
        </PopoverContent>
      </Popover>

      {/* LSP 状态 */}
      <LspStatusButton />
    </div>
  );
}
