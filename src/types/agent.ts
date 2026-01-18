/**
 * Agent 配置类型定义
 * 
 * 定义完整的 Agent 可配置项，用户可自由创建和配置 Agent
 * 
 * 核心概念：
 * - Agent = 配置 + 子 Agent 团队 + 委托规则（一体化）
 * - 主 Agent (Primary): 入口点，接收用户输入，负责编排
 * - 子 Agent (Subagent): 被主 Agent 通过 task 工具调用的专门代理
 * - 委托规则: 定义何时将任务委托给哪个子 Agent
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

// ============================================================================
// 子 Agent 配置（用于编排）
// ============================================================================

export type SubagentTriggerType = "keyword" | "domain" | "condition" | "always";

export interface SubagentTrigger {
  type: SubagentTriggerType;
  pattern: string;
  description: string;
}

export interface SubagentConfig {
  id: string;
  agentId: string;
  name?: string;
  description?: string;
  overrides?: {
    model?: ModelConfig;
    parameters?: Partial<AgentParameters>;
    systemPrompt?: string;
  };
  triggers: SubagentTrigger[];
  runInBackground?: boolean;
  enabled: boolean;
  position: { x: number; y: number };
}

// ============================================================================
// 委托规则
// ============================================================================

export type DelegationPriority = "low" | "medium" | "high" | "critical";

export interface DelegationRule {
  id: string;
  subagentId: string;
  domain: string;
  condition: string;
  priority: DelegationPriority;
  runInBackground?: boolean;
  enabled: boolean;
}

export interface DelegationRuleset {
  rules: DelegationRule[];
  defaultBehavior: "handle-self" | "ask-user" | "delegate-to";
  defaultSubagentId?: string;
  customGuidelines?: string;
}

// ============================================================================
// 画布视口
// ============================================================================

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasNodePosition {
  x: number;
  y: number;
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
  
  subagents: SubagentConfig[];
  delegationRuleset: DelegationRuleset;
  primaryPosition: CanvasNodePosition;
  canvasViewport?: CanvasViewport;
  
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
    subagents: [],
    delegationRuleset: {
      rules: [],
      defaultBehavior: "handle-self",
    },
    primaryPosition: { x: 400, y: 100 },
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function createDefaultSubagentConfig(
  agentId: string,
  partial?: Partial<SubagentConfig>
): SubagentConfig {
  return {
    id: `subagent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    agentId,
    triggers: [],
    enabled: true,
    runInBackground: false,
    position: { x: 200, y: 300 },
    ...partial,
  };
}

export function createDefaultDelegationRule(
  subagentId: string,
  partial?: Partial<DelegationRule>
): DelegationRule {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    subagentId,
    domain: "",
    condition: "",
    priority: "medium",
    enabled: true,
    ...partial,
  };
}
