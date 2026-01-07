import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input area */}
      <ChatInput
        onSend={onSend}
        onStop={onStop}
        isLoading={isLoading}
        disabled={disabled}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 mb-4">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Start a conversation
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Send a message to begin chatting with Axon, your AI assistant.
      </p>
    </div>
  );
}
