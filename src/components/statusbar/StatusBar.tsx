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
import {
  Blocks,
  Loader2,
  RefreshCw,
  StopCircle,
  PlayCircle,
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

export function StatusBar() {
  const { t } = useTranslation();
  const { client, isConnected, state } = useOpencode();

  const [mcpServers, setMcpServers] = useState<McpServersStatus>({});
  const [isLoading, setIsLoading] = useState(false);
  const [togglingServer, setTogglingServer] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

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

  // 初始加载
  useEffect(() => {
    if (isBackendReady) {
      loadMcpStatus();
    }
  }, [isBackendReady, loadMcpStatus]);

  // 计算统计信息
  const stats = useMemo(() => getMcpStatusStats(mcpServers), [mcpServers]);

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
    </div>
  );
}
