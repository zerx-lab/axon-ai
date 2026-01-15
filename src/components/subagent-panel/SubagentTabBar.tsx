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
  onClose: () => void;
}

export function SubagentTabBar({
  tabs,
  activeTabId,
  onTabClick,
  onClose,
}: SubagentTabBarProps) {
  return (
    <div className="flex items-center h-10 px-2 border-b border-border/50 bg-muted/30">
      {/* 标签容器 */}
      <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = tab.sessionId === activeTabId;

          return (
            <button
              key={tab.sessionId}
              onClick={() => onTabClick(tab.sessionId)}
              className={cn(
                // 基础样式
                "flex items-center gap-1.5 px-3 py-1.5 rounded-sm",
                "text-xs font-medium whitespace-nowrap",
                "transition-colors duration-150",

                // 状态样式
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
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
              <span className="max-w-[120px] truncate">{tab.description}</span>
            </button>
          );
        })}
      </div>

      {/* 关闭按钮 */}
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
