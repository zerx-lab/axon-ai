import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Workflow, Save, Trash2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { OrchestrationListPanel } from "@/components/orchestration/OrchestrationListPanel";
import { OrchestrationCanvas } from "@/components/orchestration/OrchestrationCanvas";
import { AgentConfigEditor } from "@/components/orchestration/AgentConfigEditor";
import { ActivityBar } from "@/components/activitybar";
import { UsagePanel } from "@/components/usage-panel";
import { useActivityBar } from "@/stores/activityBar";
import {
  useOrchestrationStoreV2,
  useSelectedOrchestrationGroup,
  useSelectedSubagent,
} from "@/stores/orchestration-v2";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OrchestrationGroup, EmbeddedSubagent, AgentConfig } from "@/types/orchestration";

const PANEL_CONFIG = {
  list: { defaultSize: 220, minSize: 180, maxSize: 320 },
  config: { defaultSize: 360, minSize: 280, maxSize: 480 },
};

export const Route = createFileRoute("/orchestration")({
  component: OrchestrationRoute,
});

function OrchestrationRoute() {
  const { position: activityBarPosition } = useActivityBar();
  const {
    loadGroups,
    createGroup,
    saveGroup,
    selectGroup,
    addSubagent,
    hasUnsavedChanges,
  } = useOrchestrationStoreV2();

  const selectedGroup = useSelectedOrchestrationGroup();
  const selectedSubagent = useSelectedSubagent();
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleCreateGroup = useCallback(async () => {
    const group = await createGroup();
    selectGroup(group.id);
    setShowConfigPanel(true);
  }, [createGroup, selectGroup]);

  const handleSelectGroup = useCallback(
    (group: OrchestrationGroup) => {
      selectGroup(group.id);
      setShowConfigPanel(true);
    },
    [selectGroup]
  );

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveGroup();
      toast.success("编排组已保存");
    } catch (error) {
      console.error("保存编排组失败:", error);
      toast.error(`保存失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsSaving(false);
    }
  }, [saveGroup]);

  const handleAddSubagent = useCallback(() => {
    addSubagent();
  }, [addSubagent]);

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {activityBarPosition === "left" && <ActivityBar />}
        {activityBarPosition === "left" && <UsagePanel messages={[]} />}

        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel
            id="orchestration-list"
            defaultSize={PANEL_CONFIG.list.defaultSize}
            minSize={PANEL_CONFIG.list.minSize}
            maxSize={PANEL_CONFIG.list.maxSize}
          >
            <OrchestrationListPanel
              onCreateGroup={handleCreateGroup}
              onSelectGroup={handleSelectGroup}
              selectedGroupId={selectedGroup?.id}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel id="orchestration-canvas" minSize={30}>
            <div className="relative h-full bg-background">
              {selectedGroup ? (
                <>
                  <OrchestrationCanvas
                    group={selectedGroup}
                    onNodeSelect={() => setShowConfigPanel(true)}
                  />

                  <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                    {hasUnsavedChanges && (
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 bg-background/80 backdrop-blur-sm"
                              onClick={handleSave}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Save className="w-3.5 h-3.5" />
                              )}
                              {isSaving ? "保存中..." : "保存"}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            保存更改到文件系统
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 bg-background/80 backdrop-blur-sm"
                      onClick={handleAddSubagent}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      添加子 Agent
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50">
                  <Workflow className="w-12 h-12 mb-4 text-muted-foreground/30" />
                  <p className="text-sm">选择一个编排组开始编排</p>
                  <p className="text-xs mt-1">或创建新的编排组</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-1.5"
                    onClick={handleCreateGroup}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    创建编排组
                  </Button>
                </div>
              )}
            </div>
          </ResizablePanel>

          {showConfigPanel && selectedGroup && (
            <>
              <ResizableHandle withHandle />

              <ResizablePanel
                id="orchestration-config"
                defaultSize={PANEL_CONFIG.config.defaultSize}
                minSize={PANEL_CONFIG.config.minSize}
                maxSize={PANEL_CONFIG.config.maxSize}
              >
                <OrchestrationConfigPanel
                  group={selectedGroup}
                  selectedSubagent={selectedSubagent}
                  onClose={() => setShowConfigPanel(false)}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {activityBarPosition === "right" && <UsagePanel messages={[]} />}
        {activityBarPosition === "right" && <ActivityBar />}
      </div>
    </div>
  );
}

interface OrchestrationConfigPanelProps {
  group: OrchestrationGroup;
  selectedSubagent?: EmbeddedSubagent;
  onClose: () => void;
}

function OrchestrationConfigPanel({
  group,
  selectedSubagent,
  onClose,
}: OrchestrationConfigPanelProps) {
  const {
    updateGroup,
    updatePrimaryAgent,
    updateSubagentConfig,
    updateSubagent,
    removeSubagent,
    canvasSelection,
  } = useOrchestrationStoreV2();

  const [activeTab, setActiveTab] = useState<"group" | "primary" | "subagent">("group");

  useEffect(() => {
    if (canvasSelection.type === "primary") {
      setActiveTab("primary");
    } else if (canvasSelection.type === "subagent" && selectedSubagent) {
      setActiveTab("subagent");
    }
  }, [canvasSelection, selectedSubagent]);

  return (
    <div className="flex flex-col h-full bg-sidebar border-l border-sidebar-border/50">
      <div className="flex items-center justify-between h-10 px-3 border-b border-sidebar-border/50 shrink-0">
        <span className="text-sm font-medium text-foreground/80">配置</span>
        <button
          onClick={onClose}
          className={cn(
            "w-6 h-6 flex items-center justify-center",
            "text-muted-foreground/70 hover:text-foreground",
            "hover:bg-accent rounded transition-colors duration-150"
          )}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex border-b border-sidebar-border/50 shrink-0">
        <button
          onClick={() => setActiveTab("group")}
          className={cn(
            "flex-1 px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "group"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          编排组
        </button>
        <button
          onClick={() => setActiveTab("primary")}
          className={cn(
            "flex-1 px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "primary"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          主 Agent
        </button>
        {selectedSubagent && (
          <button
            onClick={() => setActiveTab("subagent")}
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium transition-colors",
              activeTab === "subagent"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            子 Agent
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === "group" && (
          <GroupConfigSection group={group} onUpdate={updateGroup} />
        )}
        {activeTab === "primary" && (
          <div className="space-y-4">
            <AgentConfigEditor
              config={group.primaryAgent}
              onChange={updatePrimaryAgent}
              showBasicInfo={true}
            />
          </div>
        )}
        {activeTab === "subagent" && selectedSubagent && (
          <SubagentConfigSection
            subagent={selectedSubagent}
            onUpdateConfig={(config) => updateSubagentConfig(selectedSubagent.id, config)}
            onUpdateSubagent={(updates) => updateSubagent(selectedSubagent.id, updates)}
            onRemove={() => removeSubagent(selectedSubagent.id)}
          />
        )}
      </div>
    </div>
  );
}

interface GroupConfigSectionProps {
  group: OrchestrationGroup;
  onUpdate: (updates: Partial<OrchestrationGroup>) => void;
}

function GroupConfigSection({ group, onUpdate }: GroupConfigSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground/70">名称</Label>
        <Input
          value={group.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="编排组名称"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground/70">描述</Label>
        <Textarea
          value={group.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="编排组描述"
          className="min-h-[80px] text-sm resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground/70">颜色</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={group.color || "#8B5CF6"}
            onChange={(e) => onUpdate({ color: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer border border-input"
          />
          <span className="text-xs text-muted-foreground font-mono">
            {group.color || "#8B5CF6"}
          </span>
        </div>
      </div>

      <Separator className="bg-border/50" />

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground/70">统计</Label>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="p-2 rounded bg-muted/30 border border-border/40">
            <p className="font-medium text-foreground/80">{group.subagents.length}</p>
            <p>子 Agent</p>
          </div>
          <div className="p-2 rounded bg-muted/30 border border-border/40">
            <p className="font-medium text-foreground/80">{group.delegationRuleset.rules.length}</p>
            <p>委托规则</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SubagentConfigSectionProps {
  subagent: EmbeddedSubagent;
  onUpdateConfig: (config: Partial<AgentConfig>) => void;
  onUpdateSubagent: (updates: Partial<EmbeddedSubagent>) => void;
  onRemove: () => void;
}

function SubagentConfigSection({
  subagent,
  onUpdateConfig,
  onUpdateSubagent,
  onRemove,
}: SubagentConfigSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">子 Agent 配置</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-7 px-2 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-3.5 h-3.5" />
          删除
        </Button>
      </div>

      <AgentConfigEditor
        config={subagent.config}
        onChange={onUpdateConfig}
        showBasicInfo={true}
      />

      <Separator className="bg-border/50" />

      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground/70">子 Agent 选项</Label>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium">启用</p>
            <p className="text-[10px] text-muted-foreground/60">是否在编排中启用此子 Agent</p>
          </div>
          <Switch
            checked={subagent.enabled}
            onCheckedChange={(checked) => onUpdateSubagent({ enabled: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium">后台运行</p>
            <p className="text-[10px] text-muted-foreground/60">在后台异步执行任务</p>
          </div>
          <Switch
            checked={subagent.runInBackground || false}
            onCheckedChange={(checked) => onUpdateSubagent({ runInBackground: checked })}
          />
        </div>
      </div>

      <Separator className="bg-border/50" />

      <SubagentTriggersEditor
        triggers={subagent.triggers}
        onChange={(triggers) => onUpdateSubagent({ triggers })}
      />
    </div>
  );
}

interface SubagentTriggersEditorProps {
  triggers: import("@/types/orchestration").SubagentTrigger[];
  onChange: (triggers: import("@/types/orchestration").SubagentTrigger[]) => void;
}

function SubagentTriggersEditor({ triggers, onChange }: SubagentTriggersEditorProps) {
  const addTrigger = (type: import("@/types/orchestration").SubagentTriggerType) => {
    onChange([...triggers, { type, pattern: "", description: "" }]);
  };

  const updateTrigger = (index: number, updates: Partial<import("@/types/orchestration").SubagentTrigger>) => {
    const newTriggers = [...triggers];
    newTriggers[index] = { ...newTriggers[index], ...updates };
    onChange(newTriggers);
  };

  const removeTrigger = (index: number) => {
    onChange(triggers.filter((_, i) => i !== index));
  };

  const triggerTypeLabels: Record<import("@/types/orchestration").SubagentTriggerType, string> = {
    keyword: "关键词",
    domain: "领域",
    condition: "条件",
    always: "始终",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground/70">触发条件</Label>
        <div className="flex gap-1">
          {(["keyword", "domain", "condition"] as const).map((type) => (
            <Button
              key={type}
              variant="ghost"
              size="sm"
              onClick={() => addTrigger(type)}
              className="h-6 px-2 text-[10px]"
            >
              + {triggerTypeLabels[type]}
            </Button>
          ))}
        </div>
      </div>

      {triggers.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 text-center py-4">
          暂无触发条件，点击上方按钮添加
        </p>
      ) : (
        <div className="space-y-2">
          {triggers.map((trigger, index) => (
            <div
              key={index}
              className="p-2 rounded border border-border/60 bg-muted/20 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {triggerTypeLabels[trigger.type]}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTrigger(index)}
                  className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <Input
                value={trigger.pattern}
                onChange={(e) => updateTrigger(index, { pattern: e.target.value })}
                placeholder={
                  trigger.type === "keyword"
                    ? "触发关键词"
                    : trigger.type === "domain"
                      ? "领域名称"
                      : "触发条件表达式"
                }
                className="h-7 text-xs"
              />
              <Input
                value={trigger.description}
                onChange={(e) => updateTrigger(index, { description: e.target.value })}
                placeholder="描述（可选）"
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
