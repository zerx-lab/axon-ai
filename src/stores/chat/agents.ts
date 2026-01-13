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

export function useRefreshAgents(
  client: OpencodeClient | null,
  selectedAgentRef: React.MutableRefObject<string | null>,
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>,
  setSelectedAgent: React.Dispatch<React.SetStateAction<string | null>>,
  setIsLoadingAgents: React.Dispatch<React.SetStateAction<boolean>>
) {
  return useCallback(async () => {
    if (!client) return;

    setIsLoadingAgents(true);
    try {
      const response = await client.app.agents();

      if (response.data) {
        const allAgents = response.data as Agent[];
        const visibleAgents = allAgents.filter(
          (a) => a.mode !== "subagent" && !a.hidden
        );
        setAgents(visibleAgents);

        if (visibleAgents.length > 0 && !selectedAgentRef.current) {
          const savedAgent = loadSavedAgent();
          const agentToSelect =
            savedAgent && visibleAgents.some((a) => a.name === savedAgent)
              ? savedAgent
              : visibleAgents[0].name;
          setSelectedAgent(agentToSelect);
          saveAgent(agentToSelect);
        }
      }
    } catch (e) {
      console.error("[agents] Failed to load agents:", e);
    } finally {
      setIsLoadingAgents(false);
    }
  }, [client, selectedAgentRef, setAgents, setSelectedAgent, setIsLoadingAgents]);
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
