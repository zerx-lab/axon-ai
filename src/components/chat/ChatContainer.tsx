import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import type { Message } from "@/types/chat";
import { MessageSquare } from "lucide-react";

interface ChatContainerProps {
  messages: Message[];
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ChatContainer({
  messages,
  onSend,
  onStop,
  isLoading = false,
  disabled = false,
}: ChatContainerProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 当有新消息时自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 消息区域 - 使用原生滚动 */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto chat-scroll-area"
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col">
            {messages.map((message) => (
              <ChatMessage key={message.info.id} message={message} />
            ))}
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <ChatInput
        onSend={onSend}
        onStop={onStop}
        isLoading={isLoading}
        disabled={disabled}
        placeholder={t("chat.inputPlaceholder")}
      />
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-1 flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 mb-4">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        {t("chat.emptyState.title")}
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        {t("chat.emptyState.description")}
      </p>
    </div>
  );
}
