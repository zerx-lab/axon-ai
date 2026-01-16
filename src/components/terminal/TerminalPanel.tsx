/**
 * 终端面板组件
 *
 * 基于 opencode desktop 实现：
 * - 使用 ghostty-web 渲染终端
 * - 通过 WebSocket 与 opencode PTY API 通信
 * - 支持多标签页切换和状态恢复
 */

import { useEffect, useCallback, useRef } from "react";
import {
  useTerminal,
  useActiveTerminal,
  useTerminalConnection,
} from "@/stores/terminal";
import { useTheme } from "@/stores/theme";
import { TerminalTabs } from "./TerminalTabs";
import { TerminalInstance } from "./TerminalInstance";
import { cn } from "@/lib/utils";
import type { TerminalTab } from "@/stores/terminal";

interface TerminalPanelProps {
  className?: string;
}

// 默认终端颜色（与 opencode 一致）
const DEFAULT_TERMINAL_COLORS = {
  light: { background: "#fcfcfc" },
  dark: { background: "#191515" },
};

export function TerminalPanel({ className }: TerminalPanelProps) {
  const { isVisible, isLoading, error, tabs, createTab, updateTab } =
    useTerminal();
  const { tab } = useActiveTerminal();
  const { endpoint, client } = useTerminalConnection();
  const { isDark } = useTheme();

  const isAutoCreatingRef = useRef(false);

  const terminalBackground = isDark
    ? DEFAULT_TERMINAL_COLORS.dark.background
    : DEFAULT_TERMINAL_COLORS.light.background;

  // 当终端实例清理时保存状态
  const handleInstanceCleanup = useCallback(
    (updatedTab: TerminalTab) => {
      updateTab(updatedTab.id, {
        buffer: updatedTab.buffer,
        rows: updatedTab.rows,
        cols: updatedTab.cols,
        scrollY: updatedTab.scrollY,
      });
    },
    [updateTab]
  );

  // 当终端面板可见但没有终端时，自动创建一个
  useEffect(() => {
    if (isAutoCreatingRef.current) return;
    if (isVisible && tabs.length === 0 && !isLoading && endpoint && client) {
      isAutoCreatingRef.current = true;
      createTab()
        .catch((e) => {
          console.error("[TerminalPanel] 自动创建终端失败:", e);
        })
        .finally(() => {
          isAutoCreatingRef.current = false;
        });
    }
  }, [isVisible, tabs.length, isLoading, createTab, endpoint, client]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-card border-t border-border/60",
        className
      )}
    >
      <TerminalTabs />

      {/* 终端内容区域 */}
      <div
        className="flex-1 min-h-0 overflow-hidden relative"
        style={{ backgroundColor: terminalBackground }}
      >
        {/* 渲染活动终端实例 */}
        {/* key 包含 isDark 以便主题切换时重新挂载（ghostty-web 不支持运行时主题切换） */}
        {tab && endpoint && (
          <TerminalInstance
            key={`${tab.id}-${isDark ? 'dark' : 'light'}`}
            tab={tab}
            onCleanup={handleInstanceCleanup}
          />
        )}

        {/* opencode 服务未连接提示 */}
        {!endpoint && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">
                OpenCode 服务未连接
              </div>
              <div className="text-xs text-muted-foreground/60 mt-1">
                请等待服务启动后再使用终端
              </div>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="absolute bottom-0 left-0 right-0 bg-destructive/90 text-white px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {/* 加载中提示 */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">
                正在启动终端...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
