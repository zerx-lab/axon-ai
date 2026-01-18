/**
 * 工作流编辑面板
 * 
 * 右侧配置面板，根据画布选中状态显示不同的编辑内容：
 * - 未选中：显示工作流基本信息和委托规则
 * - 选中主 Agent：显示主 Agent 配置
 * - 选中子 Agent：显示子 Agent 配置
 */

import { useState, useCallback, useMemo } from "react";
import {
  X,
  Save,
  Workflow,
  Crown,
  Bot,
  Settings2,
  FileText,
  Trash2,
  ChevronDown,
  Check,
  AlertCircle,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkflowStore } from "@/stores/workflow";
import { useOrchestrationStore } from "@/stores/orchestration";
import { DelegationRuleEditor } from "./DelegationRuleEditor";
import { exportWorkflowToOpenCode, getExportFileName } from "@/utils/workflowExport";
import type { AgentDefinition } from "@/types/agent";
import type {
  WorkflowDefinition,
  WorkflowStatus,
  SubagentConfig,
  PrimaryAgentMode,
} from "@/types/workflow";

// ============================================================================
// 类型定义
// ============================================================================

interface WorkflowEditorPanelProps {
  /** 关闭面板回调 */
  onClose?: () => void;
}

// ============================================================================
// 常量
// ============================================================================

/** 预设图标 */
const PRESET_ICONS = ["🤖", "🧠", "⚡", "🎯", "🔧", "📋", "🌐", "💡"];

/** 预设颜色 */
const PRESET_COLORS = [
  { value: "#3B82F6", label: "蓝色" },
  { value: "#9333EA", label: "紫色" },
  { value: "#0EA5E9", label: "青色" },
  { value: "#10B981", label: "绿色" },
  { value: "#F59E0B", label: "琥珀" },
  { value: "#EF4444", label: "红色" },
  { value: "#6366F1", label: "靛蓝" },
  { value: "#EC4899", label: "粉色" },
];

/** 状态选项 */
const STATUS_OPTIONS: { value: WorkflowStatus; label: string; color: string }[] = [
  { value: "draft", label: "草稿", color: "text-amber-500" },
  { value: "active", label: "激活", color: "text-emerald-500" },
  { value: "archived", label: "归档", color: "text-muted-foreground" },
];

// ============================================================================
// 主组件
// ============================================================================

export function WorkflowEditorPanel({ onClose }: WorkflowEditorPanelProps) {
  const {
    currentWorkflow,
    selection,
    hasUnsavedChanges,
    updateWorkflowInfo,
    updatePrimaryAgent,
    updateSubagent,
    removeSubagent,
    updateDelegationRuleset,
    saveCurrentWorkflow,
    getSubagentById,
  } = useWorkflowStore();

  const [isSaving, setIsSaving] = useState(false);
  const { agents } = useOrchestrationStore();

  // 保存工作流
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveCurrentWorkflow();
    } finally {
      setIsSaving(false);
    }
  }, [saveCurrentWorkflow]);

  // 导出为 OpenCode 格式
  const handleExport = useCallback(() => {
    if (!currentWorkflow) return;
    
    const agentsMap = new Map<string, AgentDefinition>();
    for (const agent of agents) {
      agentsMap.set(agent.id, agent);
    }
    
    const config = exportWorkflowToOpenCode(currentWorkflow, agentsMap);
    const fileName = getExportFileName(currentWorkflow);
    
    const blob = new Blob([config], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentWorkflow, agents]);

  // 如果没有当前工作流，显示空状态
  if (!currentWorkflow) {
    return (
      <div className="flex flex-col h-full bg-sidebar border-l border-sidebar-border/50">
        <div className="flex items-center justify-center h-full">
          <div className="text-center px-4">
            <Workflow className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground/60">
              选择一个工作流开始编辑
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 根据选中状态渲染不同的面板内容
  const renderContent = () => {
    switch (selection.type) {
      case "primary":
        return (
          <PrimaryAgentEditor
            workflow={currentWorkflow}
            onUpdatePrimaryAgent={updatePrimaryAgent}
          />
        );
      case "subagent":
        const subagent = selection.id ? getSubagentById(selection.id) : undefined;
        if (!subagent) return null;
        return (
          <SubagentEditor
            subagent={subagent}
            onUpdate={(updates) => updateSubagent(subagent.id, updates)}
            onRemove={() => removeSubagent(subagent.id)}
          />
        );
      default:
        return (
          <WorkflowInfoEditor
            workflow={currentWorkflow}
            onUpdateInfo={updateWorkflowInfo}
            onUpdateRuleset={updateDelegationRuleset}
          />
        );
    }
  };

  // 获取面板标题
  const getPanelTitle = () => {
    switch (selection.type) {
      case "primary":
        return "主 Agent";
      case "subagent":
        const subagent = selection.id ? getSubagentById(selection.id) : undefined;
        return subagent?.name || "子 Agent";
      default:
        return currentWorkflow.name;
    }
  };

  // 获取面板图标
  const getPanelIcon = () => {
    switch (selection.type) {
      case "primary":
        return <Crown className="w-4 h-4 text-amber-500" />;
      case "subagent":
        return <Bot className="w-4 h-4 text-blue-500" />;
      default:
        return currentWorkflow.icon ? (
          <span className="text-base">{currentWorkflow.icon}</span>
        ) : (
          <Workflow className="w-4 h-4" style={{ color: currentWorkflow.color }} />
        );
    }
  };

  return (
    <div className="flex flex-col h-full w-[360px] bg-sidebar border-l border-sidebar-border/50">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-sidebar-border/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {getPanelIcon()}
          <span className="text-sm font-medium truncate">{getPanelTitle()}</span>
          {hasUnsavedChanges && (
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              "w-6 h-6 flex items-center justify-center rounded shrink-0",
              "text-muted-foreground/70 hover:text-foreground",
              "hover:bg-accent transition-colors duration-150"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 内容区域 */}
      <ScrollArea className="flex-1">
        <div className="p-4">{renderContent()}</div>
      </ScrollArea>

      {/* 底部按钮 */}
      <div className="border-t border-sidebar-border/50 p-4 shrink-0 space-y-2">
        <Button
          onClick={handleSave}
          disabled={!hasUnsavedChanges || isSaving}
          className="w-full h-9"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "保存中..." : "保存工作流"}
        </Button>
        <Button
          variant="outline"
          onClick={handleExport}
          className="w-full h-9"
        >
          <Download className="w-4 h-4 mr-2" />
          导出为 OpenCode 配置
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// 工作流信息编辑器
// ============================================================================

interface WorkflowInfoEditorProps {
  workflow: WorkflowDefinition;
  onUpdateInfo: (updates: Partial<Pick<WorkflowDefinition, "name" | "description" | "icon" | "color" | "status">>) => void;
  onUpdateRuleset: (updates: Partial<WorkflowDefinition["delegationRuleset"]>) => void;
}

function WorkflowInfoEditor({
  workflow,
  onUpdateInfo,
  onUpdateRuleset,
}: WorkflowInfoEditorProps) {
  return (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="grid w-full grid-cols-2 h-8 p-0.5 bg-muted/50">
        <TabsTrigger value="basic" className="text-xs gap-1.5">
          <Settings2 className="w-3 h-3" />
          基本信息
        </TabsTrigger>
        <TabsTrigger value="delegation" className="text-xs gap-1.5">
          <FileText className="w-3 h-3" />
          委托规则
        </TabsTrigger>
      </TabsList>

      {/* 基本信息 Tab */}
      <TabsContent value="basic" className="space-y-4 mt-4">
        {/* 名称 */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/70">名称</Label>
          <Input
            value={workflow.name}
            onChange={(e) => onUpdateInfo({ name: e.target.value })}
            placeholder="工作流名称"
            className="h-8 text-sm"
          />
        </div>

        {/* 描述 */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/70">描述</Label>
          <Textarea
            value={workflow.description}
            onChange={(e) => onUpdateInfo({ description: e.target.value })}
            placeholder="工作流描述"
            className="min-h-[80px] text-sm resize-none"
          />
        </div>

        {/* 图标选择 */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/70">图标</Label>
          <div className="grid grid-cols-8 gap-1.5">
            {PRESET_ICONS.map((icon) => (
              <button
                key={icon}
                onClick={() => onUpdateInfo({ icon })}
                className={cn(
                  "h-8 flex items-center justify-center rounded border transition-colors duration-150",
                  workflow.icon === icon
                    ? "border-border bg-accent"
                    : "border-border/60 hover:bg-accent/50"
                )}
              >
                <span className="text-base">{icon}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 颜色选择 */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/70">颜色</Label>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_COLORS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onUpdateInfo({ color: value })}
                className={cn(
                  "h-8 flex items-center justify-center rounded border transition-colors duration-150",
                  workflow.color === value
                    ? "border-border ring-2 ring-offset-2 ring-offset-background"
                    : "border-border/60"
                )}
                style={{
                  backgroundColor: `${value}20`,
                  borderColor: workflow.color === value ? value : undefined,
                }}
                title={label}
              >
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: value }} />
              </button>
            ))}
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* 状态 */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/70">状态</Label>
          <Select
            value={workflow.status}
            onValueChange={(value: WorkflowStatus) => onUpdateInfo({ status: value })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className={option.color}>{option.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 统计信息 */}
        <div className="p-3 rounded-md bg-muted/30 border border-border/40 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground/60">子 Agent 数量</span>
            <span className="font-mono">{workflow.subagents.length}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground/60">委托规则数量</span>
            <span className="font-mono">{workflow.delegationRuleset.rules.length}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground/60">版本</span>
            <span className="font-mono">v{workflow.version}</span>
          </div>
        </div>
      </TabsContent>

      {/* 委托规则 Tab */}
      <TabsContent value="delegation" className="mt-4">
        <DelegationRuleEditor
          ruleset={workflow.delegationRuleset}
          subagents={workflow.subagents}
          onChange={(ruleset) => onUpdateRuleset(ruleset)}
        />
      </TabsContent>
    </Tabs>
  );
}

// ============================================================================
// 主 Agent 编辑器
// ============================================================================

interface PrimaryAgentEditorProps {
  workflow: WorkflowDefinition;
  onUpdatePrimaryAgent: (updates: Partial<WorkflowDefinition["primaryAgent"]>) => void;
}

function PrimaryAgentEditor({
  workflow,
  onUpdatePrimaryAgent,
}: PrimaryAgentEditorProps) {
  const { agents } = useOrchestrationStore();
  const primaryAgent = workflow.primaryAgent;

  // 获取引用的 Agent 名称
  const referencedAgentName = useMemo(() => {
    if (primaryAgent.mode !== "reference" || !primaryAgent.agentId) return null;
    const agent = agents.find((a) => a.id === primaryAgent.agentId);
    return agent?.name || primaryAgent.agentId;
  }, [primaryAgent, agents]);

  return (
    <div className="space-y-4">
      {/* 配置模式 */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground/70">配置模式</Label>
        <Select
          value={primaryAgent.mode}
          onValueChange={(value: PrimaryAgentMode) =>
            onUpdatePrimaryAgent({ mode: value })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inline">
              <div className="flex flex-col">
                <span>内联定义</span>
                <span className="text-[10px] text-muted-foreground/60">
                  在此工作流中定义主 Agent
                </span>
              </div>
            </SelectItem>
            <SelectItem value="reference">
              <div className="flex flex-col">
                <span>引用现有</span>
                <span className="text-[10px] text-muted-foreground/60">
                  引用已定义的 Agent
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {primaryAgent.mode === "reference" ? (
        // 引用模式：选择现有 Agent
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/70">选择 Agent</Label>
          {agents.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 border border-border/40">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-xs text-muted-foreground/60">
                暂无可用 Agent，请先创建
              </span>
            </div>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex items-center justify-between w-full h-8 px-3",
                    "text-sm rounded-sm border border-input bg-background",
                    "hover:bg-accent/50 transition-colors",
                    "focus:outline-none focus:ring-1 focus:ring-ring"
                  )}
                >
                  <span
                    className={cn(
                      "truncate",
                      !primaryAgent.agentId && "text-muted-foreground"
                    )}
                  >
                    {referencedAgentName || "选择 Agent..."}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="搜索 Agent..." />
                  <CommandList>
                    <CommandEmpty>未找到 Agent</CommandEmpty>
                    <CommandGroup>
                      {agents.map((agent) => {
                        const isSelected = primaryAgent.agentId === agent.id;
                        return (
                          <CommandItem
                            key={agent.id}
                            value={agent.id}
                            onSelect={() => {
                              onUpdatePrimaryAgent({ agentId: agent.id });
                            }}
                          >
                            <div
                              className={cn(
                                "flex items-center justify-center h-3.5 w-3.5 shrink-0 mr-2",
                                "rounded-sm border",
                                isSelected
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-input bg-transparent"
                              )}
                            >
                              {isSelected && <Check className="h-2.5 w-2.5" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="truncate text-xs">{agent.name}</span>
                              <span className="text-[10px] text-muted-foreground/60 truncate">
                                {agent.description}
                              </span>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>
      ) : (
        // 内联模式：直接编辑
        <>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground/70">名称</Label>
            <Input
              value={primaryAgent.inline?.name || ""}
              onChange={(e) =>
                onUpdatePrimaryAgent({
                  inline: { ...primaryAgent.inline, name: e.target.value },
                })
              }
              placeholder="主 Agent 名称"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground/70">描述</Label>
            <Textarea
              value={primaryAgent.inline?.description || ""}
              onChange={(e) =>
                onUpdatePrimaryAgent({
                  inline: { ...primaryAgent.inline, description: e.target.value },
                })
              }
              placeholder="主 Agent 描述"
              className="min-h-[80px] text-sm resize-none"
            />
          </div>
        </>
      )}

      <Separator className="bg-border/50" />

      {/* 位置信息 */}
      <div className="p-3 rounded-md bg-muted/30 border border-border/40">
        <p className="text-[10px] text-muted-foreground/50 mb-2">画布位置</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/60">X:</span>
            <span className="text-xs font-mono">{Math.round(primaryAgent.position.x)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/60">Y:</span>
            <span className="text-xs font-mono">{Math.round(primaryAgent.position.y)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 子 Agent 编辑器
// ============================================================================

interface SubagentEditorProps {
  subagent: SubagentConfig;
  onUpdate: (updates: Partial<SubagentConfig>) => void;
  onRemove: () => void;
}

function SubagentEditor({ subagent, onUpdate, onRemove }: SubagentEditorProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { agents } = useOrchestrationStore();

  // 获取引用的 Agent
  const referencedAgent = useMemo(() => {
    return agents.find((a) => a.id === subagent.agentId);
  }, [agents, subagent.agentId]);

  return (
    <>
      <div className="space-y-4">
        {/* 启用状态 */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs text-muted-foreground/70">启用状态</Label>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
              禁用后不会被委托任务
            </p>
          </div>
          <Switch
            checked={subagent.enabled}
            onCheckedChange={(enabled) => onUpdate({ enabled })}
          />
        </div>

        <Separator className="bg-border/50" />

        {/* 引用的 Agent */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/70">引用 Agent</Label>
          <div className="p-3 rounded-md bg-muted/30 border border-border/40">
            {referencedAgent ? (
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{referencedAgent.name}</p>
                  <p className="text-[10px] text-muted-foreground/60 truncate">
                    {referencedAgent.description}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-xs text-muted-foreground/60">
                  未找到引用的 Agent: {subagent.agentId}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 覆盖名称 */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/70">显示名称</Label>
          <Input
            value={subagent.name || ""}
            onChange={(e) => onUpdate({ name: e.target.value || undefined })}
            placeholder={referencedAgent?.name || "使用原 Agent 名称"}
            className="h-8 text-sm"
          />
          <p className="text-[10px] text-muted-foreground/50">
            留空则使用原 Agent 名称
          </p>
        </div>

        {/* 描述 */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/70">描述</Label>
          <Textarea
            value={subagent.description || ""}
            onChange={(e) => onUpdate({ description: e.target.value || undefined })}
            placeholder={referencedAgent?.description || "使用原 Agent 描述"}
            className="min-h-[60px] text-sm resize-none"
          />
        </div>

        <Separator className="bg-border/50" />

        {/* 运行选项 */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs text-muted-foreground/70">后台运行</Label>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
              启用后将在后台并行执行
            </p>
          </div>
          <Switch
            checked={subagent.runInBackground ?? false}
            onCheckedChange={(runInBackground) => onUpdate({ runInBackground })}
          />
        </div>

        <Separator className="bg-border/50" />

        {/* 位置信息 */}
        <div className="p-3 rounded-md bg-muted/30 border border-border/40">
          <p className="text-[10px] text-muted-foreground/50 mb-2">画布位置</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground/60">X:</span>
              <span className="text-xs font-mono">{Math.round(subagent.position.x)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground/60">Y:</span>
              <span className="text-xs font-mono">{Math.round(subagent.position.y)}</span>
            </div>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* 删除按钮 */}
        <Button
          variant="outline"
          className="w-full h-9 text-destructive hover:text-destructive"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          移除子 Agent
        </Button>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认移除</DialogTitle>
            <DialogDescription>
              确定要从工作流中移除此子 Agent 吗？相关的委托规则也会被删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onRemove();
                setShowDeleteDialog(false);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              确认移除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
