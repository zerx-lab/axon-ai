import { cn } from "@/lib/utils";
import type { Message } from "@/types/chat";
import { User, Bot } from "lucide-react";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "group flex gap-3 py-4 px-4",
        isUser ? "bg-transparent" : "bg-surface-1"
      )}
    >
      {/* Avatar */}
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

      {/* Content */}
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {isUser ? "You" : "Axon"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTime(message.timestamp)}
          </span>
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
            {message.content}
            {message.isStreaming && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-primary animate-pulse" />
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
