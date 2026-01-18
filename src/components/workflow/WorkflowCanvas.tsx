/**
 * 工作流画布组件
 * 
 * 使用 React Flow 可视化展示和编辑 Agent 团队配置
 * - 主 Agent 节点居中显示
 * - 子 Agent 节点围绕主节点分布
 * - 连线表示委托关系
 * - 支持拖拽、缩放、选择
 */

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
import { useWorkflowStore } from "@/stores/workflow";
import { useOrchestrationStore } from "@/stores/orchestration";
import {
  PrimaryAgentNode,
  SubagentNode,
  type PrimaryAgentNodeData,
  type SubagentNodeData,
} from "./nodes";
import type { WorkflowDefinition } from "@/types/workflow";

// ============================================================================
// 类型定义
// ============================================================================

interface WorkflowCanvasProps {
  /** 是否只读模式 */
  readOnly?: boolean;
  /** 点击主 Agent 配置 */
  onPrimaryAgentConfig?: () => void;
  /** 点击子 Agent 配置 */
  onSubagentConfig?: (subagentId: string) => void;
}

// ============================================================================
// 常量
// ============================================================================

/** 注册自定义节点类型 */
const nodeTypes = {
  primaryAgent: PrimaryAgentNode,
  subagent: SubagentNode,
};

/** 默认边样式 */
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

// ============================================================================
// 辅助函数
// ============================================================================

/** 从工作流定义构建 React Flow 节点 */
function buildNodes(
  workflow: WorkflowDefinition,
  agents: Map<string, { name: string; description?: string; category?: string }>,
  selection: { type: string | null; id: string | null },
  onPrimaryAgentConfig?: () => void,
  onSubagentConfig?: (id: string) => void,
  onToggleSubagentEnabled?: (id: string) => void
): Node[] {
  const nodes: Node[] = [];
  
  // 主 Agent 节点
  const primaryName = workflow.primaryAgent.inline?.name || "主编排 Agent";
  const primaryDesc = workflow.primaryAgent.inline?.description;
  
  nodes.push({
    id: "primary",
    type: "primaryAgent",
    position: workflow.primaryAgent.position,
    data: {
      config: workflow.primaryAgent,
      name: primaryName,
      description: primaryDesc,
      isSelected: selection.type === "primary",
      onConfigClick: onPrimaryAgentConfig,
    } satisfies PrimaryAgentNodeData,
  });
  
  // 子 Agent 节点
  for (const subagent of workflow.subagents) {
    const agentInfo = agents.get(subagent.agentId);
    const ruleCount = workflow.delegationRuleset.rules.filter(
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
        category: agentInfo?.category,
        isSelected: selection.type === "subagent" && selection.id === subagent.id,
        ruleCount,
        onConfigClick: () => onSubagentConfig?.(subagent.id),
        onToggleEnabled: () => onToggleSubagentEnabled?.(subagent.id),
      } satisfies SubagentNodeData,
    });
  }
  
  return nodes;
}

/** 从工作流定义构建 React Flow 边 */
function buildEdges(workflow: WorkflowDefinition): Edge[] {
  const edges: Edge[] = [];
  
  // 为每个子 Agent 创建从主 Agent 到子 Agent 的边
  for (const subagent of workflow.subagents) {
    edges.push({
      id: `primary-${subagent.id}`,
      source: "primary",
      target: subagent.id,
      ...defaultEdgeOptions,
      // 禁用的子 Agent 使用虚线
      style: {
        ...defaultEdgeOptions.style,
        strokeDasharray: subagent.enabled ? undefined : "5,5",
        opacity: subagent.enabled ? 1 : 0.5,
      },
    });
  }
  
  return edges;
}

// ============================================================================
// 组件
// ============================================================================

export function WorkflowCanvas({
  readOnly = false,
  onPrimaryAgentConfig,
  onSubagentConfig,
}: WorkflowCanvasProps) {
  // Store
  const {
    currentWorkflow: workflow,
    selection,
    setSelection,
    clearSelection,
    updatePrimaryAgentPosition,
    updateSubagentPosition,
    toggleSubagentEnabled,
    updateViewport,
  } = useWorkflowStore();
  
  const { agents } = useOrchestrationStore();
  
  // 构建 Agent 信息映射
  const agentInfoMap = useMemo(() => {
    const map = new Map<string, { name: string; description?: string; category?: string }>();
    for (const agent of agents) {
      map.set(agent.id, {
        name: agent.name,
        description: agent.description,
        category: agent.metadata?.category,
      });
    }
    return map;
  }, [agents]);
  
  // 构建节点和边
  const initialNodes = useMemo(
    () => {
      if (!workflow) return [];
      return buildNodes(
        workflow,
        agentInfoMap,
        selection,
        onPrimaryAgentConfig,
        onSubagentConfig,
        toggleSubagentEnabled
      );
    },
    [workflow, agentInfoMap, selection, onPrimaryAgentConfig, onSubagentConfig, toggleSubagentEnabled]
  );
  
  const initialEdges = useMemo(
    () => {
      if (!workflow) return [];
      return buildEdges(workflow);
    },
    [workflow]
  );
  
  // React Flow 状态
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  // 同步节点和边
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);
  
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);
  
  // 处理节点变化（拖拽等）
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (readOnly) return;
      
      onNodesChange(changes);
      
      // 同步位置变化到 store
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          if (change.id === "primary") {
            updatePrimaryAgentPosition(change.position);
          } else {
            updateSubagentPosition(change.id, change.position);
          }
        }
      }
    },
    [readOnly, onNodesChange, updatePrimaryAgentPosition, updateSubagentPosition]
  );
  
  // 处理边变化
  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      if (readOnly) return;
      onEdgesChange(changes);
    },
    [readOnly, onEdgesChange]
  );
  
  // 处理连接（目前不支持手动创建连接）
  const handleConnect = useCallback(
    () => {
      if (readOnly) return;
      // 暂不支持手动创建连接
    },
    [readOnly]
  );
  
  // 处理节点点击
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.id === "primary") {
        setSelection({ type: "primary", id: null });
      } else {
        setSelection({ type: "subagent", id: node.id });
      }
    },
    [setSelection]
  );
  
  // 处理画布点击（清除选择）
  const handlePaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);
  
  // 处理视口变化
  const handleMoveEnd = useCallback(
    (_: unknown, viewport: { x: number; y: number; zoom: number }) => {
      updateViewport(viewport);
    },
    [updateViewport]
  );
  
  if (!workflow) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground/50">
        请选择一个工作流
      </div>
    );
  }
  
  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onMoveEnd={handleMoveEnd}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        // 交互配置
        nodesDraggable={!readOnly}
        nodesConnectable={false}
        elementsSelectable={true}
        // 视图配置
        fitView
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.5,
          maxZoom: 1.5,
        }}
        minZoom={0.3}
        maxZoom={2}
        // 初始视口
        defaultViewport={workflow.viewport || { x: 0, y: 0, zoom: 1 }}
        // 样式
        className="bg-transparent"
        proOptions={{ hideAttribution: true }}
      >
        {/* 背景 */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--muted-foreground) / 0.15)"
        />
        
        {/* 控制栏 */}
        <Controls
          showInteractive={false}
          className={cn(
            "!bg-background/80 !border-border/50 !rounded-md !shadow-sm",
            "[&>button]:!bg-background [&>button]:!border-border/50",
            "[&>button]:!text-muted-foreground [&>button:hover]:!bg-accent"
          )}
        />
        
        {/* 小地图 */}
        <MiniMap
          nodeColor={(node) => {
            if (node.id === "primary") return "hsl(var(--primary))";
            const data = node.data as SubagentNodeData;
            if (!data?.config?.enabled) return "hsl(var(--muted-foreground) / 0.3)";
            return "hsl(var(--muted-foreground) / 0.6)";
          }}
          maskColor="hsl(var(--background) / 0.8)"
          className={cn(
            "!bg-background/80 !border-border/50 !rounded-md !shadow-sm"
          )}
        />
        
        {/* 空状态提示 */}
        {workflow.subagents.length === 0 && (
          <Panel position="top-center" className="mt-20">
            <div className={cn(
              "px-4 py-3 rounded-lg",
              "bg-muted/50 border border-dashed border-muted-foreground/30",
              "text-sm text-muted-foreground/70 text-center"
            )}>
              点击右上角添加子 Agent
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
