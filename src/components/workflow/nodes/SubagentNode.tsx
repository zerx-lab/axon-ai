/**
 * 子 Agent 节点组件
 * 
 * 代表被主 Agent 委托调用的子代理
 * - 显示 Agent 名称、类型和触发条件
 * - 顶部有输入连接点，接收主 Agent 的委托
 * - 可选：底部有输出连接点（如果支持嵌套委托）
 */

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  Bot,
  Zap,
  Eye,
  EyeOff,
  Settings,
  Play,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubagentConfig, SubagentTrigger } from "@/types/agent";

// ============================================================================
// 类型定义
// ============================================================================

export interface SubagentNodeData extends Record<string, unknown> {
  /** 子 Agent 配置 */
  config: SubagentConfig;
  /** Agent 名称 */
  name: string;
  /** Agent 描述 */
  description?: string;
  /** Agent 类型/类别 */
  category?: string;
  /** 是否被选中 */
  isSelected: boolean;
  /** 委托规则数量 */
  ruleCount: number;
  /** 点击配置按钮 */
  onConfigClick?: () => void;
  /** 切换启用状态 */
  onToggleEnabled?: () => void;
}

export type SubagentNodeType = Node<SubagentNodeData, "subagent">;

// ============================================================================
// 辅助函数
// ============================================================================

/** 获取类别对应的颜色 */
function getCategoryColor(category?: string): string {
  const colors: Record<string, string> = {
    exploration: "text-blue-500 bg-blue-500/10",
    specialist: "text-purple-500 bg-purple-500/10",
    advisor: "text-amber-500 bg-amber-500/10",
    utility: "text-emerald-500 bg-emerald-500/10",
    orchestrator: "text-rose-500 bg-rose-500/10",
  };
  return colors[category || "utility"] || "text-muted-foreground bg-muted";
}

/** 获取类别显示名称 */
function getCategoryLabel(category?: string): string {
  const labels: Record<string, string> = {
    exploration: "探索",
    specialist: "专家",
    advisor: "顾问",
    utility: "工具",
    orchestrator: "编排",
  };
  return labels[category || "utility"] || "通用";
}

function formatTriggers(triggers: SubagentTrigger[]): string {
  if (triggers.length === 0) return "无触发条件";
  if (triggers.length === 1) return triggers[0].description || triggers[0].pattern;
  return `${triggers.length} 个触发条件`;
}

// ============================================================================
// 组件
// ============================================================================

function SubagentNodeComponent({ data }: NodeProps<SubagentNodeType>) {
  const { config, name, description, category, isSelected, ruleCount } = data;
  const categoryColor = getCategoryColor(category);
  const isEnabled = config.enabled;
  
  return (
    <div
      className={cn(
        // 基础样式
        "relative min-w-[180px] max-w-[240px]",
        "bg-background border rounded-lg",
        "shadow-sm",
        "transition-all duration-150",
        
        // 启用/禁用状态
        isEnabled
          ? "border-border/80"
          : "border-dashed border-muted-foreground/30 opacity-60",
        
        // 选中状态
        isSelected && "border-primary ring-2 ring-primary/20",
        
        // 悬浮效果
        isEnabled && "hover:shadow-md hover:border-border"
      )}
    >
      {/* 输入连接点（顶部，接收主 Agent 委托） */}
      <Handle
        type="target"
        position={Position.Top}
        className={cn(
          "!w-2.5 !h-2.5 !border-2",
          isEnabled
            ? "!bg-muted-foreground/50 !border-background"
            : "!bg-muted-foreground/30 !border-background"
        )}
      />
      
      {/* 头部区域 */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {/* 图标 */}
        <div className={cn(
          "flex items-center justify-center",
          "w-8 h-8 rounded-md",
          categoryColor
        )}>
          <Bot className="w-4 h-4" />
        </div>
        
        {/* 名称和类别 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "text-sm font-medium truncate",
              isEnabled ? "text-foreground" : "text-muted-foreground"
            )}>
              {name}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded",
              categoryColor
            )}>
              {getCategoryLabel(category)}
            </span>
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="flex items-center gap-0.5">
          {/* 启用/禁用按钮 */}
          {data.onToggleEnabled && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onToggleEnabled?.();
              }}
              className={cn(
                "flex items-center justify-center",
                "w-6 h-6 rounded",
                "transition-colors duration-150",
                isEnabled
                  ? "text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                  : "text-muted-foreground/50 hover:bg-accent hover:text-muted-foreground"
              )}
              title={isEnabled ? "禁用此 Agent" : "启用此 Agent"}
            >
              {isEnabled ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          
          {/* 配置按钮 */}
          {data.onConfigClick && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onConfigClick?.();
              }}
              className={cn(
                "flex items-center justify-center",
                "w-6 h-6 rounded",
                "text-muted-foreground/70",
                "hover:bg-accent hover:text-foreground",
                "transition-colors duration-150"
              )}
              title="配置"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      
      {/* 描述（可选） */}
      {description && (
        <div className="px-3 pb-2">
          <p className={cn(
            "text-[11px] line-clamp-2",
            isEnabled ? "text-muted-foreground/70" : "text-muted-foreground/50"
          )}>
            {description}
          </p>
        </div>
      )}
      
      {/* 底部信息栏 */}
      <div className={cn(
        "flex items-center justify-between gap-2",
        "px-3 py-1.5",
        "border-t border-border/50",
        "bg-muted/20 rounded-b-lg"
      )}>
        {/* 触发条件 */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
          <Zap className="w-3 h-3" />
          <span>{formatTriggers(config.triggers)}</span>
        </div>
        
        {/* 委托规则数量 */}
        {ruleCount > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <GitBranch className="w-3 h-3" />
            <span>{ruleCount}</span>
          </div>
        )}
        
        {/* 后台运行标记 */}
        {config.runInBackground && (
          <div className="flex items-center gap-1 text-[10px] text-blue-500/70">
            <Play className="w-3 h-3" />
            <span>后台</span>
          </div>
        )}
      </div>
    </div>
  );
}

export const SubagentNode = memo(SubagentNodeComponent);
