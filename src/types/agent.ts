/**
 * Agent 配置类型定义
 * 
 * 定义完整的 Agent 可配置项，用户可自由创建和配置 Agent
 */

export type AgentMode = "primary" | "subagent" | "all";

export type PermissionValue = "ask" | "allow" | "deny";

export type AgentCategory = "exploration" | "specialist" | "advisor" | "utility" | "orchestrator";

export type AgentCost = "free" | "cheap" | "medium" | "expensive";

export type ReasoningEffort = "low" | "medium" | "high";

export type TextVerbosity = "low" | "medium" | "high";

export interface ModelConfig {
  modelId: string;
  provider?: string;
}

export interface ThinkingConfig {
  enabled: boolean;
  budgetTokens?: number;
}

export interface AgentParameters {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  thinking?: ThinkingConfig;
  reasoningEffort?: ReasoningEffort;
  textVerbosity?: TextVerbosity;
}

export interface RuntimeConfig {
  mode: AgentMode;
  hidden?: boolean;
  disabled?: boolean;
}

export type ToolAccessMode = "whitelist" | "blacklist" | "all";

export interface ToolsConfig {
  mode: ToolAccessMode;
  list: string[];
}

export type BashPermission = PermissionValue | Record<string, PermissionValue>;

export interface AgentPermissions {
  [toolId: string]: PermissionValue | BashPermission | undefined;
}

export interface PromptConfig {
  system?: string;
  append?: string;
}

export interface DelegationTrigger {
  domain: string;
  condition: string;
}

export interface AgentMetadata {
  category: AgentCategory;
  cost: AgentCost;
  triggers: DelegationTrigger[];
  useWhen: string[];
  avoidWhen: string[];
  keyTrigger?: string;
  promptAlias?: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  model: ModelConfig;
  parameters: AgentParameters;
  runtime: RuntimeConfig;
  tools: ToolsConfig;
  permissions: AgentPermissions;
  prompt: PromptConfig;
  category?: string;
  skills?: string[];
  metadata: AgentMetadata;
  createdAt: number;
  updatedAt: number;
  builtin?: boolean;
}

export function createDefaultAgentDefinition(partial?: Partial<AgentDefinition>): AgentDefinition {
  const now = Date.now();
  return {
    id: `agent-${now}-${Math.random().toString(36).slice(2, 9)}`,
    name: "New Agent",
    description: "",
    model: {
      modelId: "anthropic/claude-sonnet-4-5",
    },
    parameters: {
      temperature: 0.3,
    },
    runtime: {
      mode: "subagent",
    },
    tools: {
      mode: "all",
      list: [],
    },
    permissions: {
      edit: "ask",
      bash: "ask",
      webfetch: "allow",
    },
    prompt: {},
    metadata: {
      category: "utility",
      cost: "medium",
      triggers: [],
      useWhen: [],
      avoidWhen: [],
    },
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}
