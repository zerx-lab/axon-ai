/**
 * 主 Agent 节点组件
 * 
 * 工作流的入口节点，代表主编排 Agent
 * - 居中显示，较大尺寸
 * - 显示 Agent 名称和描述
 * - 底部有输出连接点，连接到子 Agent
 */

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Bot, Crown, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CanvasNodePosition } from "@/types/agent";

interface PrimaryAgentConfig {
  mode: "reference" | "inline";
  inline?: { name?: string; description?: string };
  position: CanvasNodePosition;
}

// ============================================================================
// 类型定义
// ============================================================================

export interface PrimaryAgentNodeData extends Record<string, unknown> {
  /** 主 Agent 配置 */
  config: PrimaryAgentConfig;
  /** Agent 名称（从配置中提取或引用的 Agent） */
  name: string;
  /** Agent 描述 */
  description?: string;
  /** 是否被选中 */
  isSelected: boolean;
  /** 点击配置按钮 */
  onConfigClick?: () => void;
}

export type PrimaryAgentNodeType = Node<PrimaryAgentNodeData, "primaryAgent">;

// ============================================================================
// 组件
// ============================================================================

function PrimaryAgentNodeComponent({ data }: NodeProps<PrimaryAgentNodeType>) {
  return (
    <div
      className={cn(
        // 基础样式
        "relative min-w-[220px] max-w-[280px]",
        "bg-background border-2 rounded-lg",
        "shadow-md",
        "transition-all duration-150",
        
        // 选中状态
        data.isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-primary/60",
        
        // 悬浮效果
        "hover:shadow-lg"
      )}
    >
      {/* 顶部装饰条 */}
      <div className="absolute -top-px left-4 right-4 h-1 bg-primary rounded-b-sm" />
      
      {/* 头部区域 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        {/* 图标 */}
        <div className={cn(
          "flex items-center justify-center",
          "w-10 h-10 rounded-lg",
          "bg-primary/10"
        )}>
          <Crown className="w-5 h-5 text-primary" />
        </div>
        
        {/* 名称和类型 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground truncate">
              {data.name}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Bot className="w-3 h-3 text-muted-foreground/70" />
            <span className="text-xs text-muted-foreground/70">
              主编排 Agent
            </span>
          </div>
        </div>
        
        {/* 配置按钮 */}
        {data.onConfigClick && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onConfigClick?.();
            }}
            className={cn(
              "flex items-center justify-center",
              "w-7 h-7 rounded-md",
              "text-muted-foreground/70",
              "hover:bg-accent hover:text-foreground",
              "transition-colors duration-150"
            )}
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* 描述区域 */}
      {data.description && (
        <div className="px-4 py-2.5">
          <p className="text-xs text-muted-foreground/80 line-clamp-2">
            {data.description}
          </p>
        </div>
      )}
      
      {/* 底部信息 */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 rounded-b-lg">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
          {data.config.mode === "reference" ? "引用" : "内联"}
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          入口节点
        </span>
      </div>
      
      {/* 输出连接点（底部，连接到子 Agent） */}
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(
          "!w-3 !h-3 !bg-primary !border-2 !border-background",
          "!-bottom-1.5"
        )}
      />
    </div>
  );
}

export const PrimaryAgentNode = memo(PrimaryAgentNodeComponent);
