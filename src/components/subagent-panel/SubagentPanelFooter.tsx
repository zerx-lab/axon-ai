/**
 * Subagent 面板底部统计栏
 *
 * 显示工具调用数量、token 使用量和费用
 */

import { cn } from "@/lib/utils";
import type { Message } from "@/types/chat";
import { useSubagentStats } from "@/hooks/useSubagentSession";

interface SubagentPanelFooterProps {
  messages: Message[];
  toolCallCount?: number;
}

export function SubagentPanelFooter({
  messages,
  toolCallCount: overrideCount,
}: SubagentPanelFooterProps) {
  const stats = useSubagentStats(messages);

  // 使用 override 或计算的值
  const toolCallCount = overrideCount ?? stats.toolCallCount;

  // 格式化 token 数量
  const formatTokens = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  // 格式化费用
  const formatCost = (cost: number) => {
    if (cost === 0) return null;
    if (cost < 0.0001) return "<$0.0001";
    return `$${cost.toFixed(4)}`;
  };

  const formattedCost = formatCost(stats.cost);

  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-2",
        "border-t border-border/30 bg-muted/20",
        "text-xs text-muted-foreground"
      )}
    >
      <div className="flex items-center gap-3">
        <span>{toolCallCount} 工具调用</span>
        <span className="text-muted-foreground/50">·</span>
        <span>
          {formatTokens(stats.tokens.input)} / {formatTokens(stats.tokens.output)}{" "}
          tokens
        </span>
      </div>

      {formattedCost && <span>{formattedCost}</span>}
    </div>
  );
}
