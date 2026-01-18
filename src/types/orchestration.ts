/**
 * 编排组类型定义
 *
 * 核心概念：
 * - OrchestrationGroup = 顶层编排容器
 * - AgentConfig = 纯 Agent 配置（无编排信息）
 * - EmbeddedSubagent = 嵌入式子 Agent（完整配置 + 编排信息）
 *
 * 与旧 AgentDefinition 的区别：
 * - 旧模式：SubagentConfig 通过 agentId 引用外部 Agent
 * - 新模式：EmbeddedSubagent 内嵌完整 AgentConfig，无外部引用
 */

// ============================================================================
// 基础类型（从 agent.ts 复用）
// ============================================================================

export type PermissionValue = "ask" | "allow" | "deny";
export type AgentCategory = "exploration" | "specialist" | "advisor" | "utility" | "orchestrator";
export type AgentCost = "free" | "cheap" | "medium" | "expensive";
export type ReasoningEffort = "low" | "medium" | "high";
export type TextVerbosity = "low" | "medium" | "high";
export type ToolAccessMode = "whitelist" | "blacklist" | "all";
export type BashPermission = PermissionValue | Record<string, PermissionValue>;

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

export interface ToolsConfig {
  mode: ToolAccessMode;
  list: string[];
}

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

export interface CanvasNodePosition {
  x: number;
  y: number;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

// ============================================================================
// AgentConfig - 纯 Agent 配置（无编排信息）
// ============================================================================

/**
 * Agent 配置
 * 从原 AgentDefinition 中提取，去除编排相关字段（subagents, delegationRuleset 等）
 */
export interface AgentConfig {
  // 基本信息
  name: string;
  description: string;
  icon?: string;
  color?: string;

  // 模型配置
  model: ModelConfig;
  parameters: AgentParameters;

  // 工具与权限
  tools: ToolsConfig;
  permissions: AgentPermissions;

  // 提示词
  prompt: PromptConfig;

  // 元数据
  metadata: AgentMetadata;

  // 分类与技能
  category?: string;
  skills?: string[];
}

// ============================================================================
// 子 Agent 触发器
// ============================================================================

export type SubagentTriggerType = "keyword" | "domain" | "condition" | "always";

export interface SubagentTrigger {
  type: SubagentTriggerType;
  pattern: string;
  description: string;
}

// ============================================================================
// EmbeddedSubagent - 嵌入式子 Agent
// ============================================================================

/**
 * 嵌入式子 Agent
 * 完整 Agent 配置 + 编排信息，非引用模式
 */
export interface EmbeddedSubagent {
  // 唯一标识（组内唯一）
  id: string;

  // 完整 Agent 配置（嵌入式）
  config: AgentConfig;

  // 编排信息
  triggers: SubagentTrigger[];
  runInBackground?: boolean;
  enabled: boolean;

  // 画布位置
  position: CanvasNodePosition;
}

// ============================================================================
// 编排连线（执行流程）
// ============================================================================

export type OrchestrationEdgeType = "delegation" | "sequence" | "parallel" | "conditional";

export interface OrchestrationEdge {
  id: string;
  source: string;
  target: string;
  type: OrchestrationEdgeType;
  label?: string;
  condition?: string;
  enabled: boolean;
}

// ============================================================================
// 委托规则
// ============================================================================

export type DelegationPriority = "low" | "medium" | "high" | "critical";
export type DelegationDefaultBehavior = "handle-self" | "ask-user" | "delegate-to";

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
  defaultBehavior: DelegationDefaultBehavior;
  defaultSubagentId?: string;
  customGuidelines?: string;
}

// ============================================================================
// OrchestrationGroup - 顶层编排组
// ============================================================================

/**
 * 编排组
 * 顶层实体，包含一个主 Agent 和多个嵌入式子 Agent
 */
export interface OrchestrationGroup {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  primaryAgent: AgentConfig;
  primaryPosition: CanvasNodePosition;
  subagents: EmbeddedSubagent[];
  edges: OrchestrationEdge[];
  delegationRuleset: DelegationRuleset;
  canvasViewport?: CanvasViewport;
  createdAt: number;
  updatedAt: number;
}

/**
 * 编排组摘要（用于列表显示）
 */
export interface OrchestrationGroupSummary {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  subagentCount: number;
  updatedAt: number;
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建默认 Agent 配置
 */
export function createDefaultAgentConfig(
  partial?: Partial<AgentConfig>
): AgentConfig {
  return {
    name: "新建 Agent",
    description: "",
    model: { modelId: "anthropic/claude-sonnet-4-5" },
    parameters: { temperature: 0.3 },
    tools: { mode: "all", list: [] },
    permissions: { edit: "ask", bash: "ask", webfetch: "allow" },
    prompt: {},
    metadata: {
      category: "utility",
      cost: "medium",
      triggers: [],
      useWhen: [],
      avoidWhen: [],
    },
    ...partial,
  };
}

/**
 * 创建默认嵌入式子 Agent
 */
export function createDefaultEmbeddedSubagent(
  partial?: Partial<EmbeddedSubagent>
): EmbeddedSubagent {
  return {
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    config: createDefaultAgentConfig({ name: "新建子 Agent", description: "子 Agent" }),
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

export function createDefaultOrchestrationEdge(
  source: string,
  target: string,
  partial?: Partial<OrchestrationEdge>
): OrchestrationEdge {
  return {
    id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    source,
    target,
    type: "delegation",
    enabled: true,
    ...partial,
  };
}

/**
 * 创建默认编排组
 */
export function createDefaultOrchestrationGroup(
  partial?: Partial<OrchestrationGroup>
): OrchestrationGroup {
  const now = Date.now();
  return {
    id: `orch-${now}-${Math.random().toString(36).slice(2, 9)}`,
    name: "新建编排",
    description: "",
    primaryAgent: createDefaultAgentConfig({ name: "主 Agent", description: "编排组的主 Agent" }),
    primaryPosition: { x: 400, y: 100 },
    subagents: [],
    edges: [],
    delegationRuleset: { rules: [], defaultBehavior: "handle-self" },
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

/**
 * 从 OrchestrationGroup 提取摘要信息
 */
export function toOrchestrationGroupSummary(
  group: OrchestrationGroup
): OrchestrationGroupSummary {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    icon: group.icon,
    color: group.color,
    subagentCount: group.subagents.length,
    updatedAt: group.updatedAt,
  };
}
