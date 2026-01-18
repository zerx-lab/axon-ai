/**
 * Workflow 状态管理
 * 
 * 管理 Agent 工作流的状态，包括：
 * - 工作流列表的加载和管理
 * - 当前编辑中的工作流
 * - 工作流的 CRUD 操作
 * - 画布状态（节点选中、视口等）
 */

import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type WorkflowDefinition,
  type WorkflowSummary,
  type SubagentConfig,
  type DelegationRule,
  createDefaultWorkflow,
  createDefaultSubagentConfig,
  createDefaultDelegationRule,
  workflowToSummary,
} from "@/types/workflow";

// ============================================================================
// 类型定义
// ============================================================================

/** 画布选中状态 */
interface CanvasSelection {
  /** 选中的节点类型 */
  type: "primary" | "subagent" | "edge" | null;
  /** 选中的 ID（subagent 或 edge 的 ID） */
  id: string | null;
}

/** 工作流 Store 状态 */
interface WorkflowState {
  /** 工作流列表摘要 */
  workflows: WorkflowSummary[];
  
  /** 当前编辑中的工作流 */
  currentWorkflow: WorkflowDefinition | null;
  
  /** 是否有未保存的更改 */
  hasUnsavedChanges: boolean;
  
  /** 画布选中状态 */
  selection: CanvasSelection;
  
  /** 加载状态 */
  isLoading: boolean;
  
  /** 错误信息 */
  error: string | null;
}

/** 工作流 Store 操作 */
interface WorkflowActions {
  // ========== 工作流列表操作 ==========
  
  /** 加载工作流列表 */
  loadWorkflows: () => Promise<void>;
  
  /** 创建新工作流 */
  createWorkflow: (name?: string) => WorkflowDefinition;
  
  /** 删除工作流 */
  deleteWorkflow: (id: string) => Promise<void>;
  
  /** 复制工作流 */
  duplicateWorkflow: (id: string) => Promise<WorkflowDefinition | null>;
  
  // ========== 当前工作流操作 ==========
  
  /** 加载工作流到编辑器 */
  loadWorkflow: (id: string) => Promise<void>;
  
  /** 设置当前工作流（用于创建新工作流） */
  setCurrentWorkflow: (workflow: WorkflowDefinition) => void;
  
  /** 保存当前工作流 */
  saveCurrentWorkflow: () => Promise<void>;
  
  /** 关闭当前工作流 */
  closeCurrentWorkflow: () => void;
  
  /** 更新工作流基本信息 */
  updateWorkflowInfo: (updates: Partial<Pick<WorkflowDefinition, "name" | "description" | "icon" | "color" | "status">>) => void;
  
  // ========== 主 Agent 操作 ==========
  
  /** 更新主 Agent 配置 */
  updatePrimaryAgent: (updates: Partial<WorkflowDefinition["primaryAgent"]>) => void;
  
  /** 更新主 Agent 位置 */
  updatePrimaryAgentPosition: (position: { x: number; y: number }) => void;
  
  // ========== 子 Agent 操作 ==========
  
  /** 添加子 Agent */
  addSubagent: (agentId: string, position?: { x: number; y: number }) => SubagentConfig;
  
  /** 移除子 Agent */
  removeSubagent: (subagentId: string) => void;
  
  /** 更新子 Agent 配置 */
  updateSubagent: (subagentId: string, updates: Partial<SubagentConfig>) => void;
  
  /** 更新子 Agent 位置 */
  updateSubagentPosition: (subagentId: string, position: { x: number; y: number }) => void;
  
  /** 切换子 Agent 启用状态 */
  toggleSubagentEnabled: (subagentId: string) => void;
  
  // ========== 委托规则操作 ==========
  
  /** 添加委托规则 */
  addDelegationRule: (subagentId: string) => DelegationRule;
  
  /** 移除委托规则 */
  removeDelegationRule: (ruleId: string) => void;
  
  /** 更新委托规则 */
  updateDelegationRule: (ruleId: string, updates: Partial<DelegationRule>) => void;
  
  /** 更新委托规则集配置 */
  updateDelegationRuleset: (updates: Partial<WorkflowDefinition["delegationRuleset"]>) => void;
  
  // ========== 画布操作 ==========
  
  /** 设置选中状态 */
  setSelection: (selection: CanvasSelection) => void;
  
  /** 清除选中 */
  clearSelection: () => void;
  
  /** 更新视口 */
  updateViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  
  // ========== 工具函数 ==========
  
  /** 获取子 Agent 配置 */
  getSubagentById: (subagentId: string) => SubagentConfig | undefined;
  
  /** 获取委托规则 */
  getDelegationRuleById: (ruleId: string) => DelegationRule | undefined;
  
  /** 重置状态 */
  reset: () => void;
}

type WorkflowStore = WorkflowState & WorkflowActions;

// ============================================================================
// 初始状态
// ============================================================================

const initialState: WorkflowState = {
  workflows: [],
  currentWorkflow: null,
  hasUnsavedChanges: false,
  selection: { type: null, id: null },
  isLoading: false,
  error: null,
};

// ============================================================================
// Store 实现
// ============================================================================

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ========== 工作流列表操作 ==========

      loadWorkflows: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const summaries = await invoke<WorkflowSummary[]>("list_workflows");
          set({ workflows: summaries, isLoading: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          set({ error: message, isLoading: false });
          console.error("加载工作流列表失败:", message);
        }
      },

      createWorkflow: (name) => {
        const workflow = createDefaultWorkflow({
          name: name || "新建工作流",
        });
        
        set((state) => ({
          currentWorkflow: workflow,
          hasUnsavedChanges: true,
          workflows: [...state.workflows, workflowToSummary(workflow)],
        }));
        
        return workflow;
      },

      deleteWorkflow: async (id) => {
        try {
          await invoke("delete_workflow", { workflowId: id });
          
          set((state) => ({
            workflows: state.workflows.filter((w) => w.id !== id),
            currentWorkflow: state.currentWorkflow?.id === id ? null : state.currentWorkflow,
            hasUnsavedChanges: state.currentWorkflow?.id === id ? false : state.hasUnsavedChanges,
          }));
        } catch (error) {
          console.error("删除工作流失败:", error);
          throw error;
        }
      },

      duplicateWorkflow: async (id) => {
        try {
          const content = await invoke<string>("read_workflow", { workflowId: id });
          const source = JSON.parse(content) as WorkflowDefinition;
          
          const now = Date.now();
          const duplicate: WorkflowDefinition = {
            ...source,
            id: `workflow-${now}-${Math.random().toString(36).slice(2, 9)}`,
            name: `${source.name} (副本)`,
            createdAt: now,
            updatedAt: now,
            version: 1,
          };
          
          await invoke("save_workflow", { 
            workflowId: duplicate.id, 
            config: JSON.stringify(duplicate) 
          });
          
          set((state) => ({
            workflows: [...state.workflows, workflowToSummary(duplicate)],
          }));
          
          return duplicate;
        } catch (error) {
          console.error("复制工作流失败:", error);
          return null;
        }
      },

      // ========== 当前工作流操作 ==========

      loadWorkflow: async (id) => {
        set({ isLoading: true, error: null });
        
        try {
          const content = await invoke<string>("read_workflow", { workflowId: id });
          const workflow = JSON.parse(content) as WorkflowDefinition;
          
          set({
            currentWorkflow: workflow,
            hasUnsavedChanges: false,
            selection: { type: null, id: null },
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          set({ error: message, isLoading: false });
          console.error("加载工作流失败:", message);
        }
      },

      setCurrentWorkflow: (workflow) => {
        set({
          currentWorkflow: workflow,
          hasUnsavedChanges: false,
          selection: { type: null, id: null },
        });
      },

      saveCurrentWorkflow: async () => {
        const { currentWorkflow, workflows } = get();
        if (!currentWorkflow) return;
        
        try {
          const updated: WorkflowDefinition = {
            ...currentWorkflow,
            updatedAt: Date.now(),
            version: currentWorkflow.version + 1,
          };
          
          await invoke("save_workflow", {
            workflowId: updated.id,
            config: JSON.stringify(updated),
          });
          
          const isNew = !workflows.some((w) => w.id === updated.id);
          
          set((state) => ({
            currentWorkflow: updated,
            hasUnsavedChanges: false,
            workflows: isNew
              ? [...state.workflows, workflowToSummary(updated)]
              : state.workflows.map((w) =>
                  w.id === updated.id ? workflowToSummary(updated) : w
                ),
          }));
        } catch (error) {
          console.error("保存工作流失败:", error);
          throw error;
        }
      },

      closeCurrentWorkflow: () => {
        set({
          currentWorkflow: null,
          hasUnsavedChanges: false,
          selection: { type: null, id: null },
        });
      },

      updateWorkflowInfo: (updates) => {
        set((state) => {
          if (!state.currentWorkflow) return state;
          return {
            currentWorkflow: { ...state.currentWorkflow, ...updates },
            hasUnsavedChanges: true,
          };
        });
      },

      // ========== 主 Agent 操作 ==========

      updatePrimaryAgent: (updates) => {
        set((state) => {
          if (!state.currentWorkflow) return state;
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              primaryAgent: { ...state.currentWorkflow.primaryAgent, ...updates },
            },
            hasUnsavedChanges: true,
          };
        });
      },

      updatePrimaryAgentPosition: (position) => {
        set((state) => {
          if (!state.currentWorkflow) return state;
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              primaryAgent: { ...state.currentWorkflow.primaryAgent, position },
            },
            hasUnsavedChanges: true,
          };
        });
      },

      // ========== 子 Agent 操作 ==========

      addSubagent: (agentId, position) => {
        const subagent = createDefaultSubagentConfig(agentId, {
          position: position || { x: 200, y: 300 + Math.random() * 100 },
        });
        
        set((state) => {
          if (!state.currentWorkflow) return state;
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              subagents: [...state.currentWorkflow.subagents, subagent],
            },
            hasUnsavedChanges: true,
          };
        });
        
        return subagent;
      },

      removeSubagent: (subagentId) => {
        set((state) => {
          if (!state.currentWorkflow) return state;
          
          // 同时移除相关的委托规则
          const filteredRules = state.currentWorkflow.delegationRuleset.rules.filter(
            (r) => r.subagentId !== subagentId
          );
          
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              subagents: state.currentWorkflow.subagents.filter((s) => s.id !== subagentId),
              delegationRuleset: {
                ...state.currentWorkflow.delegationRuleset,
                rules: filteredRules,
              },
            },
            hasUnsavedChanges: true,
            // 如果删除的是选中的节点，清除选中
            selection: state.selection.id === subagentId 
              ? { type: null, id: null }
              : state.selection,
          };
        });
      },

      updateSubagent: (subagentId, updates) => {
        set((state) => {
          if (!state.currentWorkflow) return state;
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              subagents: state.currentWorkflow.subagents.map((s) =>
                s.id === subagentId ? { ...s, ...updates } : s
              ),
            },
            hasUnsavedChanges: true,
          };
        });
      },

      updateSubagentPosition: (subagentId, position) => {
        set((state) => {
          if (!state.currentWorkflow) return state;
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              subagents: state.currentWorkflow.subagents.map((s) =>
                s.id === subagentId ? { ...s, position } : s
              ),
            },
            hasUnsavedChanges: true,
          };
        });
      },

      toggleSubagentEnabled: (subagentId) => {
        set((state) => {
          if (!state.currentWorkflow) return state;
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              subagents: state.currentWorkflow.subagents.map((s) =>
                s.id === subagentId ? { ...s, enabled: !s.enabled } : s
              ),
            },
            hasUnsavedChanges: true,
          };
        });
      },

      // ========== 委托规则操作 ==========

      addDelegationRule: (subagentId) => {
        const rule = createDefaultDelegationRule(subagentId);
        
        set((state) => {
          if (!state.currentWorkflow) return state;
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              delegationRuleset: {
                ...state.currentWorkflow.delegationRuleset,
                rules: [...state.currentWorkflow.delegationRuleset.rules, rule],
              },
            },
            hasUnsavedChanges: true,
          };
        });
        
        return rule;
      },

      removeDelegationRule: (ruleId) => {
        set((state) => {
          if (!state.currentWorkflow) return state;
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              delegationRuleset: {
                ...state.currentWorkflow.delegationRuleset,
                rules: state.currentWorkflow.delegationRuleset.rules.filter(
                  (r) => r.id !== ruleId
                ),
              },
            },
            hasUnsavedChanges: true,
          };
        });
      },

      updateDelegationRule: (ruleId, updates) => {
        set((state) => {
          if (!state.currentWorkflow) return state;
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              delegationRuleset: {
                ...state.currentWorkflow.delegationRuleset,
                rules: state.currentWorkflow.delegationRuleset.rules.map((r) =>
                  r.id === ruleId ? { ...r, ...updates } : r
                ),
              },
            },
            hasUnsavedChanges: true,
          };
        });
      },

      updateDelegationRuleset: (updates) => {
        set((state) => {
          if (!state.currentWorkflow) return state;
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              delegationRuleset: { ...state.currentWorkflow.delegationRuleset, ...updates },
            },
            hasUnsavedChanges: true,
          };
        });
      },

      // ========== 画布操作 ==========

      setSelection: (selection) => {
        set({ selection });
      },

      clearSelection: () => {
        set({ selection: { type: null, id: null } });
      },

      updateViewport: (viewport) => {
        set((state) => {
          if (!state.currentWorkflow) return state;
          return {
            currentWorkflow: { ...state.currentWorkflow, viewport },
            hasUnsavedChanges: true,
          };
        });
      },

      // ========== 工具函数 ==========

      getSubagentById: (subagentId) => {
        const { currentWorkflow } = get();
        return currentWorkflow?.subagents.find((s) => s.id === subagentId);
      },

      getDelegationRuleById: (ruleId) => {
        const { currentWorkflow } = get();
        return currentWorkflow?.delegationRuleset.rules.find((r) => r.id === ruleId);
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: "axon-workflow-store",
      partialize: (state) => ({
        // 只持久化工作流列表，不持久化编辑状态
        workflows: state.workflows,
      }),
    }
  )
);
