/**
 * Agent 状态管理
 * 
 * 管理 Agent 配置的状态，包括加载、保存、删除
 * Agent 配置保存到本地文件
 */

import { create } from "zustand";
import type { AgentDefinition } from "@/types/agent";
import {
  listAgents,
  readAgent,
  saveAgent as saveAgentToFile,
  deleteAgent as deleteAgentFromFile,
  type AgentSummary,
} from "@/services/agent";

interface AgentState {
  agents: AgentDefinition[];
  agentSummaries: AgentSummary[];
  isLoadingAgents: boolean;
  agentsError: string | null;
}

interface AgentActions {
  loadAgents: () => Promise<void>;
  loadAgent: (agentId: string) => Promise<AgentDefinition | null>;
  saveAgent: (agent: AgentDefinition) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  getAgentById: (agentId: string) => AgentDefinition | undefined;
  reset: () => void;
}

type AgentStore = AgentState & AgentActions;

const initialState: AgentState = {
  agents: [],
  agentSummaries: [],
  isLoadingAgents: false,
  agentsError: null,
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

  reset: () => {
    set(initialState);
  },
}));
