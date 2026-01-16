/**
 * 编排页面组件
 * 
 * 提供多代理工作流的可视化编排界面：
 * - React Flow 画布用于节点拖拽和连接
 * - 工具栏和工作流列表已移动到 OrchestrationSidebar
 */

import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrchestrationStore, type OrchestrationNodeData } from "@/stores/orchestration";

// 自定义节点类型
import { AgentNode } from "./nodes/AgentNode";

// 节点类型映射
const nodeTypes = {
  agent: AgentNode,
};

interface OrchestrationPageProps {
  /** 添加节点回调 - 由外部提供 */
  onAddNodeRef?: React.MutableRefObject<((type: string) => void) | null>;
  /** 新建工作流回调 - 由外部提供 */
  onNewWorkflowRef?: React.MutableRefObject<(() => void) | null>;
  /** 保存工作流回调 - 由外部提供 */
  onSaveRef?: React.MutableRefObject<(() => void) | null>;
}

export function OrchestrationPage({
  onAddNodeRef,
  onNewWorkflowRef,
  onSaveRef,
}: OrchestrationPageProps) {
  const { t } = useTranslation();
  const {
    currentWorkflow,
    workflows,
    hasUnsavedChanges,
    createWorkflow,
    saveWorkflow,
    setNodes,
    setEdges,
    addNode,
  } = useOrchestrationStore();

  // 使用 React Flow 的节点和边状态
  const [nodes, setNodesState, onNodesChange] = useNodesState(
    currentWorkflow?.nodes ?? []
  );
  const [edges, setEdgesState, onEdgesChange] = useEdgesState(
    currentWorkflow?.edges ?? []
  );

  // 同步节点变化到 store
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      // 延迟同步到 store，避免频繁更新
      const timer = setTimeout(() => {
        setNodes(nodes);
      }, 100);
      return () => clearTimeout(timer);
    },
    [onNodesChange, setNodes, nodes]
  );

  // 同步边变化到 store
  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      const timer = setTimeout(() => {
        setEdges(edges);
      }, 100);
      return () => clearTimeout(timer);
    },
    [onEdgesChange, setEdges, edges]
  );

  // 连接处理
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdgesState((eds) => addEdge({
        ...connection,
        id: `${connection.source}-${connection.target}`,
        type: "smoothstep",
      }, eds));
    },
    [setEdgesState]
  );

  // 添加节点
  const handleAddNode = useCallback(
    (type: string) => {
      const id = `${type}-${Date.now()}`;
      const newNode: Node<OrchestrationNodeData> = {
        id,
        type,
        position: { x: 250, y: 200 },
        data: {
          label: `${type} 节点`,
          type: type as OrchestrationNodeData["type"],
        },
      };
      setNodesState((nds) => [...nds, newNode]);
      addNode(newNode);
    },
    [setNodesState, addNode]
  );

  // 创建新工作流
  const handleNewWorkflow = useCallback(() => {
    const name = `工作流 ${workflows.length + 1}`;
    createWorkflow(name);
    // 重置画布
    setNodesState([]);
    setEdgesState([]);
  }, [createWorkflow, workflows.length, setNodesState, setEdgesState]);

  // 保存工作流
  const handleSave = useCallback(() => {
    setNodes(nodes);
    setEdges(edges);
    saveWorkflow();
  }, [nodes, edges, setNodes, setEdges, saveWorkflow]);

  // 暴露回调函数给外部
  if (onAddNodeRef) {
    onAddNodeRef.current = handleAddNode;
  }
  if (onNewWorkflowRef) {
    onNewWorkflowRef.current = handleNewWorkflow;
  }
  if (onSaveRef) {
    onSaveRef.current = handleSave;
  }

  // Mini Map 节点颜色
  const nodeColor = useCallback((node: Node) => {
    switch (node.type) {
      case "agent":
        return "#3b82f6"; // blue
      case "input":
        return "#8b5cf6"; // purple
      case "output":
        return "#ef4444"; // red
      default:
        return "#6b7280"; // gray
    }
  }, []);

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-background"
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: true,
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls className="bg-background border border-border rounded" />
        <MiniMap
          nodeColor={nodeColor}
          className="bg-background border border-border rounded"
          maskColor="rgba(0, 0, 0, 0.1)"
        />
        
        {/* 顶部面板 - 工作流信息 */}
        <Panel position="top-left" className="flex items-center gap-2">
          {currentWorkflow ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-background/80 backdrop-blur border border-border rounded text-sm">
              <span className="font-medium">{currentWorkflow.name}</span>
              {hasUnsavedChanges && (
                <span className="text-muted-foreground">*</span>
              )}
            </div>
          ) : (
            <div className="px-3 py-1.5 bg-background/80 backdrop-blur border border-border rounded text-sm text-muted-foreground">
              {t("orchestration.noWorkflow", "未选择工作流")}
            </div>
          )}
        </Panel>

        {/* 空状态提示 */}
        {!currentWorkflow && (
          <Panel position="top-center" className="mt-20">
            <div className="flex flex-col items-center gap-4 p-8 bg-background/80 backdrop-blur border border-border rounded-lg">
              <div className="text-muted-foreground text-center">
                <p className="text-lg font-medium mb-2">
                  {t("orchestration.emptyTitle", "开始创建工作流")}
                </p>
                <p className="text-sm">
                  {t("orchestration.emptyDescription", "点击侧边栏的 + 按钮创建新的工作流")}
                </p>
              </div>
              <Button onClick={handleNewWorkflow} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                {t("orchestration.newWorkflow", "新建工作流")}
              </Button>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
