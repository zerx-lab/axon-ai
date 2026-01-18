import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AgentListPanel } from "@/components/orchestration/AgentListPanel";
import { AgentConfigPanel } from "@/components/orchestration/AgentConfigPanel";
import { ActivityBar } from "@/components/activitybar";
import { UsagePanel } from "@/components/usage-panel";
import { useActivityBar } from "@/stores/activityBar";
import { useOrchestrationStore } from "@/stores/orchestration";
import { AgentCanvas } from "@/components/orchestration/AgentCanvas";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import type { AgentDefinition } from "@/types/agent";
import { createDefaultAgentDefinition } from "@/types/agent";

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
    agents,
    loadAgents,
    saveAgent,
    deleteAgent,
    selectedAgentId,
    selectAgent,
    getSelectedAgent,
    addSubagent,
  } = useOrchestrationStore();

  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showAddSubagentDialog, setShowAddSubagentDialog] = useState(false);

  const selectedAgent = getSelectedAgent();

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleCreateAgent = useCallback(() => {
    const newAgent = createDefaultAgentDefinition({
      name: "新建 Agent",
      description: "自定义 Agent",
    });
    saveAgent(newAgent).then(() => {
      selectAgent(newAgent.id);
      setShowConfigPanel(true);
    });
  }, [saveAgent, selectAgent]);

  const handleSelectAgent = useCallback(
    (agent: AgentDefinition) => {
      selectAgent(agent.id);
      setShowConfigPanel(true);
    },
    [selectAgent]
  );

  const handleSaveAgent = useCallback(
    async (agent: AgentDefinition) => {
      await saveAgent(agent);
    },
    [saveAgent]
  );

  const handleDeleteAgent = useCallback(
    async (agentId: string) => {
      await deleteAgent(agentId);
      selectAgent(null);
      setShowConfigPanel(false);
    },
    [deleteAgent, selectAgent]
  );

  const handleCloseConfigPanel = useCallback(() => {
    setShowConfigPanel(false);
  }, []);

  const handleAddSubagent = useCallback(
    (agentId: string) => {
      addSubagent(agentId);
      setShowAddSubagentDialog(false);
    },
    [addSubagent]
  );

  const availableSubagents = agents.filter(
    (a) =>
      a.id !== selectedAgentId &&
      (a.runtime.mode === "subagent" || a.runtime.mode === "all")
  );

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {activityBarPosition === "left" && <ActivityBar />}
        {activityBarPosition === "left" && <UsagePanel messages={[]} />}

        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel
            id="agent-list"
            defaultSize={PANEL_CONFIG.list.defaultSize}
            minSize={PANEL_CONFIG.list.minSize}
            maxSize={PANEL_CONFIG.list.maxSize}
          >
            <AgentListPanel
              onCreateAgent={handleCreateAgent}
              onSelectAgent={handleSelectAgent}
              selectedAgentId={selectedAgentId}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel id="agent-canvas" minSize={30}>
            <div className="relative h-full bg-background">
              {selectedAgent ? (
                <>
                  <AgentCanvas agent={selectedAgent} />

                  <div className="absolute top-3 right-3 z-10">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 bg-background/80 backdrop-blur-sm"
                      onClick={() => setShowAddSubagentDialog(true)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      添加子 Agent
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50">
                  <Bot className="w-12 h-12 mb-4 text-muted-foreground/30" />
                  <p className="text-sm">选择一个 Agent 开始编排</p>
                  <p className="text-xs mt-1">或创建新的 Agent</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-1.5"
                    onClick={handleCreateAgent}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    创建 Agent
                  </Button>
                </div>
              )}
            </div>
          </ResizablePanel>

          {showConfigPanel && selectedAgent && (
            <>
              <ResizableHandle withHandle />

              <ResizablePanel
                id="agent-config"
                defaultSize={PANEL_CONFIG.config.defaultSize}
                minSize={PANEL_CONFIG.config.minSize}
                maxSize={PANEL_CONFIG.config.maxSize}
              >
                <AgentConfigPanel
                  agent={selectedAgent}
                  onSave={handleSaveAgent}
                  onDelete={handleDeleteAgent}
                  onClose={handleCloseConfigPanel}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {activityBarPosition === "right" && <UsagePanel messages={[]} />}
        {activityBarPosition === "right" && <ActivityBar />}
      </div>

      <Dialog
        open={showAddSubagentDialog}
        onOpenChange={setShowAddSubagentDialog}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>添加子 Agent</DialogTitle>
            <DialogDescription>
              选择一个已定义的 Agent 添加为子 Agent
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {availableSubagents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground/60">
                <Bot className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm">暂无可用的子 Agent</p>
                <p className="text-xs mt-1">
                  请先创建运行模式为 "子 Agent" 的 Agent
                </p>
              </div>
            ) : (
              <Command className="rounded-lg border">
                <CommandInput placeholder="搜索 Agent..." />
                <CommandList>
                  <CommandEmpty>未找到 Agent</CommandEmpty>
                  <CommandGroup>
                    {availableSubagents.map((agent) => {
                      const isAdded = selectedAgent?.subagents?.some(
                        (s) => s.agentId === agent.id
                      );
                      return (
                        <CommandItem
                          key={agent.id}
                          value={agent.id}
                          disabled={isAdded}
                          onSelect={() => handleAddSubagent(agent.id)}
                          className={cn(isAdded && "opacity-50")}
                        >
                          <div
                            className="w-8 h-8 rounded flex items-center justify-center mr-3 shrink-0"
                            style={{ backgroundColor: `${agent.color}20` }}
                          >
                            <Bot
                              className="w-4 h-4"
                              style={{ color: agent.color }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {agent.name}
                            </p>
                            <p className="text-xs text-muted-foreground/60 truncate">
                              {agent.description}
                            </p>
                          </div>
                          {isAdded && (
                            <span className="text-xs text-muted-foreground/50 ml-2">
                              已添加
                            </span>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddSubagentDialog(false)}
            >
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
