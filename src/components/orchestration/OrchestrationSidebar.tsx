/**
 * 编排侧边栏组件
 * 
 * 显示编排页面的工具和工作流列表：
 * - 节点类型选择
 * - 工作流列表
 * - 新建/保存操作
 */

import { useTranslation } from "react-i18next";
import { Plus, Save, Bot, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOrchestrationStore } from "@/stores/orchestration";

// 工具栏节点类型 (labels 使用 i18n key)
const NODE_TYPES = [
  { type: "agent", icon: Bot, labelKey: "orchestration.nodes.agent", description: "AI 代理节点" },
] as const;

interface OrchestrationSidebarProps {
  onAddNode: (type: string) => void;
  onNewWorkflow: () => void;
  onSave: () => void;
}

export function OrchestrationSidebar({
  onAddNode,
  onNewWorkflow,
  onSave,
}: OrchestrationSidebarProps) {
  const { t } = useTranslation();
  const {
    currentWorkflow,
    workflows,
    hasUnsavedChanges,
    loadWorkflow,
  } = useOrchestrationStore();

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* 标题栏 */}
      <div className="flex items-center justify-between h-9 px-3 border-b border-sidebar-border/50">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground/80">
            {t("orchestration.title", "工作流编排")}
          </span>
        </div>
        
        {/* 操作按钮 */}
        <div className="flex items-center gap-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onNewWorkflow}
                  className={cn(
                    "w-6 h-6 flex items-center justify-center",
                    "text-muted-foreground/70 hover:text-foreground",
                    "hover:bg-accent rounded transition-colors duration-150"
                  )}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t("orchestration.newWorkflow", "新建工作流")}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onSave}
                  disabled={!currentWorkflow || !hasUnsavedChanges}
                  className={cn(
                    "w-6 h-6 flex items-center justify-center",
                    "text-muted-foreground/70 hover:text-foreground",
                    "hover:bg-accent rounded transition-colors duration-150",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Save className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t("orchestration.save", "保存")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* 节点类型区域 */}
      <div className="px-3 py-2 border-b border-sidebar-border/50">
        <div className="text-xs text-muted-foreground/70 mb-2">
          {t("orchestration.nodeTypes", "节点类型")}
        </div>
        <div className="flex flex-col gap-1">
          {NODE_TYPES.map(({ type, icon: Icon, labelKey, description }) => (
            <button
              key={type}
              onClick={() => onAddNode(type)}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 w-full",
                "text-muted-foreground/70 hover:text-foreground",
                "hover:bg-accent rounded transition-colors duration-150",
                "text-left"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium">{t(labelKey)}</span>
                <span className="text-[10px] text-muted-foreground/60 truncate">
                  {description}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 工作流列表 */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <div className="text-xs text-muted-foreground/70 mb-2">
            {t("orchestration.workflows", "工作流列表")}
          </div>
          
          {workflows.length === 0 ? (
            <div className="text-xs text-muted-foreground/50 text-center py-4">
              {t("orchestration.noWorkflows", "暂无工作流")}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {workflows.map((workflow) => (
                <button
                  key={workflow.id}
                  onClick={() => loadWorkflow(workflow.id)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 w-full",
                    "text-left rounded transition-colors duration-150",
                    currentWorkflow?.id === workflow.id
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground/70 hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <Workflow className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs truncate">{workflow.name}</span>
                  {currentWorkflow?.id === workflow.id && hasUnsavedChanges && (
                    <span className="text-muted-foreground ml-auto">*</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部提示 */}
      {!currentWorkflow && (
        <div className="px-3 py-3 border-t border-sidebar-border/50">
          <Button onClick={onNewWorkflow} size="sm" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            {t("orchestration.newWorkflow", "新建工作流")}
          </Button>
        </div>
      )}
    </div>
  );
}
