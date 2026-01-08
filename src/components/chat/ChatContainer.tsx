/**
 * 聊天容器组件
 * 整合消息列表和输入框，支持空状态展示和会话聊天两种布局
 */

import { useRef, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChatMessage } from "./ChatMessage";
import { ChatInputCard } from "./ChatInputCard";
import { QuickPrompts } from "./QuickPrompts";
import type { Message, Session } from "@/types/chat";
import type { Provider } from "@/stores/chat";
import { Sparkles, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  // Variant（推理深度）相关
  currentVariants?: string[];
  selectedVariant?: string | undefined;
  onSelectVariant?: (variant: string | undefined) => void;
  onCycleVariant?: () => void;
  // 会话历史搜索相关
  sessions?: Session[];
  activeSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
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
  currentVariants = [],
  selectedVariant,
  onSelectVariant,
  onCycleVariant,
  sessions = [],
  activeSessionId = null,
  onSelectSession,
}: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isEmptyState = messages.length === 0;
  
  // 是否应该自动滚动（用户未手动向上滚动时为 true）
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  // 是否显示"滚动到底部"按钮
  const [showScrollButton, setShowScrollButton] = useState(false);

  // 检查是否滚动到底部附近（允许 50px 的误差）
  const isNearBottom = useCallback((element: HTMLElement) => {
    const threshold = 50;
    return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
  }, []);

  // 处理滚动事件
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    
    const nearBottom = isNearBottom(scrollRef.current);
    
    // 如果用户滚动到底部附近，恢复自动滚动
    if (nearBottom) {
      setShouldAutoScroll(true);
      setShowScrollButton(false);
    } else {
      // 用户向上滚动，禁用自动滚动
      setShouldAutoScroll(false);
      setShowScrollButton(true);
    }
  }, [isNearBottom]);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      setShouldAutoScroll(true);
      setShowScrollButton(false);
    }
  }, []);

  // 当有新消息时，仅在 shouldAutoScroll 为 true 时自动滚动到底部
  useEffect(() => {
    if (scrollRef.current && shouldAutoScroll) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, shouldAutoScroll]);

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
              currentVariants={currentVariants}
              selectedVariant={selectedVariant}
              onSelectVariant={onSelectVariant}
              onCycleVariant={onCycleVariant}
              isEmptyState={true}
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={onSelectSession}
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
      <div className="relative flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto chat-scroll-area"
        >
          <div className="flex flex-col">
            {messages.map((message) => (
              <ChatMessage key={message.info.id} message={message} />
            ))}
          </div>
        </div>

        {/* 滚动到底部按钮 */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className={cn(
              "absolute bottom-4 right-4 z-10",
              "flex items-center justify-center",
              "w-8 h-8 rounded-full",
              "bg-background/90 backdrop-blur-sm",
              "border border-border/60 shadow-md",
              "text-muted-foreground hover:text-foreground",
              "hover:bg-accent",
              "transition-all duration-200",
              "opacity-0 animate-in fade-in duration-200",
              showScrollButton && "opacity-100"
            )}
            aria-label="滚动到底部"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}
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
            currentVariants={currentVariants}
            selectedVariant={selectedVariant}
            onSelectVariant={onSelectVariant}
            onCycleVariant={onCycleVariant}
            isEmptyState={false}
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={onSelectSession}
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
