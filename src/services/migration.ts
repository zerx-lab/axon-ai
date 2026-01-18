/**
 * 旧 AgentDefinition 到新 OrchestrationGroup 的迁移服务
 *
 * 迁移策略：
 * 1. 检测旧格式（SubagentConfig 包含 agentId 引用）
 * 2. 将引用模式转换为嵌入模式
 * 3. 保留原始数据作为备份
 */

import type { AgentDefinition, SubagentConfig } from "@/types/agent";
import type {
  OrchestrationGroup,
  AgentConfig,
  EmbeddedSubagent,
} from "@/types/orchestration";
import { createDefaultAgentConfig } from "@/types/orchestration";

/**
 * 从 AgentDefinition 提取 AgentConfig
 * 去除编排相关字段
 */
export function extractAgentConfig(def: AgentDefinition): AgentConfig {
  return {
    name: def.name,
    description: def.description,
    icon: def.icon,
    color: def.color,
    model: def.model,
    parameters: def.parameters,
    tools: def.tools,
    permissions: def.permissions,
    prompt: def.prompt,
    metadata: def.metadata,
    category: def.category,
    skills: def.skills,
  };
}

/**
 * 将旧的 SubagentConfig（引用模式）转换为 EmbeddedSubagent（嵌入模式）
 *
 * @param sub 旧的子 Agent 配置
 * @param allAgents 所有 Agent 列表（用于解析引用）
 */
export function migrateSubagentConfig(
  sub: SubagentConfig,
  allAgents: AgentDefinition[]
): EmbeddedSubagent {
  // 查找被引用的 Agent
  const referencedAgent = allAgents.find((a) => a.id === sub.agentId);

  // 基础配置：优先使用被引用 Agent，否则使用默认配置
  const baseConfig = referencedAgent
    ? extractAgentConfig(referencedAgent)
    : createDefaultAgentConfig();

  // 应用覆盖配置
  const config: AgentConfig = {
    ...baseConfig,
    // 覆盖名称和描述
    name: sub.name || baseConfig.name,
    description: sub.description || baseConfig.description,
    // 覆盖模型配置
    ...(sub.overrides?.model && { model: sub.overrides.model }),
    // 覆盖参数
    ...(sub.overrides?.parameters && {
      parameters: { ...baseConfig.parameters, ...sub.overrides.parameters },
    }),
    // 覆盖系统提示词
    ...(sub.overrides?.systemPrompt && {
      prompt: { ...baseConfig.prompt, system: sub.overrides.systemPrompt },
    }),
  };

  return {
    id: sub.id,
    config,
    triggers: sub.triggers,
    runInBackground: sub.runInBackground,
    enabled: sub.enabled,
    position: sub.position,
  };
}

/**
 * 将旧的 AgentDefinition 迁移为 OrchestrationGroup
 *
 * @param agent 要迁移的 Agent
 * @param allAgents 所有 Agent 列表（用于解析子 Agent 引用）
 */
export function migrateAgentToOrchestration(
  agent: AgentDefinition,
  allAgents: AgentDefinition[]
): OrchestrationGroup {
  // 迁移子 Agent（从引用转为嵌入）
  const migratedSubagents = (agent.subagents ?? []).map((sub) =>
    migrateSubagentConfig(sub, allAgents)
  );

  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    icon: agent.icon,
    color: agent.color,
    primaryAgent: extractAgentConfig(agent),
    primaryPosition: agent.primaryPosition,
    subagents: migratedSubagents,
    edges: [],
    delegationRuleset: agent.delegationRuleset ?? {
      rules: [],
      defaultBehavior: "handle-self",
    },
    canvasViewport: agent.canvasViewport,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  };
}

/**
 * 检测数据是否为旧格式（AgentDefinition with subagent references）
 */
export function isLegacyAgentFormat(data: unknown): data is AgentDefinition {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // 检查是否有 subagents 数组
  if (!("subagents" in obj) || !Array.isArray(obj.subagents)) {
    return false;
  }

  // 检查是否有 runtime.mode 字段（旧格式特有）
  if ("runtime" in obj && typeof obj.runtime === "object" && obj.runtime !== null) {
    const runtime = obj.runtime as Record<string, unknown>;
    if ("mode" in runtime) {
      return true;
    }
  }

  // 检查 subagents 是否包含 agentId 引用
  const subagents = obj.subagents as unknown[];
  return subagents.some((sub) => {
    if (typeof sub !== "object" || sub === null) return false;
    return "agentId" in sub;
  });
}

/**
 * 检测数据是否为新格式（OrchestrationGroup）
 */
export function isOrchestrationFormat(data: unknown): data is OrchestrationGroup {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // 新格式必须有 primaryAgent 字段
  if (!("primaryAgent" in obj)) {
    return false;
  }

  // 新格式的 subagents 应该包含 config 而不是 agentId
  if ("subagents" in obj && Array.isArray(obj.subagents)) {
    const subagents = obj.subagents as unknown[];
    return subagents.every((sub) => {
      if (typeof sub !== "object" || sub === null) return true; // 空数组也是合法的
      return "config" in sub && !("agentId" in sub);
    });
  }

  return true;
}

/**
 * 批量迁移所有 Agent
 */
export function migrateAllAgents(
  agents: AgentDefinition[]
): OrchestrationGroup[] {
  return agents.map((agent) => migrateAgentToOrchestration(agent, agents));
}

/**
 * 迁移结果
 */
export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * 安全迁移（带错误处理）
 */
export function safeMigrateAllAgents(
  agents: AgentDefinition[]
): { groups: OrchestrationGroup[]; result: MigrationResult } {
  const groups: OrchestrationGroup[] = [];
  const errors: Array<{ id: string; error: string }> = [];
  let skippedCount = 0;

  for (const agent of agents) {
    try {
      // 跳过纯子 Agent（mode === "subagent" 且没有自己的 subagents）
      if (
        agent.runtime.mode === "subagent" &&
        (!agent.subagents || agent.subagents.length === 0)
      ) {
        skippedCount++;
        continue;
      }

      const group = migrateAgentToOrchestration(agent, agents);
      groups.push(group);
    } catch (error) {
      errors.push({
        id: agent.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    groups,
    result: {
      success: errors.length === 0,
      migratedCount: groups.length,
      skippedCount,
      errors,
    },
  };
}
