/**
 * Subagent 拓扑图组件
 *
 * 使用 React Flow 展示 subagent 调用关系的有向图
 * - 支持缩放和拖拽查看
 * - 节点颜色表示状态（运行中/完成/错误）
 * - 点击节点切换到对应标签页
 */

import { useMemo, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Position,
  Handle,
  NodeProps,
  BackgroundVariant,
} from "@xyflow/react";
import Dagre from "@dagrejs/dagre";
import { cn } from "@/lib/utils";
import {
  useSubagentPanelStore,
  SubagentStatus,
} from "@/stores/subagentPanel";
import "@xyflow/react/dist/style.css";

// ============== 类型定义 ==============

interface SubagentNodeData extends Record<string, unknown> {
  label: string;
  status: SubagentStatus;
  subagentType: string;
  isActive: boolean;
  isRoot: boolean;
  sessionId: string;
}

type SubagentNode = Node<SubagentNodeData>;

// ============== 常量 ==============

const NODE_WIDTH = 140;
const NODE_HEIGHT = 36;

// 状态颜色映射
const STATUS_COLORS: Record<SubagentStatus, { bg: string; border: string; pulse?: string }> = {
  running: {
    bg: "bg-blue-500/20",
    border: "border-blue-500/60",
    pulse: "animate-pulse",
  },
  completed: {
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/60",
  },
  error: {
    bg: "bg-red-500/20",
    border: "border-red-500/60",
  },
};

// ============== 自定义节点组件 ==============

function SubagentNodeComponent({ data }: NodeProps<SubagentNode>) {
  const colors = STATUS_COLORS[data.status];

  return (
    <>
      {/* 输入连接点 - 只有非根节点显示 */}
      {!data.isRoot && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-2 !h-2 !bg-muted-foreground/50 !border-0"
        />
      )}

      {/* 节点内容 */}
      <div
        className={cn(
          // 基础样式
          "px-3 py-2 rounded-md border",
          "flex items-center gap-2",
          "transition-all duration-150",
          "cursor-pointer select-none",

          // 状态颜色
          colors.bg,
          colors.border,
          colors.pulse,

          // 激活状态
          data.isActive && "ring-2 ring-primary ring-offset-1 ring-offset-background",

          // 根节点特殊样式
          data.isRoot && "border-dashed"
        )}
      >
        {/* 状态指示器 */}
        <span
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            data.status === "running" && "bg-blue-500",
            data.status === "completed" && "bg-emerald-500",
            data.status === "error" && "bg-red-500"
          )}
        />

        {/* 标签文字 */}
        <span className="text-xs font-medium text-foreground/90 truncate max-w-[100px]">
          {data.label}
        </span>
      </div>

      {/* 输出连接点 */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-muted-foreground/50 !border-0"
      />
    </>
  );
}

// 注册自定义节点类型
const nodeTypes = {
  subagent: SubagentNodeComponent,
};

// ============== 布局函数 ==============

/**
 * 使用 Dagre 算法计算节点布局
 */
function getLayoutedElements(
  nodes: SubagentNode[],
  edges: Edge[]
): { nodes: SubagentNode[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  // 设置图属性：从上到下布局
  g.setGraph({
    rankdir: "TB",
    nodesep: 40,
    ranksep: 50,
    marginx: 20,
    marginy: 20,
  });

  // 添加节点
  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  // 添加边
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  // 运行布局算法
  Dagre.layout(g);

  // 获取布局后的节点位置
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// ============== 主组件 ==============

export function SubagentGraph() {
  const { tabs, activeTabId, setActiveTab } = useSubagentPanelStore();

  // 构建图数据
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (tabs.length === 0) {
      return { nodes: [] as SubagentNode[], edges: [] as Edge[] };
    }

    // 创建节点
    const nodes: SubagentNode[] = [];
    const edges: Edge[] = [];

    // 收集所有父 session ID（用于创建虚拟根节点）
    const parentIds = new Set(tabs.map((tab) => tab.parentSessionId));
    const tabSessionIds = new Set(tabs.map((tab) => tab.sessionId));

    // 为没有对应 tab 的父节点创建虚拟根节点
    // 使用第一个 tab 的 parentSessionId 判断是否为主会话
    const mainParentId = tabs[0]?.parentSessionId;
    parentIds.forEach((parentId) => {
      if (!tabSessionIds.has(parentId)) {
        nodes.push({
          id: parentId,
          type: "subagent",
          position: { x: 0, y: 0 },
          data: {
            label: parentId === mainParentId ? "主会话" : "父会话",
            status: "completed",
            subagentType: "primary",
            isActive: false,
            isRoot: true,
            sessionId: parentId,
          },
        });
      }
    });

    // 添加 subagent 节点
    tabs.forEach((tab) => {
      nodes.push({
        id: tab.sessionId,
        type: "subagent",
        position: { x: 0, y: 0 },
        data: {
          label: tab.description || tab.subagentType,
          status: tab.status,
          subagentType: tab.subagentType,
          isActive: tab.sessionId === activeTabId,
          isRoot: false,
          sessionId: tab.sessionId,
        },
      });

      // 添加边（父 -> 子）
      edges.push({
        id: `${tab.parentSessionId}-${tab.sessionId}`,
        source: tab.parentSessionId,
        target: tab.sessionId,
        animated: tab.status === "running",
        style: {
          stroke: tab.status === "running" ? "#3b82f6" : "#6b7280",
          strokeWidth: 1.5,
        },
      });
    });

    // 应用布局
    return getLayoutedElements(nodes, edges);
  }, [tabs, activeTabId]);

  // React Flow 状态
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 当数据变化时更新节点和边
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // 节点点击处理
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const data = node.data as SubagentNodeData;
      // 只有非根节点（实际的 subagent）可以点击切换
      if (!data.isRoot) {
        setActiveTab(data.sessionId);
      }
    },
    [setActiveTab]
  );

  // 空状态
  if (tabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/50 text-xs">
        暂无 Subagent 调用
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        // 交互设置
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        // 视图设置
        fitView
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.5,
          maxZoom: 1.5,
        }}
        minZoom={0.3}
        maxZoom={2}
        // 样式
        className="bg-transparent"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="hsl(var(--muted-foreground) / 0.15)"
        />
        <Controls
          showInteractive={false}
          className="!bg-background/80 !border-border/50 !rounded-md !shadow-sm [&>button]:!bg-background [&>button]:!border-border/50 [&>button]:!text-muted-foreground [&>button:hover]:!bg-accent"
        />
      </ReactFlow>
    </div>
  );
}
