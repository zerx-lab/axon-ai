/**
 * Subagent 面板头部
 *
 * 显示当前 subagent 的类型、描述和 session ID
 */

import { Bot, ExternalLink, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SubagentTab } from "@/stores/subagentPanel";

interface SubagentPanelHeaderProps {
  tab: SubagentTab;
  onJumpToSession?: () => void;
}

export function SubagentPanelHeader({
  tab,
  onJumpToSession,
}: SubagentPanelHeaderProps) {
  const [copied, setCopied] = useState(false);

  // 复制 session ID
  const copySessionId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(tab.sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("复制失败:", e);
    }
  }, [tab.sessionId]);

  // 格式化 subagent 类型名称
  const formatType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Subagent 类型图标 */}
        <div
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-sm flex-shrink-0",
            "bg-accent"
          )}
        >
          <Bot className="h-4 w-4 text-foreground" />
        </div>

        {/* 类型 + 描述 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground capitalize flex-shrink-0">
              {formatType(tab.subagentType)}
            </span>
            <span className="text-muted-foreground/50 flex-shrink-0">·</span>
            <span className="text-sm text-muted-foreground truncate">
              {tab.description}
            </span>
          </div>

          {/* Session ID */}
          <button
            onClick={copySessionId}
            className={cn(
              "flex items-center gap-1 text-xs font-mono",
              "text-muted-foreground/70 hover:text-muted-foreground",
              "transition-colors duration-150"
            )}
          >
            <span className="truncate max-w-[180px]">
              {tab.sessionId.slice(0, 24)}...
            </span>
            {copied ? (
              <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
            ) : (
              <Copy className="h-3 w-3 flex-shrink-0" />
            )}
          </button>
        </div>
      </div>

      {/* 跳转按钮 (预留) */}
      {onJumpToSession && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onJumpToSession}
          className="h-7 px-2 text-xs text-muted-foreground flex-shrink-0"
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          跳转
        </Button>
      )}
    </div>
  );
}
