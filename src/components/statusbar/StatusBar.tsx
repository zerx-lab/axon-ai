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

import { useState, useEffect, useCallback, useMemo } from "react";
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
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useOpencode } from "@/hooks";
import type { McpStatus, McpServersStatus } from "@/types/mcp";
import { getMcpStatusStats } from "@/types/mcp";
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
  isInherited: boolean;  // 是否继承自默认权限
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

  // 判断后端是否就绪
  const isBackendReady = state.backendStatus.type === "running" && isConnected;

  // 加载 MCP 服务器状态
  const loadMcpStatus = useCallback(async () => {
    if (!client || !isConnected) return;

    setIsLoading(true);
    try {
      const result = await client.mcp.status();
      if (result.data) {
        setMcpServers(result.data as unknown as McpServersStatus);
      }
    } catch (error) {
      console.error("加载 MCP 状态失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, [client, isConnected]);

  const loadTools = useCallback(async () => {
    if (!client || !isConnected) return;

    setIsToolsLoading(true);
    try {
      // 并行获取工具列表和权限配置
      const [toolsResult, configResult] = await Promise.all([
        getToolsSimple(),
        client.config.get(),
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
        let isInherited = false;
        
        if (configValue === undefined) {
          // 未配置，继承默认权限
          permission = defaultPermission;
          isInherited = true;
        } else if (typeof configValue === "string") {
          // 简单权限值
          permission = configValue;
        } else if (typeof configValue === "object" && configValue !== null) {
          // 复杂权限对象，取默认值
          permission = (configValue["*"] || "ask") as PermissionActionType;
        } else {
          permission = defaultPermission;
          isInherited = true;
        }
        
        return {
          id: tool.id,
          description: tool.description,
          permission,
          isInherited,
        };
      });
      
      console.log('[StatusBar] loadTools 获取到的工具列表:', toolsWithPermission);
      console.log('[StatusBar] loadTools 工具数量:', toolsWithPermission.length);
      setTools(toolsWithPermission);
    } catch (error) {
      console.error("加载工具列表失败:", error);
    } finally {
      setIsToolsLoading(false);
    }
  }, [client, isConnected]);

  useEffect(() => {
    if (isBackendReady) {
      loadMcpStatus();
      loadTools();
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
          className="w-[400px] p-0"
        >
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
              <span className="text-xs font-medium text-foreground">
                {t("statusBar.availableTools", "可用工具")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={loadTools}
                disabled={isToolsLoading}
              >
                <RefreshCw className={cn("h-3 w-3", isToolsLoading && "animate-spin")} />
              </Button>
            </div>

            <ScrollArea className="h-72">
              {tools.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {t("statusBar.noTools", "暂无可用工具")}
                </div>
              ) : (
                <div className="py-1">
                  {Object.entries(toolsByCategory).map(([category, categoryTools]) => (
                    <div key={category} className="mb-2 last:mb-0">
                      <div className="px-3 py-1 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                        {CATEGORY_NAMES[category] || category}
                      </div>
                      {categoryTools.map(tool => {
                        const isUpdating = updatingPermission === tool.id;
                        
                        // 权限状态颜色
                        const permissionColorClass = {
                          allow: "text-green-600 dark:text-green-400",
                          ask: "text-yellow-600 dark:text-yellow-400",
                          deny: "text-red-600 dark:text-red-400",
                        }[tool.permission];
                        
                        return (
                          <div
                            key={tool.id}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50 transition-colors group",
                              isUpdating && "opacity-50"
                            )}
                          >
                            {/* 工具名称 */}
                            <code className="text-[11px] font-mono text-foreground/90 flex-shrink-0 min-w-[60px]">
                              {tool.id}
                            </code>
                            
                            {/* 工具描述 */}
                            <span className="text-[10px] text-muted-foreground truncate flex-1">
                              {tool.description}
                            </span>
                            
                            {/* 继承标记 */}
                            {tool.isInherited && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-[9px] text-muted-foreground/50 italic">
                                    {t("statusBar.inherited", "继承")}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="text-xs">{t("statusBar.inheritedTooltip", "使用默认权限")}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            
                            {/* 权限选择器 */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Select
                                    value={tool.permission}
                                    onValueChange={(value) => handlePermissionChange(tool.id, value as PermissionActionType)}
                                    disabled={isUpdating}
                                  >
                                    <SelectTrigger 
                                      className={cn(
                                        "h-6 w-6 p-0 border-0 bg-transparent justify-center",
                                        "hover:bg-accent focus:ring-0 focus:ring-offset-0",
                                        permissionColorClass
                                      )}
                                    >
                                      {/* 只显示图标，不显示文字 */}
                                      {tool.permission === "allow" && <Check className="h-3.5 w-3.5" />}
                                      {tool.permission === "ask" && <HelpCircle className="h-3.5 w-3.5" />}
                                      {tool.permission === "deny" && <X className="h-3.5 w-3.5" />}
                                    </SelectTrigger>
                                    <SelectContent align="end">
                                      <SelectItem value="allow" className="text-xs">
                                        <div className="flex items-center gap-1.5">
                                          <Check className="h-3 w-3 text-green-500" />
                                          <span className="text-green-600 dark:text-green-400">
                                            {getActionDisplayName("allow", t)}
                                          </span>
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="ask" className="text-xs">
                                        <div className="flex items-center gap-1.5">
                                          <HelpCircle className="h-3 w-3 text-yellow-500" />
                                          <span className="text-yellow-600 dark:text-yellow-400">
                                            {getActionDisplayName("ask", t)}
                                          </span>
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="deny" className="text-xs">
                                        <div className="flex items-center gap-1.5">
                                          <X className="h-3 w-3 text-red-500" />
                                          <span className="text-red-600 dark:text-red-400">
                                            {getActionDisplayName("deny", t)}
                                          </span>
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                {getActionDisplayName(tool.permission, t)}
                              </TooltipContent>
                            </Tooltip>
                            
                            {/* 更新中指示器 */}
                            {isUpdating && (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="px-3 py-2 border-t border-border/50 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {t("statusBar.totalTools", { count: tools.length })}
              </span>
              <span className="text-[9px] text-muted-foreground/60">
                {t("statusBar.permissionHint", "点击权限可快速修改")}
              </span>
            </div>
          </TooltipProvider>
        </PopoverContent>
      </Popover>
    </div>
  );
}
