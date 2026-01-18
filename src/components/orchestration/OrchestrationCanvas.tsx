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
  type Connection,
  type OnConnect,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { cn } from "@/lib/utils";
import { useOrchestrationStoreV2 } from "@/stores/orchestration-v2";
import {
  PrimaryAgentNode,
  SubagentNode,
  type PrimaryAgentNodeData,
  type SubagentNodeData,
} from "@/components/workflow/nodes";
import type { OrchestrationGroup, OrchestrationEdge, EmbeddedSubagent } from "@/types/orchestration";

interface OrchestrationCanvasProps {
  group: OrchestrationGroup;
  readOnly?: boolean;
  onNodeSelect?: () => void;
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
  group: OrchestrationGroup,
  selection: { type: string | null; id: string | null },
  onToggleSubagentEnabled?: (id: string) => void
): Node[] {
  const nodes: Node[] = [];
  const primaryPosition = group.primaryPosition ?? DEFAULT_PRIMARY_POSITION;

  nodes.push({
    id: "primary",
    type: "primaryAgent",
    position: primaryPosition,
    data: {
      config: {
        mode: "inline",
        inline: {
          name: group.primaryAgent.name,
          description: group.primaryAgent.description,
        },
        position: primaryPosition,
      },
      name: group.primaryAgent.name,
      description: group.primaryAgent.description,
      isSelected: selection.type === "primary",
    } satisfies PrimaryAgentNodeData,
  });

  for (const subagent of group.subagents) {
    const ruleCount = group.delegationRuleset.rules.filter(
      (r) => r.subagentId === subagent.id
    ).length;

    nodes.push({
      id: subagent.id,
      type: "subagent",
      position: subagent.position,
      data: {
        config: {
          id: subagent.id,
          agentId: subagent.id,
          triggers: subagent.triggers,
          enabled: subagent.enabled,
          runInBackground: subagent.runInBackground,
          position: subagent.position,
        },
        name: subagent.config.name,
        description: subagent.config.description,
        category: subagent.config.metadata?.category,
        isSelected: selection.type === "subagent" && selection.id === subagent.id,
        ruleCount,
        onToggleEnabled: () => onToggleSubagentEnabled?.(subagent.id),
      } satisfies SubagentNodeData,
    });
  }

  return nodes;
}

function getEdgeStyle(edge: OrchestrationEdge, subagents: EmbeddedSubagent[]): React.CSSProperties {
  const targetSubagent = subagents.find((s) => s.id === edge.target);
  const isDisabled = !edge.enabled || (targetSubagent && !targetSubagent.enabled);

  const typeColors: Record<string, string> = {
    delegation: "#3b82f6",
    sequence: "#22c55e",
    parallel: "#f59e0b",
    conditional: "#ef4444",
  };

  return {
    strokeWidth: 2,
    stroke: typeColors[edge.type] || "#6b7280",
    opacity: isDisabled ? 0.4 : 1,
    strokeDasharray: edge.type === "parallel" ? "8,4" : edge.type === "conditional" ? "4,4" : isDisabled ? "5,5" : undefined,
  };
}

function buildEdges(edges: OrchestrationEdge[], subagents: EmbeddedSubagent[]): Edge[] {
  const hasEdges = edges && edges.length > 0;

  if (!hasEdges) {
    return subagents.map((subagent) => ({
      id: `default-primary-${subagent.id}`,
      source: "primary",
      target: subagent.id,
      type: "smoothstep",
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
      },
      style: {
        strokeWidth: 2,
        stroke: "#6b7280",
        strokeDasharray: subagent.enabled ? undefined : "5,5",
        opacity: subagent.enabled ? 1 : 0.5,
      },
    }));
  }

  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    animated: edge.type === "parallel",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
    },
    label: edge.label,
    style: getEdgeStyle(edge, subagents),
    data: { orchEdge: edge },
  }));
}

export function OrchestrationCanvas({ group, readOnly = false, onNodeSelect }: OrchestrationCanvasProps) {
  const {
    canvasSelection: selection,
    setCanvasSelection,
    clearCanvasSelection,
    updatePrimaryPosition,
    updateSubagentPosition,
    toggleSubagentEnabled,
    updateCanvasViewport,
    addEdge: storeAddEdge,
    removeEdge: storeRemoveEdge,
  } = useOrchestrationStoreV2();

  const initialNodes = useMemo(
    () => buildNodes(group, selection, toggleSubagentEnabled),
    [group, selection, toggleSubagentEnabled]
  );

  const initialEdges = useMemo(
    () => buildEdges(group.edges || [], group.subagents),
    [group.edges, group.subagents]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    console.log("[OrchestrationCanvas] Debug edges:", {
      groupEdges: group.edges,
      groupSubagents: group.subagents?.map(s => s.id),
      initialEdges: initialEdges.map(e => ({ id: e.id, source: e.source, target: e.target })),
      currentNodes: nodes.map(n => n.id),
    });
    setEdges(initialEdges);
  }, [initialEdges, setEdges, group.edges, group.subagents, nodes]);

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
      onNodeSelect?.();
    },
    [setCanvasSelection, onNodeSelect]
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

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (readOnly || !connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      storeAddEdge(connection.source, connection.target, "delegation");
    },
    [readOnly, storeAddEdge]
  );

  const handleEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (readOnly) return;
      for (const edge of deletedEdges) {
        storeRemoveEdge(edge.id);
      }
    },
    [readOnly, storeRemoveEdge]
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onEdgesDelete={handleEdgesDelete}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onMoveEnd={handleMoveEnd}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        edgesReconnectable={!readOnly}
        deleteKeyCode={readOnly ? null : "Backspace"}
        elementsSelectable={true}
        fitView
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.5,
          maxZoom: 1.5,
        }}
        minZoom={0.3}
        maxZoom={2}
        defaultViewport={group.canvasViewport || { x: 0, y: 0, zoom: 1 }}
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

        {group.subagents.length === 0 && (
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
