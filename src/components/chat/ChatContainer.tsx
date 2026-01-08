/**
 * 聊天容器组件
 * 整合消息列表和输入框，支持空状态展示和会话聊天两种布局
 */

import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChatMessage } from "./ChatMessage";
import { ChatInputCard } from "./ChatInputCard";
import { QuickPrompts } from "./QuickPrompts";
import type { Message } from "@/types/chat";
import type { Provider } from "@/stores/chat";
import { Sparkles } from "lucide-react";

interface ChatContainerProps {
  messages: Message[];
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  // 模型选择相关
  providers?: Provider[];
  selectedModel?: { providerId: string; modelId: string } | null;
  onSelectModel?: (providerId: string, modelId: string) => void;
  isLoadingModels?: boolean;
}

export function ChatContainer({
  messages,
  onSend,
  onStop,
  isLoading = false,
  disabled = false,
  providers = [],
  selectedModel,
  onSelectModel,
  isLoadingModels = false,
}: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isEmptyState = messages.length === 0;

  // 当有新消息时自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 处理快捷提示选择
  const handleQuickPromptSelect = (prompt: string) => {
    onSend(prompt);
  };

  // 空状态布局（新会话）- 参考 Claude 风格
  if (isEmptyState) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 中心内容区域 */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
          {/* 欢迎标题 */}
          <WelcomeHeader />

          {/* 输入框卡片 */}
          <div className="w-full max-w-2xl mt-6">
            <ChatInputCard
              onSend={onSend}
              onStop={onStop}
              isLoading={isLoading}
              disabled={disabled}
              providers={providers}
              selectedModel={selectedModel}
              onSelectModel={onSelectModel}
              isLoadingModels={isLoadingModels}
              isEmptyState={true}
            />
          </div>

          {/* 快捷提示按钮 */}
          <div className="mt-6">
            <QuickPrompts
              onSelect={handleQuickPromptSelect}
              disabled={disabled || isLoading}
            />
          </div>
        </div>

        {/* 底部免责声明 */}
        <Disclaimer />
      </div>
    );
  }

  // 会话聊天布局（有消息时）
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 消息区域 - 使用原生滚动 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll-area">
        <div className="flex flex-col">
          {messages.map((message) => (
            <ChatMessage key={message.info.id} message={message} />
          ))}
        </div>
      </div>

      {/* 输入区域 */}
      <div className="border-t border-border bg-background p-4">
        <div className="max-w-3xl mx-auto">
          <ChatInputCard
            onSend={onSend}
            onStop={onStop}
            isLoading={isLoading}
            disabled={disabled}
            providers={providers}
            selectedModel={selectedModel}
            onSelectModel={onSelectModel}
            isLoadingModels={isLoadingModels}
            isEmptyState={false}
          />
        </div>

        {/* 底部免责声明 */}
        <Disclaimer className="mt-3" />
      </div>
    </div>
  );
}

/**
 * 欢迎标题组件
 */
function WelcomeHeader() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center text-center">
      {/* 图标 */}
      <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 mb-4">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>

      {/* 标题 */}
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
        {t("chat.welcomeTitle")}
      </h1>
    </div>
  );
}

/**
 * 底部免责声明组件
 */
function Disclaimer({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <p className={`text-xs text-muted-foreground text-center ${className || ""}`}>
      {t("chat.disclaimer")}
    </p>
  );
}
