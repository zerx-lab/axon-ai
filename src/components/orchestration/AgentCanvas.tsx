import { useCallback, useMemo, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeMouseHandler,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { cn } from "@/lib/utils";
import { useOrchestrationStore } from "@/stores/orchestration";
import {
  PrimaryAgentNode,
  SubagentNode,
  type PrimaryAgentNodeData,
  type SubagentNodeData,
} from "@/components/workflow/nodes";
import type { AgentDefinition, SubagentConfig } from "@/types/agent";

interface AgentCanvasProps {
  agent: AgentDefinition;
  readOnly?: boolean;
}

const nodeTypes = {
  primaryAgent: PrimaryAgentNode,
  subagent: SubagentNode,
};

const defaultEdgeOptions = {
  type: "smoothstep",
  animated: false,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 16,
    height: 16,
  },
  style: {
    strokeWidth: 1.5,
    stroke: "hsl(var(--muted-foreground) / 0.4)",
  },
};

const DEFAULT_PRIMARY_POSITION = { x: 400, y: 100 };

function buildNodes(
  agent: AgentDefinition,
  allAgents: AgentDefinition[],
  selection: { type: string | null; id: string | null },
  onToggleSubagentEnabled?: (id: string) => void
): Node[] {
  const nodes: Node[] = [];
  const primaryPosition = agent.primaryPosition ?? DEFAULT_PRIMARY_POSITION;

  nodes.push({
    id: "primary",
    type: "primaryAgent",
    position: primaryPosition,
    data: {
      config: {
        mode: "inline",
        inline: { name: agent.name, description: agent.description },
        position: primaryPosition,
      },
      name: agent.name,
      description: agent.description,
      isSelected: selection.type === "primary",
    } satisfies PrimaryAgentNodeData,
  });

  for (const subagent of agent.subagents ?? []) {
    const agentInfo = allAgents.find((a) => a.id === subagent.agentId);
    const ruleCount = (agent.delegationRuleset?.rules ?? []).filter(
      (r) => r.subagentId === subagent.id
    ).length;

    nodes.push({
      id: subagent.id,
      type: "subagent",
      position: subagent.position,
      data: {
        config: subagent,
        name: subagent.name || agentInfo?.name || subagent.agentId,
        description: subagent.description || agentInfo?.description,
        category: agentInfo?.metadata?.category,
        isSelected: selection.type === "subagent" && selection.id === subagent.id,
        ruleCount,
        onToggleEnabled: () => onToggleSubagentEnabled?.(subagent.id),
      } satisfies SubagentNodeData,
    });
  }

  return nodes;
}

function buildEdges(subagents: SubagentConfig[]): Edge[] {
  return subagents.map((subagent) => ({
    id: `primary-${subagent.id}`,
    source: "primary",
    target: subagent.id,
    ...defaultEdgeOptions,
    style: {
      ...defaultEdgeOptions.style,
      strokeDasharray: subagent.enabled ? undefined : "5,5",
      opacity: subagent.enabled ? 1 : 0.5,
    },
  }));
}

export function AgentCanvas({ agent, readOnly = false }: AgentCanvasProps) {
  const {
    agents,
    canvasSelection: selection,
    setCanvasSelection,
    clearCanvasSelection,
    updatePrimaryPosition,
    updateSubagentPosition,
    toggleSubagentEnabled,
    updateCanvasViewport,
  } = useOrchestrationStore();

  const initialNodes = useMemo(
    () => buildNodes(agent, agents, selection, toggleSubagentEnabled),
    [agent, agents, selection, toggleSubagentEnabled]
  );

  const initialEdges = useMemo(
    () => buildEdges(agent.subagents ?? []),
    [agent.subagents]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (readOnly) return;

      onNodesChange(changes);

      for (const change of changes) {
        if (change.type === "position" && change.position && !change.dragging) {
          if (change.id === "primary") {
            updatePrimaryPosition(change.position);
          } else {
            updateSubagentPosition(change.id, change.position);
          }
        }
      }
    },
    [readOnly, onNodesChange, updatePrimaryPosition, updateSubagentPosition]
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      if (readOnly) return;
      onEdgesChange(changes);
    },
    [readOnly, onEdgesChange]
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.id === "primary") {
        setCanvasSelection({ type: "primary", id: null });
      } else {
        setCanvasSelection({ type: "subagent", id: node.id });
      }
    },
    [setCanvasSelection]
  );

  const handlePaneClick = useCallback(() => {
    clearCanvasSelection();
  }, [clearCanvasSelection]);

  const handleMoveEnd = useCallback(
    (_: unknown, viewport: { x: number; y: number; zoom: number }) => {
      updateCanvasViewport(viewport);
    },
    [updateCanvasViewport]
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onMoveEnd={handleMoveEnd}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        nodesDraggable={!readOnly}
        nodesConnectable={false}
        elementsSelectable={true}
        fitView
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.5,
          maxZoom: 1.5,
        }}
        minZoom={0.3}
        maxZoom={2}
        defaultViewport={agent.canvasViewport || { x: 0, y: 0, zoom: 1 }}
        className="bg-transparent"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--muted-foreground) / 0.15)"
        />

        <Controls
          showInteractive={false}
          className={cn(
            "!bg-background/80 !border-border/50 !rounded-md !shadow-sm",
            "[&>button]:!bg-background [&>button]:!border-border/50",
            "[&>button]:!text-muted-foreground [&>button:hover]:!bg-accent"
          )}
        />

        <MiniMap
          nodeColor={(node) => {
            if (node.id === "primary") return "#3b82f6";
            const data = node.data as SubagentNodeData;
            if (!data?.config?.enabled) return "#9ca3af";
            return "#6b7280";
          }}
          maskColor="rgba(255, 255, 255, 0.8)"
          className={cn(
            "!rounded-md !shadow-sm",
            "[&>svg]:bg-background [&>svg]:rounded-md"
          )}
          style={{ backgroundColor: "var(--background)" }}
        />

        {(agent.subagents?.length ?? 0) === 0 && (
          <Panel position="top-center" className="mt-20">
            <div
              className={cn(
                "px-4 py-3 rounded-lg",
                "bg-muted/50 border border-dashed border-muted-foreground/30",
                "text-sm text-muted-foreground/70 text-center"
              )}
            >
              点击右上角添加子 Agent
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
