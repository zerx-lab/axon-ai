import { useCallback } from "react";
import type { OpencodeClient } from "@/services/opencode";
import type { Agent } from "@/types/chat";

export const AGENT_STORAGE_KEY = "axon-selected-agent";

function loadSavedAgent(): string | null {
  try {
    return localStorage.getItem(AGENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveAgent(agentName: string | null): void {
  try {
    if (agentName) {
      localStorage.setItem(AGENT_STORAGE_KEY, agentName);
    } else {
      localStorage.removeItem(AGENT_STORAGE_KEY);
    }
  } catch {
  }
}

/**
 * 刷新 agents 列表
 * 
 * OpenCode 支持项目级自定义 agents（在 .opencode/agents/ 目录下）
 * 通过传递 directory 参数，可以获取该项目的自定义 agents
 * 
 * 区分两类 agents：
 * - 主代理（primaryAgents）：mode !== "subagent"，用于 AgentSelector 切换
 * - 子代理（subagents）：mode !== "primary"，用于 @ 提及调用 task tool
 * 
 * @param directory - 可选的项目目录，传入时会加载该目录的 .opencode 配置中的 agents
 */
export function useRefreshAgents(
  client: OpencodeClient | null,
  selectedAgentRef: React.MutableRefObject<string | null>,
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>,
  setSubagents: React.Dispatch<React.SetStateAction<Agent[]>>,
  setSelectedAgent: React.Dispatch<React.SetStateAction<string | null>>,
  setIsLoadingAgents: React.Dispatch<React.SetStateAction<boolean>>
) {
  return useCallback(async (directory?: string) => {
    if (!client) return;

    setIsLoadingAgents(true);
    try {
      // 传递 directory 参数以获取项目级 agents
      // OpenCode 会自动加载该目录下 .opencode/agents/ 中的自定义 agents
      const response = await client.app.agents({ directory });

      if (response.data) {
        const allAgents = response.data as Agent[];
        
        // 主代理：mode !== "subagent" && !hidden
        // 用于左下角 AgentSelector 切换
        const primaryAgents = allAgents.filter(
          (a) => a.mode !== "subagent" && !a.hidden
        );
        setAgents(primaryAgents);

        // 子代理：mode !== "primary" && !hidden
        // 用于 @ 提及，触发 task tool 调用
        const subagentList = allAgents.filter(
          (a) => a.mode !== "primary" && !a.hidden
        );
        setSubagents(subagentList);

        if (primaryAgents.length > 0 && !selectedAgentRef.current) {
          const savedAgent = loadSavedAgent();
          const agentToSelect =
            savedAgent && primaryAgents.some((a) => a.name === savedAgent)
              ? savedAgent
              : primaryAgents[0].name;
          setSelectedAgent(agentToSelect);
          saveAgent(agentToSelect);
        }
      }
    } catch (e) {
      console.error("[agents] Failed to load agents:", e);
    } finally {
      setIsLoadingAgents(false);
    }
  }, [client, selectedAgentRef, setAgents, setSubagents, setSelectedAgent, setIsLoadingAgents]);
}

export function useSelectAgent(
  agents: Agent[],
  setSelectedAgent: React.Dispatch<React.SetStateAction<string | null>>,
  setSelectedModel?: (providerId: string, modelId: string) => void
) {
  return useCallback(
    (agentName: string) => {
      const agent = agents.find((a) => a.name === agentName);
      if (!agent) return;

      setSelectedAgent(agentName);
      saveAgent(agentName);

      if (agent.model && setSelectedModel) {
        setSelectedModel(agent.model.providerID, agent.model.modelID);
      }
    },
    [agents, setSelectedAgent, setSelectedModel]
  );
}

export function useCycleAgent(
  agents: Agent[],
  selectedAgent: string | null,
  setSelectedAgent: React.Dispatch<React.SetStateAction<string | null>>,
  setSelectedModel?: (providerId: string, modelId: string) => void
) {
  return useCallback(
    (direction: 1 | -1 = 1) => {
      if (agents.length === 0) return;

      const currentIndex = agents.findIndex((a) => a.name === selectedAgent);
      let nextIndex = currentIndex + direction;

      if (nextIndex < 0) nextIndex = agents.length - 1;
      if (nextIndex >= agents.length) nextIndex = 0;

      const nextAgent = agents[nextIndex];
      if (!nextAgent) return;

      setSelectedAgent(nextAgent.name);
      saveAgent(nextAgent.name);

      if (nextAgent.model && setSelectedModel) {
        setSelectedModel(nextAgent.model.providerID, nextAgent.model.modelID);
      }
    },
    [agents, selectedAgent, setSelectedAgent, setSelectedModel]
  );
}

export function useAgentOperations(
  agents: Agent[],
  selectedAgent: string | null,
  setSelectedAgent: React.Dispatch<React.SetStateAction<string | null>>,
  setSelectedModel?: (providerId: string, modelId: string) => void
) {
  const selectAgent = useSelectAgent(agents, setSelectedAgent, setSelectedModel);
  const cycleAgent = useCycleAgent(
    agents,
    selectedAgent,
    setSelectedAgent,
    setSelectedModel
  );

  const currentAgent = useCallback(() => {
    if (!selectedAgent || agents.length === 0) return null;
    return agents.find((a) => a.name === selectedAgent) ?? agents[0] ?? null;
  }, [agents, selectedAgent]);

  return {
    selectAgent,
    cycleAgent,
    currentAgent,
  };
}
