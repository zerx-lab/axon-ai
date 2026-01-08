/**
 * ThinkingIndicator 组件
 * 
 * 显示 AI 推理过程状态提示，类似 opencode 的 "Gathering thoughts · 1.8秒"
 * 参考: opencode/packages/ui/src/components/session-turn.tsx
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { Part, ToolPart } from "@/types/chat";

/** 推理状态类型 */
export type ThinkingStatus = 
  | "gathering"    // 收集思路（text part 生成中）
  | "thinking"     // 深度思考（reasoning part）
  | "searching"    // 搜索代码库
  | "reading"      // 读取文件
  | "editing"      // 编辑文件
  | "running"      // 运行命令
  | "delegating"   // 委派子任务
  | "planning"     // 规划任务
  | "fetching"     // 获取网页
  | "considering"; // 默认状态

interface ThinkingIndicatorProps {
  /** 消息的 parts */
  parts: Part[];
  /** 消息创建时间（用于计算持续时间） */
  startTime: number;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 根据最后一个 part 计算当前状态
 * 参考 opencode 的 computeStatusFromPart 函数
 */
function computeStatusFromPart(part: Part | undefined): ThinkingStatus {
  if (!part) return "considering";

  if (part.type === "tool") {
    const toolPart = part as ToolPart;
    switch (toolPart.tool) {
      case "task":
        return "delegating";
      case "todowrite":
      case "todoread":
        return "planning";
      case "read":
        return "reading";
      case "list":
      case "grep":
      case "glob":
        return "searching";
      case "webfetch":
      case "websearch":
        return "fetching";
      case "edit":
      case "write":
      case "multiedit":
        return "editing";
      case "bash":
        return "running";
      default:
        return "considering";
    }
  }

  if (part.type === "reasoning") {
    return "thinking";
  }

  if (part.type === "text") {
    return "gathering";
  }

  return "considering";
}

/**
 * 格式化持续时间
 */
function formatDuration(startTime: number): string {
  const elapsed = Date.now() - startTime;
  const seconds = Math.floor(elapsed / 1000);
  
  if (seconds < 60) {
    return `${seconds}秒`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (remainingSeconds === 0) {
    return `${minutes}分钟`;
  }
  
  return `${minutes}分${remainingSeconds}秒`;
}

/**
 * ThinkingIndicator 组件
 * 显示 AI 当前的推理/工作状态和持续时间
 */
export function ThinkingIndicator({
  parts,
  startTime,
  isLoading,
  className,
}: ThinkingIndicatorProps) {
  const { t } = useTranslation();
  const [duration, setDuration] = useState(() => formatDuration(startTime));
  const [status, setStatus] = useState<ThinkingStatus>("considering");

  // 更新持续时间
  useEffect(() => {
    if (!isLoading) return;

    const timer = setInterval(() => {
      setDuration(formatDuration(startTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime, isLoading]);

  // 计算当前状态（带防抖，避免状态频繁切换）
  useEffect(() => {
    if (!isLoading) return;

    // 获取最后一个 part
    const lastPart = parts[parts.length - 1];
    const newStatus = computeStatusFromPart(lastPart);

    // 状态变化时有短暂延迟，避免闪烁
    const timer = setTimeout(() => {
      setStatus(newStatus);
    }, 100);

    return () => clearTimeout(timer);
  }, [parts, isLoading]);

  // 如果不在加载状态，不显示
  if (!isLoading) {
    return null;
  }

  // 获取状态文本
  const statusText = t(`chat.thinkingStatus.${status}`);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2",
        "px-3 py-1.5 rounded-lg",
        "bg-muted/50 border border-border/50",
        "text-sm text-muted-foreground",
        className
      )}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      <span>{statusText}</span>
      <span className="text-muted-foreground/70">·</span>
      <span className="tabular-nums">{duration}</span>
    </div>
  );
}

export default ThinkingIndicator;
