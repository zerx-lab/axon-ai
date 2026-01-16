/**
 * 使用量面板主组件
 *
 * 左侧侧边面板，显示当前会话中每条消息的使用量详情
 * 设计参考 OpenCode Desktop:
 * - 顶部显示环形进度条和总统计
 * - 消息列表紧凑显示（序号、角色、时间、token 摘要）
 * - 点击消息展开显示详细信息和 JSON 数据
 */

import { useEffect, useRef, useCallback, useState, useMemo, memo } from "react";
import { cn } from "@/lib/utils";
import {
  X,
  BarChart3,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useTheme } from "@/stores/theme";
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/prism-light";
import { useTranslation } from "react-i18next";
import {
  useUsagePanelStore,
  USAGE_PANEL_MIN_WIDTH,
  USAGE_PANEL_MAX_WIDTH,
} from "@/stores/usagePanel";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ProgressCircle } from "@/components/ui/progress-circle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Message, AssistantMessageInfo } from "@/types/chat";

// ============== JSON 高亮主题与语言加载 ==============

// 主题缓存
const themeCache = {
  dark: null as Record<string, React.CSSProperties> | null,
  light: null as Record<string, React.CSSProperties> | null,
};

const loadDarkTheme = async () => {
  if (!themeCache.dark) {
    const mod = await import(
      "react-syntax-highlighter/dist/esm/styles/prism/one-dark"
    );
    themeCache.dark = mod.default;
  }
  return themeCache.dark;
};

const loadLightTheme = async () => {
  if (!themeCache.light) {
    const mod = await import(
      "react-syntax-highlighter/dist/esm/styles/prism/one-light"
    );
    themeCache.light = mod.default;
  }
  return themeCache.light;
};

// JSON 语言注册状态
let jsonRegistered = false;

const registerJsonLanguage = async () => {
  if (jsonRegistered) return true;
  try {
    const mod = await import(
      "react-syntax-highlighter/dist/esm/languages/prism/json"
    );
    SyntaxHighlighter.registerLanguage("json", mod.default);
    jsonRegistered = true;
    return true;
  } catch {
    return false;
  }
};

// ============== 类型定义 ==============

interface UsagePanelProps {
  /** 当前会话的消息列表 */
  messages: Message[];
}

/** 单条消息的使用量统计 */
interface MessageUsage {
  messageId: string;
  role: "user" | "assistant";
  timestamp: number;
  /** 消息内容预览（截取前50字符） */
  preview: string;
  /** Token 使用量（仅 assistant 消息有值） */
  tokens?: {
    input: number;
    output: number;
    reasoning: number;
    cache: {
      read: number;
      write: number;
    };
  };
  /** 费用（仅 assistant 消息有值） */
  cost?: number;
  /** 模型信息 */
  model?: string;
}

// ============== 辅助函数 ==============

/** 格式化 token 数量 */
const formatTokens = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
};

/** 格式化费用 */
const formatCost = (cost: number): string => {
  if (cost === 0) return "$0";
  if (cost < 0.0001) return "<$0.0001";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
};

/** 格式化时间 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** 从消息中提取文本预览 */
const extractPreview = (message: Message): string => {
  const textParts = message.parts.filter((p) => p.type === "text");
  if (textParts.length === 0) return "(无文本内容)";

  const text = textParts.map((p) => (p as { text: string }).text).join(" ");
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > 40 ? cleaned.slice(0, 40) + "..." : cleaned;
};

/** 判断是否为 assistant 消息 */
const isAssistantMessage = (
  info: Message["info"]
): info is AssistantMessageInfo => {
  return info.role === "assistant";
};

// ============== 组件 ==============

export function UsagePanel({ messages }: UsagePanelProps) {
  const { t } = useTranslation();
  const { isOpen, panelWidth, closePanel, setPanelWidth } =
    useUsagePanelStore();

  // 宽度拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // 展开状态
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // 处理宽度拖拽开始
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartX.current = e.clientX;
      dragStartWidth.current = panelWidth;
    },
    [panelWidth]
  );

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX.current;
      const newWidth = dragStartWidth.current + deltaX;
      const clampedWidth = Math.max(
        USAGE_PANEL_MIN_WIDTH,
        Math.min(USAGE_PANEL_MAX_WIDTH, newWidth)
      );
      setPanelWidth(clampedWidth);
    };

    const handleUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";

    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging, setPanelWidth]);

  // 解析消息使用量
  const usageList = useMemo((): MessageUsage[] => {
    return messages.map((msg) => {
      const info = msg.info;
      const usage: MessageUsage = {
        messageId: info.id,
        role: info.role as "user" | "assistant",
        timestamp: info.time.created,
        preview: extractPreview(msg),
      };

      if (isAssistantMessage(info)) {
        usage.tokens = info.tokens;
        usage.cost = info.cost;
        usage.model = info.modelID;
      }

      return usage;
    });
  }, [messages]);

  // 计算总计统计
  const totalStats = useMemo(() => {
    let totalInput = 0;
    let totalOutput = 0;
    let totalReasoning = 0;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;
    let totalCost = 0;
    let assistantCount = 0;

    usageList.forEach((usage) => {
      if (usage.tokens) {
        totalInput += usage.tokens.input;
        totalOutput += usage.tokens.output;
        totalReasoning += usage.tokens.reasoning;
        totalCacheRead += usage.tokens.cache.read;
        totalCacheWrite += usage.tokens.cache.write;
        assistantCount++;
      }
      if (usage.cost) {
        totalCost += usage.cost;
      }
    });

    // 计算上下文使用百分比（假设上下文限制为 200k tokens）
    const contextLimit = 200000;
    // 从后向前找到最后一个有 tokens 的 assistant 消息
    const lastAssistant = [...usageList]
      .reverse()
      .find(
        (u): u is MessageUsage & { tokens: NonNullable<MessageUsage["tokens"]> } =>
          !!u.tokens
      );
    const lastTotal = lastAssistant?.tokens
      ? lastAssistant.tokens.input +
        lastAssistant.tokens.output +
        lastAssistant.tokens.reasoning +
        lastAssistant.tokens.cache.read
      : 0;
    const contextPercentage = Math.round((lastTotal / contextLimit) * 100);

    return {
      totalInput,
      totalOutput,
      totalReasoning,
      totalCacheRead,
      totalCacheWrite,
      totalCost,
      messageCount: messages.length,
      assistantCount,
      lastTotal,
      contextPercentage,
    };
  }, [usageList, messages.length]);

  // 切换展开状态
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 不显示面板
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        // 布局
        "relative flex flex-col h-full",
        // 背景与边框
        "bg-background",
        "border-r border-border/50",
        // 动画
        "animate-in slide-in-from-left-4 duration-200 ease-out"
      )}
      style={{
        width: `${panelWidth}px`,
        minWidth: `${USAGE_PANEL_MIN_WIDTH}px`,
      }}
    >
      {/* 右侧拖拽手柄 */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize z-10",
          "hover:bg-primary/30 transition-colors duration-150",
          isDragging && "bg-primary/50"
        )}
        onMouseDown={handleDragStart}
      />

      {/* 面板标题栏 */}
      <div
        className={cn(
          "flex items-center h-[32px] px-2 shrink-0",
          "bg-sidebar border-b border-sidebar-border/40"
        )}
      >
        <BarChart3 className="h-4 w-4 text-muted-foreground/70 mr-2" />
        <span className="flex-1 text-xs font-medium text-foreground/90">
          {t("usagePanel.title", "使用量")}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-sidebar-accent"
          onClick={closePanel}
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      {/* 总计统计区域 - 紧凑设计 */}
      <div className="px-3 py-3 border-b border-border/30 bg-muted/20">
        {/* 顶部：进度环 + 主要统计 */}
        <div className="flex items-center gap-3 mb-2">
          {/* 进度环 + Tooltip */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-1.5 rounded-md hover:bg-accent/50 cursor-default transition-colors">
                <ProgressCircle
                  percentage={totalStats.contextPercentage}
                  size={24}
                  strokeWidth={3}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {formatTokens(totalStats.lastTotal)}
                  </span>
                  <span className="text-muted-foreground">Tokens</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {totalStats.contextPercentage}%
                  </span>
                  <span className="text-muted-foreground">Usage</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {formatCost(totalStats.totalCost)}
                  </span>
                  <span className="text-muted-foreground">Cost</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* 主要统计数字 */}
          <div className="flex-1 grid grid-cols-3 gap-1 text-xs">
            <div className="text-center">
              <div className="font-medium text-foreground">
                {totalStats.messageCount}
              </div>
              <div className="text-muted-foreground/60 text-[10px]">
                {t("usagePanel.messages", "消息")}
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium text-foreground">
                {formatTokens(totalStats.totalInput + totalStats.totalOutput)}
              </div>
              <div className="text-muted-foreground/60 text-[10px]">
                Tokens
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium text-foreground">
                {formatCost(totalStats.totalCost)}
              </div>
              <div className="text-muted-foreground/60 text-[10px]">
                {t("usagePanel.cost", "费用")}
              </div>
            </div>
          </div>
        </div>

        {/* 详细分项 */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
          <span>
            {t("usagePanel.inputTokens", "输入")}:{" "}
            {formatTokens(totalStats.totalInput)}
          </span>
          <span>·</span>
          <span>
            {t("usagePanel.outputTokens", "输出")}:{" "}
            {formatTokens(totalStats.totalOutput)}
          </span>
          {totalStats.totalCacheRead > 0 && (
            <>
              <span>·</span>
              <span>
                {t("usagePanel.cacheRead", "缓存")}:{" "}
                {formatTokens(totalStats.totalCacheRead)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 消息列表 - 可展开视图 */}
      <div className="flex-1 overflow-y-auto">
        {usageList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-12">
            <BarChart3 className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground/70 text-center">
              {t("usagePanel.empty", "暂无消息")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {usageList.map((usage, index) => (
              <MessageUsageRow
                key={usage.messageId}
                usage={usage}
                rawMessage={messages[index]}
                index={index + 1}
                isExpanded={expandedIds.has(usage.messageId)}
                onToggle={() => toggleExpand(usage.messageId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============== 子组件：消息行（可展开） ==============

interface MessageUsageRowProps {
  usage: MessageUsage;
  rawMessage: Message;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function MessageUsageRow({
  usage,
  rawMessage,
  index,
  isExpanded,
  onToggle,
}: MessageUsageRowProps) {
  const { t } = useTranslation();
  const isAssistant = usage.role === "assistant";
  const [copied, setCopied] = useState(false);

  // 格式化 JSON 字符串
  const jsonString = useMemo(() => {
    return JSON.stringify(rawMessage, null, 2);
  }, [rawMessage]);

  // 复制 JSON 到剪贴板
  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(jsonString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("复制失败:", err);
      }
    },
    [jsonString]
  );

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-left",
            "hover:bg-accent/50 transition-colors duration-150",
            "focus:outline-none focus:bg-accent/50"
          )}
        >
          {/* 展开/折叠图标 */}
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </span>

          {/* 序号 */}
          <span className="w-5 text-[10px] text-muted-foreground/50 text-right shrink-0">
            #{index}
          </span>

          {/* 角色标签 */}
          <span
            className={cn(
              "text-[10px] font-medium px-1 py-0.5 rounded shrink-0",
              isAssistant
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isAssistant
              ? t("usagePanel.assistant", "AI")
              : t("usagePanel.user", "U")}
          </span>

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            {/* Token 摘要（仅 assistant） */}
            {isAssistant && usage.tokens ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-foreground/80">
                  {formatTokens(usage.tokens.input)} /{" "}
                  {formatTokens(usage.tokens.output)}
                </span>
                {usage.cost !== undefined && usage.cost > 0 && (
                  <span className="text-muted-foreground/60">
                    {formatCost(usage.cost)}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-foreground/70 truncate block">
                {usage.preview}
              </span>
            )}
          </div>

          {/* 时间 */}
          <span className="text-[10px] text-muted-foreground/40 shrink-0">
            {formatTime(usage.timestamp)}
          </span>
        </button>
      </CollapsibleTrigger>

      {/* 展开的详细信息 */}
      <CollapsibleContent>
        <div className="px-3 pb-3 ml-6 border-l-2 border-border/30">
          {/* Token 详细统计（仅 assistant） */}
          {isAssistant && usage.tokens && (
            <div className="grid grid-cols-3 gap-2 py-2 mb-2 border-b border-border/20">
              <StatItem
                label={t("usagePanel.inputTokens", "输入")}
                value={formatTokens(usage.tokens.input)}
              />
              <StatItem
                label={t("usagePanel.outputTokens", "输出")}
                value={formatTokens(usage.tokens.output)}
              />
              {usage.tokens.reasoning > 0 && (
                <StatItem
                  label={t("usagePanel.reasoningTokens", "推理")}
                  value={formatTokens(usage.tokens.reasoning)}
                />
              )}
              {usage.tokens.cache.read > 0 && (
                <StatItem
                  label={t("usagePanel.cacheRead", "缓存")}
                  value={formatTokens(usage.tokens.cache.read)}
                />
              )}
              {usage.cost !== undefined && (
                <StatItem
                  label={t("usagePanel.cost", "费用")}
                  value={formatCost(usage.cost)}
                />
              )}
              {usage.model && (
                <StatItem
                  label={t("usagePanel.model", "模型")}
                  value={usage.model}
                />
              )}
            </div>
          )}

          {/* JSON 数据（带语法高亮） */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground/60">
                Raw JSON
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]",
                  "bg-muted/50 hover:bg-muted transition-colors",
                  "text-muted-foreground hover:text-foreground"
                )}
              >
                {copied ? (
                  <>
                    <Check className="h-2.5 w-2.5" />
                    {t("chat.copied", "已复制")}
                  </>
                ) : (
                  <>
                    <Copy className="h-2.5 w-2.5" />
                    {t("chat.copy", "复制")}
                  </>
                )}
              </button>
            </div>
            <div
              className={cn(
                "overflow-auto rounded p-2",
                "bg-muted/30 border border-border/30",
                "max-h-[200px]"
              )}
            >
              <JsonHighlighter json={jsonString} />
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============== 辅助组件 ==============

interface StatItemProps {
  label: string;
  value: string;
  className?: string;
}

function StatItem({ label, value, className }: StatItemProps) {
  return (
    <div className={cn("text-center", className)}>
      <div className="text-[11px] font-medium text-foreground">{value}</div>
      <div className="text-[9px] text-muted-foreground/60">{label}</div>
    </div>
  );
}

// ============== JSON 高亮组件 ==============

interface JsonHighlighterProps {
  json: string;
  className?: string;
}

/**
 * 轻量级 JSON 语法高亮组件
 * 使用 react-syntax-highlighter 的 PrismLight 版本，按需加载 JSON 语法
 */
const JsonHighlighter = memo(function JsonHighlighter({
  json,
  className,
}: JsonHighlighterProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [darkTheme, setDarkTheme] = useState<Record<
    string,
    React.CSSProperties
  > | null>(themeCache.dark);
  const [lightTheme, setLightTheme] = useState<Record<
    string,
    React.CSSProperties
  > | null>(themeCache.light);
  const [languageReady, setLanguageReady] = useState(jsonRegistered);

  // 加载主题和语言
  useEffect(() => {
    loadDarkTheme().then(setDarkTheme);
    loadLightTheme().then(setLightTheme);
    registerJsonLanguage().then(setLanguageReady);
  }, []);

  const currentTheme = isDark ? darkTheme : lightTheme;

  // 主题或语言未就绪时显示简单的 pre 标签
  if (!currentTheme || !languageReady) {
    return (
      <pre
        className={cn(
          "text-[10px] font-mono text-foreground/70 whitespace-pre-wrap break-all leading-relaxed",
          className
        )}
      >
        {json}
      </pre>
    );
  }

  return (
    <SyntaxHighlighter
      style={currentTheme}
      language="json"
      PreTag="div"
      customStyle={{
        margin: 0,
        padding: 0,
        background: "transparent",
        fontSize: "10px",
        lineHeight: "1.5",
      }}
      codeTagProps={{
        style: {
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        },
      }}
    >
      {json}
    </SyntaxHighlighter>
  );
});
