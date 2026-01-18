/**
 * Agent 管理页面路由
 * 
 * 提供 Agent 的创建、编辑、删除功能
 */

import { useCallback, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AgentListPanel } from "@/components/orchestration/AgentListPanel";
import { AgentConfigPanel } from "@/components/orchestration/AgentConfigPanel";
import { ActivityBar } from "@/components/activitybar";
import { UsagePanel } from "@/components/usage-panel";
import { useActivityBar } from "@/stores/activityBar";
import { useOrchestrationStore } from "@/stores/orchestration";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import type { AgentDefinition } from "@/types/agent";
import { createDefaultAgentDefinition } from "@/types/agent";

const AGENT_LIST_CONFIG = {
  defaultSize: 280,
  minSize: 200,
  maxSize: 400,
};

export const Route = createFileRoute("/orchestration")({
  component: AgentManagementRoute,
});

function AgentManagementRoute() {
  const { position: activityBarPosition } = useActivityBar();
  const { loadAgents, saveAgent, deleteAgent } = useOrchestrationStore();

  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleCreateAgent = useCallback(() => {
    const newAgent = createDefaultAgentDefinition({
      name: "新建 Agent",
      description: "自定义 Agent",
    });
    setSelectedAgent(newAgent);
    setShowConfigPanel(true);
  }, []);

  const handleSelectAgent = useCallback((agent: AgentDefinition) => {
    setSelectedAgent(agent);
    setShowConfigPanel(true);
  }, []);

  const handleSaveAgent = useCallback(async (agent: AgentDefinition) => {
    await saveAgent(agent);
    setSelectedAgent(agent);
  }, [saveAgent]);

  const handleDeleteAgent = useCallback(async (agentId: string) => {
    await deleteAgent(agentId);
    setSelectedAgent(null);
    setShowConfigPanel(false);
  }, [deleteAgent]);

  const handleCloseConfigPanel = useCallback(() => {
    setShowConfigPanel(false);
  }, []);

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {activityBarPosition === "left" && <ActivityBar />}
        {activityBarPosition === "left" && <UsagePanel messages={[]} />}

        <div className="flex flex-1 h-full overflow-hidden">
          <ResizablePanelGroup orientation="horizontal" className="flex-1">
            <ResizablePanel
              id="agent-list"
              defaultSize={AGENT_LIST_CONFIG.defaultSize}
              minSize={AGENT_LIST_CONFIG.minSize}
              maxSize={AGENT_LIST_CONFIG.maxSize}
            >
              <AgentListPanel
                onCreateAgent={handleCreateAgent}
                onSelectAgent={handleSelectAgent}
                selectedAgentId={selectedAgent?.id}
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel
              id="agent-content"
              minSize="50%"
            >
              {showConfigPanel ? (
                <AgentConfigPanel
                  agent={selectedAgent}
                  onSave={handleSaveAgent}
                  onDelete={handleDeleteAgent}
                  onClose={handleCloseConfigPanel}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground/50">
                  选择一个 Agent 进行编辑，或创建新的 Agent
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {activityBarPosition === "right" && <UsagePanel messages={[]} />}
        {activityBarPosition === "right" && <ActivityBar />}
      </div>
    </div>
  );
}
