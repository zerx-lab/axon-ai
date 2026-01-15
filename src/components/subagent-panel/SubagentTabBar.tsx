/**
 * Subagent 面板标签栏
 *
 * 显示所有打开的 subagent 标签，支持切换和关闭
 */

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SubagentTab } from "@/stores/subagentPanel";

interface SubagentTabBarProps {
  tabs: SubagentTab[];
  activeTabId: string | null;
  onTabClick: (sessionId: string) => void;
  onTabClose: (sessionId: string) => void;
  onClose: () => void;
}

export function SubagentTabBar({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onClose,
}: SubagentTabBarProps) {
  return (
    <div className="flex items-center h-10 px-2 border-b border-border/50 bg-muted/30">
      {/* 标签容器 */}
      <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = tab.sessionId === activeTabId;

          return (
            <div
              key={tab.sessionId}
              className={cn(
                // 基础样式
                "group flex items-center gap-1 px-2 py-1.5 rounded-sm",
                "text-xs font-medium whitespace-nowrap",
                "transition-colors duration-150",

                // 状态样式
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {/* 点击区域 */}
              <button
                onClick={() => onTabClick(tab.sessionId)}
                className="flex items-center gap-1.5"
              >
                {/* 状态指示器 */}
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                    tab.status === "running" && "bg-blue-500 animate-pulse",
                    tab.status === "completed" && "bg-green-500",
                    tab.status === "error" && "bg-destructive"
                  )}
                />

                {/* 标签名称 */}
                <span className="max-w-[100px] truncate">{tab.description}</span>
              </button>

              {/* 单个 tab 关闭按钮 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.sessionId);
                }}
                className={cn(
                  "w-4 h-4 flex items-center justify-center rounded-sm",
                  "opacity-0 group-hover:opacity-100",
                  "hover:bg-foreground/10 transition-opacity duration-150",
                  isActive && "opacity-60"
                )}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* 关闭全部按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="h-7 w-7 p-0 ml-2 text-muted-foreground hover:text-foreground flex-shrink-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
