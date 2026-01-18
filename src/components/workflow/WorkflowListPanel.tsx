/**
 * 工作流列表面板
 * 
 * 显示所有工作流，支持创建、选择、删除工作流
 */

import { useEffect, useCallback } from "react";
import {
  Plus,
  Workflow,
  MoreHorizontal,
  Trash2,
  Copy,
  FileEdit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkflowStore } from "@/stores/workflow";
import type { WorkflowSummary } from "@/types/workflow";

// ============================================================================
// 类型定义
// ============================================================================

interface WorkflowListPanelProps {
  /** 创建新工作流 */
  onCreateWorkflow: () => void;
  /** 选择工作流 */
  onSelectWorkflow: (workflow: WorkflowSummary) => void;
  /** 当前选中的工作流 ID */
  selectedWorkflowId?: string;
}

// ============================================================================
// 辅助函数
// ============================================================================

/** 格式化更新时间 */
function formatUpdatedAt(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

/** 获取状态颜色 */
function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-500";
    case "draft":
      return "bg-amber-500";
    case "archived":
      return "bg-muted-foreground/50";
    default:
      return "bg-muted-foreground/50";
  }
}

// ============================================================================
// 组件
// ============================================================================

export function WorkflowListPanel({
  onCreateWorkflow,
  onSelectWorkflow,
  selectedWorkflowId,
}: WorkflowListPanelProps) {
  const {
    workflows,
    isLoading,
    loadWorkflows,
    deleteWorkflow,
    duplicateWorkflow,
  } = useWorkflowStore();

  // 加载工作流列表
  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  // 删除工作流
  const handleDelete = useCallback(
    async (e: React.MouseEvent, workflowId: string) => {
      e.stopPropagation();
      if (confirm("确定要删除此工作流吗？")) {
        await deleteWorkflow(workflowId);
      }
    },
    [deleteWorkflow]
  );

  // 复制工作流
  const handleDuplicate = useCallback(
    async (e: React.MouseEvent, workflowId: string) => {
      e.stopPropagation();
      const duplicate = await duplicateWorkflow(workflowId);
      if (duplicate) {
        onSelectWorkflow({
          id: duplicate.id,
          name: duplicate.name,
          description: duplicate.description,
          icon: duplicate.icon,
          color: duplicate.color,
          status: duplicate.status,
          subagentCount: duplicate.subagents.length,
          updatedAt: duplicate.updatedAt,
        });
      }
    },
    [duplicateWorkflow, onSelectWorkflow]
  );

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border/40">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-muted-foreground/70" />
          <span className="text-sm font-medium text-foreground/90">工作流</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-sidebar-accent"
          onClick={onCreateWorkflow}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-muted-foreground/50">加载中...</span>
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Workflow className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground/60 text-center mb-4">
              暂无工作流
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateWorkflow}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              创建工作流
            </Button>
          </div>
        ) : (
          <div className="space-y-0.5 px-1">
            {workflows.map((workflow) => (
              <WorkflowListItem
                key={workflow.id}
                workflow={workflow}
                isSelected={workflow.id === selectedWorkflowId}
                onClick={() => onSelectWorkflow(workflow)}
                onDelete={(e) => handleDelete(e, workflow.id)}
                onDuplicate={(e) => handleDuplicate(e, workflow.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 列表项组件
// ============================================================================

interface WorkflowListItemProps {
  workflow: WorkflowSummary;
  isSelected: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
}

function WorkflowListItem({
  workflow,
  isSelected,
  onClick,
  onDelete,
  onDuplicate,
}: WorkflowListItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer",
        "transition-colors duration-150",
        isSelected
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/50"
      )}
      onClick={onClick}
    >
      {/* 图标 */}
      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted/50 shrink-0">
        {workflow.icon ? (
          <span className="text-base">{workflow.icon}</span>
        ) : (
          <Workflow className="w-4 h-4 text-muted-foreground/70" />
        )}
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{workflow.name}</span>
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              getStatusColor(workflow.status)
            )}
          />
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground/60">
          <span>{workflow.subagentCount} 个子 Agent</span>
          <span>·</span>
          <span>{formatUpdatedAt(workflow.updatedAt)}</span>
        </div>
      </div>

      {/* 操作菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 shrink-0",
              "opacity-0 group-hover:opacity-100",
              "transition-opacity duration-150"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={onClick}>
            <FileEdit className="w-4 h-4 mr-2" />
            编辑
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="w-4 h-4 mr-2" />
            复制
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
