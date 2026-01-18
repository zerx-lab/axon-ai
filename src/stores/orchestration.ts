import { create } from "zustand";
import type {
  AgentDefinition,
  SubagentConfig,
  DelegationRule,
  DelegationRuleset,
  CanvasViewport,
  CanvasNodePosition,
} from "@/types/agent";
import {
  createDefaultSubagentConfig,
  createDefaultDelegationRule,
} from "@/types/agent";
import {
  listAgents,
  readAgent,
  saveAgent as saveAgentToFile,
  deleteAgent as deleteAgentFromFile,
  type AgentSummary,
} from "@/services/agent";

interface CanvasSelection {
  type: "primary" | "subagent" | "edge" | null;
  id: string | null;
}

interface AgentState {
  agents: AgentDefinition[];
  agentSummaries: AgentSummary[];
  isLoadingAgents: boolean;
  agentsError: string | null;
  
  selectedAgentId: string | null;
  canvasSelection: CanvasSelection;
  hasUnsavedChanges: boolean;
}

interface AgentActions {
  loadAgents: () => Promise<void>;
  loadAgent: (agentId: string) => Promise<AgentDefinition | null>;
  saveAgent: (agent: AgentDefinition) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  getAgentById: (agentId: string) => AgentDefinition | undefined;
  
  selectAgent: (agentId: string | null) => void;
  getSelectedAgent: () => AgentDefinition | undefined;
  updateSelectedAgent: (updates: Partial<AgentDefinition>) => void;
  
  addSubagent: (agentId: string, position?: CanvasNodePosition) => SubagentConfig | null;
  removeSubagent: (subagentId: string) => void;
  updateSubagent: (subagentId: string, updates: Partial<SubagentConfig>) => void;
  updateSubagentPosition: (subagentId: string, position: CanvasNodePosition) => void;
  toggleSubagentEnabled: (subagentId: string) => void;
  
  updatePrimaryPosition: (position: CanvasNodePosition) => void;
  
  addDelegationRule: (subagentId: string) => DelegationRule | null;
  removeDelegationRule: (ruleId: string) => void;
  updateDelegationRule: (ruleId: string, updates: Partial<DelegationRule>) => void;
  updateDelegationRuleset: (updates: Partial<DelegationRuleset>) => void;
  
  setCanvasSelection: (selection: CanvasSelection) => void;
  clearCanvasSelection: () => void;
  updateCanvasViewport: (viewport: CanvasViewport) => void;
  
  reset: () => void;
}

type AgentStore = AgentState & AgentActions;

const initialState: AgentState = {
  agents: [],
  agentSummaries: [],
  isLoadingAgents: false,
  agentsError: null,
  selectedAgentId: null,
  canvasSelection: { type: null, id: null },
  hasUnsavedChanges: false,
};

export const useOrchestrationStore = create<AgentStore>()((set, get) => ({
  ...initialState,

  loadAgents: async () => {
    set({ isLoadingAgents: true, agentsError: null });
    
    try {
      const summaries = await listAgents();
      set({ agentSummaries: summaries });
      
      const agents = await Promise.all(
        summaries.map(async (summary) => {
          try {
            return await readAgent(summary.id);
          } catch {
            console.error(`加载 agent ${summary.id} 失败`);
            return null;
          }
        })
      );
      
      set({
        agents: agents.filter((a): a is AgentDefinition => a !== null),
        isLoadingAgents: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({
        isLoadingAgents: false,
        agentsError: message,
      });
      console.error("加载 agents 失败:", message);
    }
  },

  loadAgent: async (agentId) => {
    try {
      const agent = await readAgent(agentId);
      
      set((state) => {
        const existingIndex = state.agents.findIndex((a) => a.id === agentId);
        const newAgents = [...state.agents];
        
        if (existingIndex >= 0) {
          newAgents[existingIndex] = agent;
        } else {
          newAgents.push(agent);
        }
        
        return { agents: newAgents };
      });
      
      return agent;
    } catch (error) {
      console.error(`加载 agent ${agentId} 失败:`, error);
      return null;
    }
  },

  saveAgent: async (agent) => {
    try {
      agent.updatedAt = Date.now();
      await saveAgentToFile(agent);
      
      set((state) => {
        const existingIndex = state.agents.findIndex((a) => a.id === agent.id);
        const newAgents = [...state.agents];
        
        if (existingIndex >= 0) {
          newAgents[existingIndex] = agent;
        } else {
          newAgents.push(agent);
        }
        
        const summaryIndex = state.agentSummaries.findIndex((s) => s.id === agent.id);
        const newSummaries = [...state.agentSummaries];
        const summary: AgentSummary = {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          icon: agent.icon,
          color: agent.color,
          modelId: agent.model.modelId,
          builtin: agent.builtin,
          updatedAt: agent.updatedAt,
        };
        
        if (summaryIndex >= 0) {
          newSummaries[summaryIndex] = summary;
        } else {
          newSummaries.push(summary);
        }
        
        return { agents: newAgents, agentSummaries: newSummaries };
      });
    } catch (error) {
      console.error(`保存 agent ${agent.id} 失败:`, error);
      throw error;
    }
  },

  deleteAgent: async (agentId) => {
    try {
      await deleteAgentFromFile(agentId);
      
      set((state) => ({
        agents: state.agents.filter((a) => a.id !== agentId),
        agentSummaries: state.agentSummaries.filter((s) => s.id !== agentId),
      }));
    } catch (error) {
      console.error(`删除 agent ${agentId} 失败:`, error);
      throw error;
    }
  },

  getAgentById: (agentId) => {
    return get().agents.find((a) => a.id === agentId);
  },

  selectAgent: (agentId) => {
    set({
      selectedAgentId: agentId,
      canvasSelection: { type: null, id: null },
      hasUnsavedChanges: false,
    });
  },

  getSelectedAgent: () => {
    const { agents, selectedAgentId } = get();
    return agents.find((a) => a.id === selectedAgentId);
  },

  updateSelectedAgent: (updates) => {
    set((state) => {
      if (!state.selectedAgentId) return state;
      return {
        agents: state.agents.map((a) =>
          a.id === state.selectedAgentId ? { ...a, ...updates, updatedAt: Date.now() } : a
        ),
        hasUnsavedChanges: true,
      };
    });
  },

  addSubagent: (agentId, position) => {
    const { selectedAgentId, agents } = get();
    if (!selectedAgentId) return null;

    const selectedAgent = agents.find((a) => a.id === selectedAgentId);
    if (!selectedAgent) return null;

    const yOffset = (selectedAgent.subagents?.length ?? 0) * 120;
    const subagent = createDefaultSubagentConfig(agentId, {
      position: position || { x: 200, y: 300 + yOffset },
    });

    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === state.selectedAgentId
          ? { ...a, subagents: [...(a.subagents ?? []), subagent], updatedAt: Date.now() }
          : a
      ),
      hasUnsavedChanges: true,
    }));

    return subagent;
  },

  removeSubagent: (subagentId) => {
    set((state) => {
      if (!state.selectedAgentId) return state;
      return {
        agents: state.agents.map((a) => {
          if (a.id !== state.selectedAgentId) return a;
          const currentRuleset = a.delegationRuleset ?? { rules: [], defaultBehavior: "handle-self" as const };
          return {
            ...a,
            subagents: (a.subagents ?? []).filter((s) => s.id !== subagentId),
            delegationRuleset: {
              ...currentRuleset,
              rules: (currentRuleset.rules ?? []).filter((r) => r.subagentId !== subagentId),
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
      if (!state.selectedAgentId) return state;
      return {
        agents: state.agents.map((a) => {
          if (a.id !== state.selectedAgentId) return a;
          return {
            ...a,
            subagents: (a.subagents ?? []).map((s) =>
              s.id === subagentId ? { ...s, ...updates } : s
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
      if (!state.selectedAgentId) return state;
      return {
        agents: state.agents.map((a) => {
          if (a.id !== state.selectedAgentId) return a;
          return {
            ...a,
            subagents: (a.subagents ?? []).map((s) =>
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
      if (!state.selectedAgentId) return state;
      return {
        agents: state.agents.map((a) => {
          if (a.id !== state.selectedAgentId) return a;
          return {
            ...a,
            subagents: (a.subagents ?? []).map((s) =>
              s.id === subagentId ? { ...s, enabled: !s.enabled } : s
            ),
            updatedAt: Date.now(),
          };
        }),
        hasUnsavedChanges: true,
      };
    });
  },

  updatePrimaryPosition: (position) => {
    set((state) => {
      if (!state.selectedAgentId) return state;
      return {
        agents: state.agents.map((a) =>
          a.id === state.selectedAgentId
            ? { ...a, primaryPosition: position, updatedAt: Date.now() }
            : a
        ),
        hasUnsavedChanges: true,
      };
    });
  },

  addDelegationRule: (subagentId) => {
    const { selectedAgentId } = get();
    if (!selectedAgentId) return null;

    const rule = createDefaultDelegationRule(subagentId);

    set((state) => ({
      agents: state.agents.map((a) => {
        if (a.id !== state.selectedAgentId) return a;
        const currentRuleset = a.delegationRuleset ?? { rules: [], defaultBehavior: "handle-self" as const };
        return {
          ...a,
          delegationRuleset: {
            ...currentRuleset,
            rules: [...(currentRuleset.rules ?? []), rule],
          },
          updatedAt: Date.now(),
        };
      }),
      hasUnsavedChanges: true,
    }));

    return rule;
  },

  removeDelegationRule: (ruleId) => {
    set((state) => {
      if (!state.selectedAgentId) return state;
      return {
        agents: state.agents.map((a) => {
          if (a.id !== state.selectedAgentId) return a;
          const currentRuleset = a.delegationRuleset ?? { rules: [], defaultBehavior: "handle-self" as const };
          return {
            ...a,
            delegationRuleset: {
              ...currentRuleset,
              rules: (currentRuleset.rules ?? []).filter((r) => r.id !== ruleId),
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
      if (!state.selectedAgentId) return state;
      return {
        agents: state.agents.map((a) => {
          if (a.id !== state.selectedAgentId) return a;
          const currentRuleset = a.delegationRuleset ?? { rules: [], defaultBehavior: "handle-self" as const };
          return {
            ...a,
            delegationRuleset: {
              ...currentRuleset,
              rules: (currentRuleset.rules ?? []).map((r) =>
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
      if (!state.selectedAgentId) return state;
      return {
        agents: state.agents.map((a) => {
          if (a.id !== state.selectedAgentId) return a;
          const currentRuleset = a.delegationRuleset ?? { rules: [], defaultBehavior: "handle-self" as const };
          return {
            ...a,
            delegationRuleset: { ...currentRuleset, ...updates },
            updatedAt: Date.now(),
          };
        }),
        hasUnsavedChanges: true,
      };
    });
  },

  setCanvasSelection: (selection) => {
    set({ canvasSelection: selection });
  },

  clearCanvasSelection: () => {
    set({ canvasSelection: { type: null, id: null } });
  },

  updateCanvasViewport: (viewport) => {
    set((state) => {
      if (!state.selectedAgentId) return state;
      return {
        agents: state.agents.map((a) =>
          a.id === state.selectedAgentId
            ? { ...a, canvasViewport: viewport, updatedAt: Date.now() }
            : a
        ),
        hasUnsavedChanges: true,
      };
    });
  },

  reset: () => {
    set(initialState);
  },
}));
