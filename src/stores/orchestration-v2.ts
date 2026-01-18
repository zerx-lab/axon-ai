/**
 * 编排组 Store (v2)
 *
 * 新版编排组状态管理，使用嵌入式 Agent 模型
 */

import { create } from "zustand";
import type {
  OrchestrationGroup,
  OrchestrationGroupSummary,
  AgentConfig,
  EmbeddedSubagent,
  DelegationRule,
  DelegationRuleset,
  CanvasViewport,
  CanvasNodePosition,
  OrchestrationEdge,
  OrchestrationEdgeType,
} from "@/types/orchestration";
import {
  createDefaultOrchestrationGroup,
  createDefaultEmbeddedSubagent,
  createDefaultDelegationRule,
  createDefaultOrchestrationEdge,
  toOrchestrationGroupSummary,
} from "@/types/orchestration";
import {
  readAllOrchestrations,
  saveOrchestration,
  deleteOrchestration as deleteOrchestrationFromFile,
} from "@/services/orchestration";

// ============================================================================
// 类型定义
// ============================================================================

/** 画布选择状态 */
interface CanvasSelection {
  type: "primary" | "subagent" | null;
  id: string | null;
}

/** Store 状态 */
interface OrchestrationState {
  // 编排组列表
  groups: OrchestrationGroup[];
  summaries: OrchestrationGroupSummary[];
  isLoading: boolean;
  error: string | null;

  // 当前选中
  selectedGroupId: string | null;
  canvasSelection: CanvasSelection;

  // 编辑状态
  hasUnsavedChanges: boolean;
}

/** Store 操作 */
interface OrchestrationActions {
  // 编排组 CRUD
  loadGroups: () => Promise<void>;
  createGroup: (partial?: Partial<OrchestrationGroup>) => Promise<OrchestrationGroup>;
  saveGroup: (group?: OrchestrationGroup) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  duplicateGroup: (groupId: string) => Promise<OrchestrationGroup>;

  // 选择操作
  selectGroup: (groupId: string | null) => void;
  getSelectedGroup: () => OrchestrationGroup | undefined;

  // 编排组更新
  updateGroup: (updates: Partial<OrchestrationGroup>) => void;

  // 主 Agent 配置
  updatePrimaryAgent: (config: Partial<AgentConfig>) => void;
  updatePrimaryPosition: (position: CanvasNodePosition) => void;

  // 子 Agent 管理（嵌入式）
  addSubagent: (position?: CanvasNodePosition) => EmbeddedSubagent;
  removeSubagent: (subagentId: string) => void;
  updateSubagent: (subagentId: string, updates: Partial<EmbeddedSubagent>) => void;
  updateSubagentConfig: (subagentId: string, config: Partial<AgentConfig>) => void;
  updateSubagentPosition: (subagentId: string, position: CanvasNodePosition) => void;
  toggleSubagentEnabled: (subagentId: string) => void;

  // 委托规则
  addDelegationRule: (subagentId: string) => DelegationRule;
  removeDelegationRule: (ruleId: string) => void;
  updateDelegationRule: (ruleId: string, updates: Partial<DelegationRule>) => void;
  updateDelegationRuleset: (updates: Partial<DelegationRuleset>) => void;

  // 连线管理
  addEdge: (source: string, target: string, type?: OrchestrationEdgeType) => OrchestrationEdge;
  removeEdge: (edgeId: string) => void;
  updateEdge: (edgeId: string, updates: Partial<OrchestrationEdge>) => void;
  removeEdgesForNode: (nodeId: string) => void;

  // 画布操作
  setCanvasSelection: (selection: CanvasSelection) => void;
  clearCanvasSelection: () => void;
  updateCanvasViewport: (viewport: CanvasViewport) => void;

  // 重置
  reset: () => void;
}

type OrchestrationStore = OrchestrationState & OrchestrationActions;

// ============================================================================
// 初始状态
// ============================================================================

const initialState: OrchestrationState = {
  groups: [],
  summaries: [],
  isLoading: false,
  error: null,
  selectedGroupId: null,
  canvasSelection: { type: null, id: null },
  hasUnsavedChanges: false,
};

// ============================================================================
// Store 实现
// ============================================================================

export const useOrchestrationStoreV2 = create<OrchestrationStore>()((set, get) => ({
  ...initialState,

  // ==========================================================================
  // 编排组 CRUD
  // ==========================================================================

  loadGroups: async () => {
    set({ isLoading: true, error: null });

    try {
      const groups = await readAllOrchestrations();
      const summaries = groups.map(toOrchestrationGroupSummary);

      set({
        groups,
        summaries,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({
        isLoading: false,
        error: message,
      });
      console.error("加载编排组失败:", message);
    }
  },

  createGroup: async (partial) => {
    const group = createDefaultOrchestrationGroup(partial);

    try {
      await saveOrchestration(group);

      set((state) => ({
        groups: [...state.groups, group],
        summaries: [...state.summaries, toOrchestrationGroupSummary(group)],
        selectedGroupId: group.id,
        hasUnsavedChanges: false,
      }));

      return group;
    } catch (error) {
      console.error("创建编排组失败:", error);
      throw error;
    }
  },

  saveGroup: async (groupToSave) => {
    const { selectedGroupId, groups } = get();
    const group = groupToSave || groups.find((g) => g.id === selectedGroupId);

    if (!group) {
      console.warn("没有要保存的编排组");
      return;
    }

    try {
      group.updatedAt = Date.now();
      await saveOrchestration(group);

      set((state) => ({
        groups: state.groups.map((g) => (g.id === group.id ? group : g)),
        summaries: state.summaries.map((s) =>
          s.id === group.id ? toOrchestrationGroupSummary(group) : s
        ),
        hasUnsavedChanges: false,
      }));
    } catch (error) {
      console.error("保存编排组失败:", error);
      throw error;
    }
  },

  deleteGroup: async (groupId) => {
    try {
      await deleteOrchestrationFromFile(groupId);

      set((state) => ({
        groups: state.groups.filter((g) => g.id !== groupId),
        summaries: state.summaries.filter((s) => s.id !== groupId),
        selectedGroupId: state.selectedGroupId === groupId ? null : state.selectedGroupId,
        canvasSelection: { type: null, id: null },
      }));
    } catch (error) {
      console.error("删除编排组失败:", error);
      throw error;
    }
  },

  duplicateGroup: async (groupId) => {
    const { groups } = get();
    const original = groups.find((g) => g.id === groupId);

    if (!original) {
      throw new Error(`编排组 ${groupId} 不存在`);
    }

    const now = Date.now();
    const duplicate: OrchestrationGroup = {
      ...JSON.parse(JSON.stringify(original)), // 深拷贝
      id: `orch-${now}-${Math.random().toString(36).slice(2, 9)}`,
      name: `${original.name} (副本)`,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await saveOrchestration(duplicate);

      set((state) => ({
        groups: [...state.groups, duplicate],
        summaries: [...state.summaries, toOrchestrationGroupSummary(duplicate)],
      }));

      return duplicate;
    } catch (error) {
      console.error("复制编排组失败:", error);
      throw error;
    }
  },

  // ==========================================================================
  // 选择操作
  // ==========================================================================

  selectGroup: (groupId) => {
    set({
      selectedGroupId: groupId,
      canvasSelection: { type: null, id: null },
      hasUnsavedChanges: false,
    });
  },

  getSelectedGroup: () => {
    const { groups, selectedGroupId } = get();
    return groups.find((g) => g.id === selectedGroupId);
  },

  // ==========================================================================
  // 编排组更新
  // ==========================================================================

  updateGroup: (updates) => {
    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) =>
          g.id === state.selectedGroupId
            ? { ...g, ...updates, updatedAt: Date.now() }
            : g
        ),
        hasUnsavedChanges: true,
      };
    });
  },

  // ==========================================================================
  // 主 Agent 配置
  // ==========================================================================

  updatePrimaryAgent: (config) => {
    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) =>
          g.id === state.selectedGroupId
            ? {
                ...g,
                primaryAgent: { ...g.primaryAgent, ...config },
                updatedAt: Date.now(),
              }
            : g
        ),
        hasUnsavedChanges: true,
      };
    });
  },

  updatePrimaryPosition: (position) => {
    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) =>
          g.id === state.selectedGroupId
            ? { ...g, primaryPosition: position, updatedAt: Date.now() }
            : g
        ),
        hasUnsavedChanges: true,
      };
    });
  },

  // ==========================================================================
  // 子 Agent 管理
  // ==========================================================================

  addSubagent: (position) => {
    const { selectedGroupId, groups } = get();
    if (!selectedGroupId) {
      throw new Error("没有选中的编排组");
    }

    const selectedGroup = groups.find((g) => g.id === selectedGroupId);
    if (!selectedGroup) {
      throw new Error("选中的编排组不存在");
    }

    // 计算新位置（基于现有子 Agent 数量）
    const yOffset = selectedGroup.subagents.length * 120;
    const subagent = createDefaultEmbeddedSubagent({
      position: position || { x: 200, y: 300 + yOffset },
    });

    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === state.selectedGroupId
          ? {
              ...g,
              subagents: [...g.subagents, subagent],
              updatedAt: Date.now(),
            }
          : g
      ),
      hasUnsavedChanges: true,
    }));

    return subagent;
  },

  removeSubagent: (subagentId) => {
    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) => {
          if (g.id !== state.selectedGroupId) return g;

          return {
            ...g,
            subagents: g.subagents.filter((s) => s.id !== subagentId),
            edges: (g.edges || []).filter(
              (e) => e.source !== subagentId && e.target !== subagentId
            ),
            delegationRuleset: {
              ...g.delegationRuleset,
              rules: g.delegationRuleset.rules.filter(
                (r) => r.subagentId !== subagentId
              ),
            },
            updatedAt: Date.now(),
          };
        }),
        canvasSelection:
          state.canvasSelection.id === subagentId
            ? { type: null, id: null }
            : state.canvasSelection,
        hasUnsavedChanges: true,
      };
    });
  },

  updateSubagent: (subagentId, updates) => {
    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) => {
          if (g.id !== state.selectedGroupId) return g;

          return {
            ...g,
            subagents: g.subagents.map((s) =>
              s.id === subagentId ? { ...s, ...updates } : s
            ),
            updatedAt: Date.now(),
          };
        }),
        hasUnsavedChanges: true,
      };
    });
  },

  updateSubagentConfig: (subagentId, config) => {
    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) => {
          if (g.id !== state.selectedGroupId) return g;

          return {
            ...g,
            subagents: g.subagents.map((s) =>
              s.id === subagentId
                ? { ...s, config: { ...s.config, ...config } }
                : s
            ),
            updatedAt: Date.now(),
          };
        }),
        hasUnsavedChanges: true,
      };
    });
  },

  updateSubagentPosition: (subagentId, position) => {
    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) => {
          if (g.id !== state.selectedGroupId) return g;

          return {
            ...g,
            subagents: g.subagents.map((s) =>
              s.id === subagentId ? { ...s, position } : s
            ),
            updatedAt: Date.now(),
          };
        }),
        hasUnsavedChanges: true,
      };
    });
  },

  toggleSubagentEnabled: (subagentId) => {
    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) => {
          if (g.id !== state.selectedGroupId) return g;

          return {
            ...g,
            subagents: g.subagents.map((s) =>
              s.id === subagentId ? { ...s, enabled: !s.enabled } : s
            ),
            updatedAt: Date.now(),
          };
        }),
        hasUnsavedChanges: true,
      };
    });
  },

  // ==========================================================================
  // 委托规则
  // ==========================================================================

  addDelegationRule: (subagentId) => {
    const rule = createDefaultDelegationRule(subagentId);

    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) => {
          if (g.id !== state.selectedGroupId) return g;

          return {
            ...g,
            delegationRuleset: {
              ...g.delegationRuleset,
              rules: [...g.delegationRuleset.rules, rule],
            },
            updatedAt: Date.now(),
          };
        }),
        hasUnsavedChanges: true,
      };
    });

    return rule;
  },

  removeDelegationRule: (ruleId) => {
    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) => {
          if (g.id !== state.selectedGroupId) return g;

          return {
            ...g,
            delegationRuleset: {
              ...g.delegationRuleset,
              rules: g.delegationRuleset.rules.filter((r) => r.id !== ruleId),
            },
            updatedAt: Date.now(),
          };
        }),
        hasUnsavedChanges: true,
      };
    });
  },

  updateDelegationRule: (ruleId, updates) => {
    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) => {
          if (g.id !== state.selectedGroupId) return g;

          return {
            ...g,
            delegationRuleset: {
              ...g.delegationRuleset,
              rules: g.delegationRuleset.rules.map((r) =>
                r.id === ruleId ? { ...r, ...updates } : r
              ),
            },
            updatedAt: Date.now(),
          };
        }),
        hasUnsavedChanges: true,
      };
    });
  },

  updateDelegationRuleset: (updates) => {
    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) => {
          if (g.id !== state.selectedGroupId) return g;

          return {
            ...g,
            delegationRuleset: { ...g.delegationRuleset, ...updates },
            updatedAt: Date.now(),
          };
        }),
        hasUnsavedChanges: true,
      };
    });
  },

  // ==========================================================================
  // 连线管理
  // ==========================================================================

  addEdge: (source, target, type = "delegation") => {
    const edge = createDefaultOrchestrationEdge(source, target, { type });

    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) => {
          if (g.id !== state.selectedGroupId) return g;

          const edges = g.edges || [];
          const exists = edges.some(
            (e) => e.source === source && e.target === target
          );
          if (exists) return g;

          return {
            ...g,
            edges: [...edges, edge],
            updatedAt: Date.now(),
          };
        }),
        hasUnsavedChanges: true,
      };
    });

    return edge;
  },

  removeEdge: (edgeId) => {
    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) => {
          if (g.id !== state.selectedGroupId) return g;

          return {
            ...g,
            edges: (g.edges || []).filter((e) => e.id !== edgeId),
            updatedAt: Date.now(),
          };
        }),
        hasUnsavedChanges: true,
      };
    });
  },

  updateEdge: (edgeId, updates) => {
    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) => {
          if (g.id !== state.selectedGroupId) return g;

          return {
            ...g,
            edges: (g.edges || []).map((e) =>
              e.id === edgeId ? { ...e, ...updates } : e
            ),
            updatedAt: Date.now(),
          };
        }),
        hasUnsavedChanges: true,
      };
    });
  },

  removeEdgesForNode: (nodeId) => {
    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) => {
          if (g.id !== state.selectedGroupId) return g;

          return {
            ...g,
            edges: (g.edges || []).filter(
              (e) => e.source !== nodeId && e.target !== nodeId
            ),
            updatedAt: Date.now(),
          };
        }),
        hasUnsavedChanges: true,
      };
    });
  },

  // ==========================================================================
  // 画布操作
  // ==========================================================================

  setCanvasSelection: (selection) => {
    set({ canvasSelection: selection });
  },

  clearCanvasSelection: () => {
    set({ canvasSelection: { type: null, id: null } });
  },

  updateCanvasViewport: (viewport) => {
    set((state) => {
      if (!state.selectedGroupId) return state;

      return {
        groups: state.groups.map((g) =>
          g.id === state.selectedGroupId
            ? { ...g, canvasViewport: viewport, updatedAt: Date.now() }
            : g
        ),
        hasUnsavedChanges: true,
      };
    });
  },

  // ==========================================================================
  // 重置
  // ==========================================================================

  reset: () => {
    set(initialState);
  },
}));

// ============================================================================
// 选择器 Hooks
// ============================================================================

/** 获取当前选中的编排组 */
export function useSelectedOrchestrationGroup(): OrchestrationGroup | undefined {
  return useOrchestrationStoreV2((state) => {
    if (!state.selectedGroupId) return undefined;
    return state.groups.find((g) => g.id === state.selectedGroupId);
  });
}

/** 获取当前选中的子 Agent */
export function useSelectedSubagent(): EmbeddedSubagent | undefined {
  return useOrchestrationStoreV2((state) => {
    if (!state.selectedGroupId || state.canvasSelection.type !== "subagent") {
      return undefined;
    }

    const group = state.groups.find((g) => g.id === state.selectedGroupId);
    if (!group) return undefined;

    return group.subagents.find((s) => s.id === state.canvasSelection.id);
  });
}

/** 获取编排组摘要列表 */
export function useOrchestrationSummaries(): OrchestrationGroupSummary[] {
  return useOrchestrationStoreV2((state) => state.summaries);
}
