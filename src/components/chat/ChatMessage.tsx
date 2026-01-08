/**
 * ChatMessage 组件
 * 渲染单条聊天消息，支持 OpenCode 消息格式
 */

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { User, Bot, Loader2, AlertCircle, StopCircle } from "lucide-react";
import { PartRenderer, MarkdownRenderer } from "./parts";
import { ThinkingIndicator } from "./ThinkingIndicator";
import type { 
  Message, 
  Part,
  TextPart,
  AssistantMessageInfo,
} from "@/types/chat";

/**
 * 从消息错误中提取错误信息
 */
function extractMessageError(error: unknown): string | null {
  if (!error) return null;
  
  // 错误结构: { name: string; data: { message: string; ... } }
  if (typeof error === "object") {
    const errorObj = error as { name?: string; data?: { message?: string }; message?: string };
    // 优先使用 data.message
    if (errorObj.data?.message) {
      return errorObj.data.message;
    }
    // 其次使用直接的 message
    if (errorObj.message) {
      return errorObj.message;
    }
    // 最后使用 name
    if (errorObj.name) {
      return errorObj.name;
    }
  }
  
  if (typeof error === "string") {
    return error;
  }
  
  return "未知错误";
}

/**
 * 判断错误是否为用户主动取消（MessageAbortedError）
 */
function isAbortedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const errorObj = error as { name?: string };
  return errorObj.name === "MessageAbortedError";
}

interface ChatMessageProps {
  message: Message;
  isLast?: boolean;
}

export function ChatMessage({ message, isLast = false }: ChatMessageProps) {
  const { t } = useTranslation();
  const isUser = message.info.role === "user";
  
  // 判断是否正在加载
  // 助手消息在以下情况显示 loading：
  // 1. 消息 ID 以 temp- 开头（临时消息）
  // 2. 消息未完成（time.completed 不存在）且没有错误
  const isLoading = !isUser && (() => {
    if (message.info.id.startsWith("temp-")) return true;
    
    const assistantInfo = message.info as AssistantMessageInfo;
    const hasCompleted = assistantInfo.time?.completed !== undefined;
    const hasError = assistantInfo.error !== undefined;
    
    // 未完成且无错误时显示 loading
    return !hasCompleted && !hasError;
  })();

  return (
    <div
      className={cn(
        "group flex gap-3 py-4 px-4",
        isUser ? "bg-transparent" : "bg-surface-1"
      )}
    >
      {/* 头像 */}
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* 内容 */}
      <div className="flex-1 space-y-2 overflow-hidden min-w-0">
        {/* 消息头部 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {isUser ? t("chat.user") : t("chat.assistant")}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTime(message.info.time.created)}
          </span>
          {isLoading && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* 消息内容 - 根据角色渲染 */}
        {isUser ? (
          <UserMessageContent parts={message.parts} />
        ) : (
          <AssistantMessageContent 
            parts={message.parts} 
            messageInfo={message.info as AssistantMessageInfo}
            isLast={isLast}
          />
        )}
      </div>
    </div>
  );
}

// ============== 用户消息内容 ==============

interface UserMessageContentProps {
  parts: Part[];
}

function UserMessageContent({ parts }: UserMessageContentProps) {
  // 用户消息主要是文本，直接提取显示
  const textParts = parts.filter((p): p is TextPart => p.type === "text");
  
  if (textParts.length === 0) {
    return <div className="text-sm text-muted-foreground">（无内容）</div>;
  }

  return (
    <div className="space-y-2">
      {textParts.map((part) => (
        <MarkdownRenderer key={part.id} content={part.text} />
      ))}
    </div>
  );
}

// ============== 助手消息内容 ==============

interface AssistantMessageContentProps {
  parts: Part[];
  messageInfo: AssistantMessageInfo;
  isLast: boolean;
}

function AssistantMessageContent({ parts, messageInfo, isLast }: AssistantMessageContentProps) {
  const { t } = useTranslation();
  
  // 检查消息是否有错误
  const messageError = extractMessageError(messageInfo.error);
  const isAborted = isAbortedError(messageInfo.error);
  const hasCompleted = messageInfo.time.completed !== undefined;
  
  // 判断是否正在加载
  // 注意：被中止的消息不算"正在加载"状态
  const isLoading = !hasCompleted && !messageError;
  
  // 过滤掉一些不需要显示的 part 类型
  const visibleParts = parts.filter((part) => {
    // 不显示快照和补丁等内部类型
    if (part.type === "snapshot" || part.type === "patch" || part.type === "compaction") {
      return false;
    }
    // 显示 step-finish 只在最后一条消息
    if (part.type === "step-finish" && !isLast) {
      return false;
    }
    return true;
  });

  // 如果没有可见的 parts
  if (visibleParts.length === 0) {
    // 如果是用户主动取消，显示 "已停止" 而非错误
    if (isAborted) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <StopCircle className="h-4 w-4" />
          <span>{t("errors.messageInterrupted")}</span>
        </div>
      );
    }
    
    // 如果有真正的错误，显示错误信息
    if (messageError) {
      return (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium">{t("errors.messageError")}</div>
            <div className="text-xs mt-1 break-words opacity-90">{messageError}</div>
          </div>
        </div>
      );
    }
    
    // 如果已完成但没有内容，显示空消息提示
    if (hasCompleted) {
      return (
        <div className="text-sm text-muted-foreground">
          {t("chat.emptyResponse")}
        </div>
      );
    }
    
    // 正在加载 - 使用 ThinkingIndicator
    return (
      <ThinkingIndicator
        parts={parts}
        startTime={messageInfo.time.created}
        isLoading={true}
      />
    );
  }

  return (
    <div className="space-y-2">
      {visibleParts.map((part, index) => (
        <PartRenderer
          key={part.id}
          part={part}
          messageInfo={messageInfo}
          isLast={index === visibleParts.length - 1}
        />
      ))}
      {/* 如果正在生成且有内容，在底部显示 ThinkingIndicator */}
      {isLoading && visibleParts.length > 0 && (
        <ThinkingIndicator
          parts={parts}
          startTime={messageInfo.time.created}
          isLoading={true}
          className="mt-2"
        />
      )}
      {/* 如果是用户主动取消，显示 "已停止" 提示（柔和样式） */}
      {isAborted && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
          <StopCircle className="h-4 w-4" />
          <span>{t("errors.messageInterrupted")}</span>
        </div>
      )}
      {/* 如果有内容但也有真正的错误（非中止），在底部显示错误 */}
      {messageError && !isAborted && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3 mt-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium">{t("errors.messageError")}</div>
            <div className="text-xs mt-1 break-words opacity-90">{messageError}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== 辅助函数 ==============

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
