/**
 * Subagent 会话内容视图
 *
 * 显示 subagent 的完整消息历史，复用 PartRenderer 组件
 */

import { useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message, AssistantMessageInfo } from "@/types/chat";
import { PartRenderer } from "@/components/chat/parts/PartRenderer";

interface SubagentSessionViewProps {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export function SubagentSessionView({
  messages,
  isLoading,
  error,
}: SubagentSessionViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollAnchorRef.current) {
      scrollAnchorRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // 加载中状态
  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-sm text-destructive">{error}</div>
      </div>
    );
  }

  // 空消息状态
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-sm text-muted-foreground">
          暂无消息
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-3 py-2 space-y-3"
    >
      {messages.map((message, index) => (
        <SubagentMessageView
          key={message.info.id}
          message={message}
          isLast={index === messages.length - 1}
        />
      ))}

      {/* 加载更多指示器 */}
      {isLoading && messages.length > 0 && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 自动滚动锚点 */}
      <div ref={scrollAnchorRef} />
    </div>
  );
}

// ============== 单条消息视图 ==============

interface SubagentMessageViewProps {
  message: Message;
  isLast: boolean;
}

function SubagentMessageView({ message, isLast }: SubagentMessageViewProps) {
  const { info, parts } = message;

  // 用户消息 - 简单显示文本
  if (info.role === "user") {
    const textParts = parts.filter((p) => p.type === "text" && !p.synthetic);
    if (textParts.length === 0) return null;

    return (
      <div
        className={cn(
          "px-3 py-2 rounded-md",
          "bg-muted/50 border border-border/30"
        )}
      >
        <div className="text-xs text-muted-foreground mb-1">用户</div>
        {textParts.map((part) => (
          <div key={part.id} className="text-sm text-foreground">
            {part.type === "text" ? part.text : null}
          </div>
        ))}
      </div>
    );
  }

  // 助手消息 - 使用 PartRenderer
  return (
    <div className="space-y-2">
      {parts.map((part, partIndex) => (
        <PartRenderer
          key={part.id}
          part={part}
          messageInfo={info as AssistantMessageInfo}
          isLast={isLast && partIndex === parts.length - 1}
        />
      ))}
    </div>
  );
}
