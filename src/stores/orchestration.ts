/**
 * 编排状态管理
 * 
 * 管理工作流编排相关的状态，包括：
 * - 节点和边的管理
 * - 工作流的保存/加载
 * - Agent 配置
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Node, Edge } from "@xyflow/react";

// ============================================================================
// 类型定义
// ============================================================================

/** 节点类型 */
export type OrchestrationNodeType = "agent" | "parallel" | "sequence" | "start" | "end";

/** 节点数据 */
export interface OrchestrationNodeData extends Record<string, unknown> {
  label: string;
  type: OrchestrationNodeType;
  agentId?: string;
  toolId?: string;
  config?: Record<string, unknown>;
  description?: string;
}

/** 工作流定义 */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: Node<OrchestrationNodeData>[];
  edges: Edge[];
  createdAt: number;
  updatedAt: number;
}

/** Agent 配置 */
export interface AgentConfig {
  name: string;
  description?: string;
  mode: "primary" | "subagent" | "all";
  model?: string;
  prompt?: string;
  color?: string;
  hidden?: boolean;
  disable?: boolean;
}

// ============================================================================
// Store 定义
// ============================================================================

interface OrchestrationState {
  // 当前编辑的工作流
  currentWorkflow: Workflow | null;
  // 保存的工作流列表
  workflows: Workflow[];
  // 可用的 Agent 列表
  agents: AgentConfig[];
  // 选中的节点 ID
  selectedNodeId: string | null;
  // 是否有未保存的更改
  hasUnsavedChanges: boolean;
}

interface OrchestrationActions {
  // 工作流操作
  createWorkflow: (name: string, description?: string) => Workflow;
  loadWorkflow: (id: string) => void;
  saveWorkflow: () => void;
  deleteWorkflow: (id: string) => void;
  
  // 节点操作
  setNodes: (nodes: Node<OrchestrationNodeData>[]) => void;
  addNode: (node: Node<OrchestrationNodeData>) => void;
  updateNode: (id: string, data: Partial<OrchestrationNodeData>) => void;
  removeNode: (id: string) => void;
  
  // 边操作
  setEdges: (edges: Edge[]) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (id: string) => void;
  
  // 选择操作
  setSelectedNodeId: (id: string | null) => void;
  
  // Agent 操作
  setAgents: (agents: AgentConfig[]) => void;
  addAgent: (agent: AgentConfig) => void;
  updateAgent: (name: string, config: Partial<AgentConfig>) => void;
  removeAgent: (name: string) => void;
  
  // 工具函数
  reset: () => void;
}

type OrchestrationStore = OrchestrationState & OrchestrationActions;

// 初始状态
const initialState: OrchestrationState = {
  currentWorkflow: null,
  workflows: [],
  agents: [],
  selectedNodeId: null,
  hasUnsavedChanges: false,
};

// 生成唯一 ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const useOrchestrationStore = create<OrchestrationStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // 创建新工作流
      createWorkflow: (name, description) => {
        const now = Date.now();
        const workflow: Workflow = {
          id: generateId(),
          name,
          description,
          nodes: [],
          edges: [],
          createdAt: now,
          updatedAt: now,
        };
        
        set({
          currentWorkflow: workflow,
          hasUnsavedChanges: true,
        });
        
        return workflow;
      },

      // 加载工作流
      loadWorkflow: (id) => {
        const workflow = get().workflows.find((w) => w.id === id);
        if (workflow) {
          set({
            currentWorkflow: { ...workflow },
            hasUnsavedChanges: false,
          });
        }
      },

      // 保存工作流
      saveWorkflow: () => {
        const { currentWorkflow, workflows } = get();
        if (!currentWorkflow) return;

        const updatedWorkflow = {
          ...currentWorkflow,
          updatedAt: Date.now(),
        };

        const existingIndex = workflows.findIndex((w) => w.id === currentWorkflow.id);
        const updatedWorkflows = [...workflows];
        
        if (existingIndex >= 0) {
          updatedWorkflows[existingIndex] = updatedWorkflow;
        } else {
          updatedWorkflows.push(updatedWorkflow);
        }

        set({
          workflows: updatedWorkflows,
          currentWorkflow: updatedWorkflow,
          hasUnsavedChanges: false,
        });
      },

      // 删除工作流
      deleteWorkflow: (id) => {
        const { workflows, currentWorkflow } = get();
        set({
          workflows: workflows.filter((w) => w.id !== id),
          currentWorkflow: currentWorkflow?.id === id ? null : currentWorkflow,
        });
      },

      // 设置节点
      setNodes: (nodes) => {
        const { currentWorkflow } = get();
        if (!currentWorkflow) return;

        set({
          currentWorkflow: { ...currentWorkflow, nodes },
          hasUnsavedChanges: true,
        });
      },

      // 添加节点
      addNode: (node) => {
        const { currentWorkflow } = get();
        if (!currentWorkflow) return;

        set({
          currentWorkflow: {
            ...currentWorkflow,
            nodes: [...currentWorkflow.nodes, node],
          },
          hasUnsavedChanges: true,
        });
      },

      // 更新节点
      updateNode: (id, data) => {
        const { currentWorkflow } = get();
        if (!currentWorkflow) return;

        set({
          currentWorkflow: {
            ...currentWorkflow,
            nodes: currentWorkflow.nodes.map((node) =>
              node.id === id ? { ...node, data: { ...node.data, ...data } } : node
            ),
          },
          hasUnsavedChanges: true,
        });
      },

      // 移除节点
      removeNode: (id) => {
        const { currentWorkflow } = get();
        if (!currentWorkflow) return;

        set({
          currentWorkflow: {
            ...currentWorkflow,
            nodes: currentWorkflow.nodes.filter((node) => node.id !== id),
            edges: currentWorkflow.edges.filter(
              (edge) => edge.source !== id && edge.target !== id
            ),
          },
          hasUnsavedChanges: true,
          selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
        });
      },

      // 设置边
      setEdges: (edges) => {
        const { currentWorkflow } = get();
        if (!currentWorkflow) return;

        set({
          currentWorkflow: { ...currentWorkflow, edges },
          hasUnsavedChanges: true,
        });
      },

      // 添加边
      addEdge: (edge) => {
        const { currentWorkflow } = get();
        if (!currentWorkflow) return;

        set({
          currentWorkflow: {
            ...currentWorkflow,
            edges: [...currentWorkflow.edges, edge],
          },
          hasUnsavedChanges: true,
        });
      },

      // 移除边
      removeEdge: (id) => {
        const { currentWorkflow } = get();
        if (!currentWorkflow) return;

        set({
          currentWorkflow: {
            ...currentWorkflow,
            edges: currentWorkflow.edges.filter((edge) => edge.id !== id),
          },
          hasUnsavedChanges: true,
        });
      },

      // 设置选中节点
      setSelectedNodeId: (id) => {
        set({ selectedNodeId: id });
      },

      // 设置 Agent 列表
      setAgents: (agents) => {
        set({ agents });
      },

      // 添加 Agent
      addAgent: (agent) => {
        const { agents } = get();
        if (agents.some((a) => a.name === agent.name)) return;
        set({ agents: [...agents, agent] });
      },

      // 更新 Agent
      updateAgent: (name, config) => {
        const { agents } = get();
        set({
          agents: agents.map((a) =>
            a.name === name ? { ...a, ...config } : a
          ),
        });
      },

      // 移除 Agent
      removeAgent: (name) => {
        const { agents } = get();
        set({ agents: agents.filter((a) => a.name !== name) });
      },

      // 重置
      reset: () => {
        set(initialState);
      },
    }),
    {
      name: "axon-orchestration",
      partialize: (state) => ({
        workflows: state.workflows,
        agents: state.agents,
      }),
    }
  )
);
