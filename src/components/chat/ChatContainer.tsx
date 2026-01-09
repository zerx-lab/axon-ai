/**
 * 聊天容器组件
 * 整合消息列表和输入框，支持空状态展示和会话聊天两种布局
 */

import { useRef, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChatMessage } from "./ChatMessage";
import { ChatInputCard } from "./ChatInputCard";
import { QuickPrompts } from "./QuickPrompts";
import { TodoListCompact } from "./TodoList";
import { AutoAcceptToggle } from "./PermissionPrompt";
import { FloatingPermissionPrompt } from "./FloatingPermissionPrompt";
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
  
  // 快捷提示填充值状态
  const [quickPromptFillValue, setQuickPromptFillValue] = useState("");
  
  // 是否应该自动滚动（用户未手动向上滚动时为 true）
  const shouldAutoScrollRef = useRef(true);
  // 是否显示"滚动到底部"按钮
  const [showScrollButton, setShowScrollButton] = useState(false);
  // 追踪上一次消息数量，用于检测新消息
  const prevMessageCountRef = useRef(messages.length);
  // 标记是否是程序触发的滚动（非用户手动滚动）
  const isProgrammaticScrollRef = useRef(false);

  // 检查是否滚动到底部附近（允许 50px 的误差）
  const isNearBottom = useCallback((element: HTMLElement) => {
    const threshold = 50;
    return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
  }, []);

  // 处理滚动事件
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    
    // 如果是程序触发的滚动，忽略此次事件
    if (isProgrammaticScrollRef.current) {
      isProgrammaticScrollRef.current = false;
      return;
    }
    
    const nearBottom = isNearBottom(scrollRef.current);
    
    // 如果用户滚动到底部附近，恢复自动滚动
    if (nearBottom) {
      shouldAutoScrollRef.current = true;
      setShowScrollButton(false);
    } else {
      // 用户向上滚动，禁用自动滚动
      shouldAutoScrollRef.current = false;
      setShowScrollButton(true);
    }
  }, [isNearBottom]);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      isProgrammaticScrollRef.current = true;
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      shouldAutoScrollRef.current = true;
      setShowScrollButton(false);
    }
  }, []);

  // 当有新消息时，仅在 shouldAutoScroll 为 true 时自动滚动到底部
  // 只有消息数量增加时才触发滚动，避免消息内容更新时强制滚动
  useEffect(() => {
    const currentCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    
    // 更新消息数量引用
    prevMessageCountRef.current = currentCount;
    
    // 只有消息数量增加且允许自动滚动时才执行
    if (scrollRef.current && shouldAutoScrollRef.current && currentCount > prevCount) {
      isProgrammaticScrollRef.current = true;
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // 处理快捷提示选择 - 填充到输入框而不是直接发送
  const handleQuickPromptSelect = (prompt: string) => {
    setQuickPromptFillValue(prompt);
  };

  // 快捷提示填充值消费后清空
  const handleFillValueConsumed = useCallback(() => {
    setQuickPromptFillValue("");
  }, []);

  // 空状态布局（新会话）- Supabase 风格精致设计
  if (isEmptyState) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        {/* 中心内容区域 */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
          {/* 欢迎标题 */}
          <WelcomeHeader />

          {/* 输入框卡片 */}
          <div className="w-full max-w-2xl mt-8">
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
              fillValue={quickPromptFillValue}
              onFillValueConsumed={handleFillValueConsumed}
            />
          </div>

          {/* 快捷提示按钮 */}
          <div className="mt-8">
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

  // 会话聊天布局（有消息时）- 精致现代风格
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
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
            {/* 浮动权限提示（没有工具调用关联的权限请求） */}
            {activeSessionId && (
              <div className="px-6 py-3">
                <FloatingPermissionPrompt sessionId={activeSessionId} />
              </div>
            )}
          </div>
        </div>

        {/* 滚动到底部按钮 - 精致设计 */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className={cn(
              "absolute bottom-5 right-5 z-10",
              "flex items-center justify-center",
              "w-9 h-9 rounded-xl",
              "bg-card/95 backdrop-blur-md",
              "border border-border/60 shadow-lg shadow-black/5",
              "text-muted-foreground hover:text-foreground",
              "hover:bg-accent hover:border-border",
              "transition-all duration-200",
              "opacity-0 animate-in fade-in slide-in-from-bottom-2 duration-200",
              showScrollButton && "opacity-100"
            )}
            aria-label="滚动到底部"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 输入区域 - 精致底部栏 */}
      <div className="border-t border-border/60 bg-background/95 backdrop-blur-sm px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* 任务列表（在输入框上方显示） */}
          {activeSessionId && (
            <TodoListCompact sessionId={activeSessionId} />
          )}
          
          {/* 输入卡片 */}
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
          
          {/* 底部工具栏：自动批准开关 */}
          {activeSessionId && (
            <div className="flex items-center justify-between">
              <AutoAcceptToggle sessionId={activeSessionId} />
              <Disclaimer />
            </div>
          )}
          {!activeSessionId && <Disclaimer className="mt-3" />}
        </div>
      </div>
    </div>
  );
}

/**
 * 欢迎标题组件 - Supabase 风格精致设计
 */
function WelcomeHeader() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center text-center">
      {/* 图标 - 精致的渐变背景 */}
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-5 shadow-sm border border-primary/10">
        <Sparkles className="h-7 w-7 text-primary" />
      </div>

      {/* 标题 */}
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
        {t("chat.welcomeTitle")}
      </h1>
      
      {/* 副标题 */}
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        {t("chat.welcomeSubtitle", "开始与 AI 助手对话，获取智能帮助")}
      </p>
    </div>
  );
}

/**
 * 底部免责声明组件 - 精致样式
 */
function Disclaimer({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <p className={cn(
      "text-xs text-muted-foreground/80 text-center leading-relaxed",
      className
    )}>
      {t("chat.disclaimer")}
    </p>
  );
}
