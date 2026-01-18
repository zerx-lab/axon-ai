/**
 * Workflow 导出工具
 * 
 * 将 WorkflowDefinition 转换为 OpenCode 兼容的配置格式
 */

import type { WorkflowDefinition } from "@/types/workflow";
import type { AgentDefinition } from "@/types/agent";

/** OpenCode Agent 配置格式 */
interface OpenCodeAgentConfig {
  model?: string;
  prompt?: string;
  description?: string;
  mode?: "subagent" | "primary" | "all";
  color?: string;
  permission?: Record<string, "ask" | "allow" | "deny">;
  options?: Record<string, unknown>;
}

/** OpenCode 配置文件格式 */
interface OpenCodeConfig {
  $schema?: string;
  agent?: Record<string, OpenCodeAgentConfig>;
}

/**
 * 生成委托规则的系统提示片段
 */
function generateDelegationPrompt(
  workflow: WorkflowDefinition,
  agents: Map<string, AgentDefinition>
): string {
  const { delegationRuleset, subagents } = workflow;
  
  if (subagents.length === 0) {
    return "";
  }
  
  const lines: string[] = [
    "",
    "## 委托规则 (Delegation Rules)",
    "",
    "你有以下子 Agent 可以委托任务：",
    "",
  ];
  
  for (const subagent of subagents.filter(s => s.enabled)) {
    const agent = agents.get(subagent.agentId);
    const name = subagent.name || agent?.name || subagent.agentId;
    const description = subagent.description || agent?.description || "";
    
    lines.push(`- **${name}**: ${description}`);
  }
  
  if (delegationRuleset.rules.length > 0) {
    lines.push("");
    lines.push("### 委托触发条件");
    lines.push("");
    lines.push("| 领域 | 条件 | 目标 Agent | 优先级 |");
    lines.push("|------|------|-----------|--------|");
    
    for (const rule of delegationRuleset.rules.filter(r => r.enabled)) {
      const subagent = subagents.find(s => s.id === rule.subagentId);
      const agent = subagent ? agents.get(subagent.agentId) : undefined;
      const targetName = subagent?.name || agent?.name || rule.subagentId;
      
      lines.push(`| ${rule.domain} | ${rule.condition} | ${targetName} | ${rule.priority} |`);
    }
  }
  
  if (delegationRuleset.customGuidelines) {
    lines.push("");
    lines.push("### 自定义委托指南");
    lines.push("");
    lines.push(delegationRuleset.customGuidelines);
  }
  
  lines.push("");
  lines.push("### 默认行为");
  lines.push("");
  
  switch (delegationRuleset.defaultBehavior) {
    case "handle-self":
      lines.push("当没有规则匹配时，自己处理任务。");
      break;
    case "ask-user":
      lines.push("当没有规则匹配时，询问用户如何处理。");
      break;
    case "delegate-to":
      if (delegationRuleset.defaultSubagentId) {
        const defaultSubagent = subagents.find(s => s.id === delegationRuleset.defaultSubagentId);
        const defaultAgent = defaultSubagent ? agents.get(defaultSubagent.agentId) : undefined;
        const defaultName = defaultSubagent?.name || defaultAgent?.name || delegationRuleset.defaultSubagentId;
        lines.push(`当没有规则匹配时，委托给 **${defaultName}**。`);
      }
      break;
  }
  
  return lines.join("\n");
}

/**
 * 将 WorkflowDefinition 导出为 OpenCode 配置格式
 * 
 * @param workflow 工作流定义
 * @param agents Agent 定义映射（agentId -> AgentDefinition）
 * @returns OpenCode 配置 JSON 字符串
 */
export function exportWorkflowToOpenCode(
  workflow: WorkflowDefinition,
  agents: Map<string, AgentDefinition>
): string {
  const config: OpenCodeConfig = {
    $schema: "https://opencode.ai/config.json",
    agent: {},
  };
  
  const delegationPrompt = generateDelegationPrompt(workflow, agents);
  
  // 1. 导出主 Agent
  const primaryAgentName = workflow.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  
  let primaryPrompt = "";
  let primaryModel: string | undefined;
  
  if (workflow.primaryAgent.mode === "reference" && workflow.primaryAgent.agentId) {
    const refAgent = agents.get(workflow.primaryAgent.agentId);
    if (refAgent) {
      primaryPrompt = refAgent.prompt?.system || "";
      if (refAgent.model) {
        primaryModel = `${refAgent.model.provider || "anthropic"}/${refAgent.model.modelId}`;
      }
    }
  } else if (workflow.primaryAgent.mode === "inline" && workflow.primaryAgent.inline) {
    primaryPrompt = workflow.primaryAgent.inline.prompt?.system || "";
    if (workflow.primaryAgent.inline.model) {
      primaryModel = `${workflow.primaryAgent.inline.model.provider || "anthropic"}/${workflow.primaryAgent.inline.model.modelId}`;
    }
  }
  
  config.agent![primaryAgentName] = {
    mode: "primary",
    description: workflow.description || `${workflow.name} 工作流主 Agent`,
    prompt: primaryPrompt + delegationPrompt,
    color: workflow.color,
    ...(primaryModel && { model: primaryModel }),
  };
  
  // 2. 导出子 Agents
  for (const subagent of workflow.subagents.filter(s => s.enabled)) {
    const refAgent = agents.get(subagent.agentId);
    if (!refAgent) continue;
    
    const subagentName = (subagent.name || refAgent.name)
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    
    let prompt = refAgent.prompt?.system || "";
    let model: string | undefined;
    
    if (subagent.overrides?.systemPrompt) {
      prompt = subagent.overrides.systemPrompt;
    }
    
    if (subagent.overrides?.model) {
      model = `${subagent.overrides.model.provider || "anthropic"}/${subagent.overrides.model.modelId}`;
    } else if (refAgent.model) {
      model = `${refAgent.model.provider || "anthropic"}/${refAgent.model.modelId}`;
    }
    
    config.agent![subagentName] = {
      mode: "subagent",
      description: subagent.description || refAgent.description,
      prompt,
      ...(model && { model }),
    };
  }
  
  return JSON.stringify(config, null, 2);
}

/**
 * 生成 OpenCode 配置文件名
 */
export function getExportFileName(workflow: WorkflowDefinition): string {
  const safeName = workflow.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return `opencode-${safeName}.json`;
}
