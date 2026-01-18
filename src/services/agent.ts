/**
 * Agent 服务层
 * 
 * 提供 Agent 配置的读写操作，调用 Tauri 后端命令
 */

import { invoke } from "@tauri-apps/api/core";
import type { AgentDefinition } from "@/types/agent";

// ============================================================================
// 类型定义
// ============================================================================

/** Agent 摘要信息 (从后端返回) */
export interface AgentSummary {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  modelId: string;
  builtin?: boolean;
  updatedAt: number;
}

// ============================================================================
// 服务函数
// ============================================================================

/**
 * 获取 Agent 配置存储目录
 */
export async function getAgentsDirectory(): Promise<string> {
  return await invoke<string>("get_agents_directory");
}

/**
 * 列出所有 Agent 配置摘要
 */
export async function listAgents(): Promise<AgentSummary[]> {
  return await invoke<AgentSummary[]>("list_agents");
}

/**
 * 读取单个 Agent 完整配置
 */
export async function readAgent(agentId: string): Promise<AgentDefinition> {
  const jsonStr = await invoke<string>("read_agent", { agentId });
  return JSON.parse(jsonStr) as AgentDefinition;
}

/**
 * 保存 Agent 配置
 */
export async function saveAgent(agent: AgentDefinition): Promise<void> {
  const config = JSON.stringify(agent);
  await invoke("save_agent", { agentId: agent.id, config });
}

/**
 * 删除 Agent 配置
 */
export async function deleteAgent(agentId: string): Promise<void> {
  await invoke("delete_agent", { agentId });
}

/**
 * 批量保存 Agent 配置
 */
export async function saveAgentsBatch(agents: AgentDefinition[]): Promise<void> {
  const agentPairs: [string, string][] = agents.map(agent => [
    agent.id,
    JSON.stringify(agent),
  ]);
  await invoke("save_agents_batch", { agents: agentPairs });
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 读取所有 Agent 完整配置
 */
export async function readAllAgents(): Promise<AgentDefinition[]> {
  const summaries = await listAgents();
  const agents = await Promise.all(
    summaries.map(summary => readAgent(summary.id))
  );
  return agents;
}

/**
 * 创建或更新 Agent
 * 如果 Agent 已存在则更新，否则创建新的
 */
export async function upsertAgent(agent: AgentDefinition): Promise<void> {
  agent.updatedAt = Date.now();
  await saveAgent(agent);
}
