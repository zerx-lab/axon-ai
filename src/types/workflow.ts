/**
 * Workflow 类型定义
 * 
 * Workflow = 主 Agent + 子 Agent 团队 + 委托规则
 * 
 * 核心概念：
 * - 主 Agent (Primary): 入口点，接收用户输入，负责编排
 * - 子 Agent (Subagent): 被主 Agent 通过 task 工具调用的专门代理
 * - 委托规则: 定义何时将任务委托给哪个子 Agent
 * 
 * 这不是传统的 DAG 数据流，而是 Agent 团队的配置
 */

import type { AgentDefinition, ModelConfig, AgentParameters } from "./agent";

// ============================================================================
// 委托触发器
// ============================================================================

/** 触发类型 */
export type TriggerType = "keyword" | "domain" | "condition" | "always";

/** 委托触发器配置 */
export interface DelegationTrigger {
  /** 触发类型 */
  type: TriggerType;
  /** 匹配模式（关键词、领域名称或条件描述） */
  pattern: string;
  /** 触发器描述（用于生成系统提示） */
  description: string;
}

// ============================================================================
// 子 Agent 配置
// ============================================================================

/** 子 Agent 在工作流中的配置 */
export interface SubagentConfig {
  /** 唯一标识（在工作流内唯一） */
  id: string;
  
  /** 引用的 Agent ID（引用已定义的 Agent） */
  agentId: string;
  
  /** Agent 名称（显示用，可覆盖原 Agent 名称） */
  name?: string;
  
  /** 描述（显示用） */
  description?: string;
  
  /** 覆盖配置（可选，覆盖原 Agent 的配置） */
  overrides?: {
    model?: ModelConfig;
    parameters?: Partial<AgentParameters>;
    systemPrompt?: string;
  };
  
  /** 委托触发条件 */
  triggers: DelegationTrigger[];
  
  /** 是否在后台运行（并行执行） */
  runInBackground?: boolean;
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 在可视化画布中的位置 */
  position: { x: number; y: number };
}

// ============================================================================
// 主 Agent 配置
// ============================================================================

/** 主 Agent 配置模式 */
export type PrimaryAgentMode = "reference" | "inline";

/** 主 Agent 配置 */
export interface PrimaryAgentConfig {
  /** 配置模式：引用现有 Agent 或内联定义 */
  mode: PrimaryAgentMode;
  
  /** 引用的 Agent ID（mode = "reference" 时使用） */
  agentId?: string;
  
  /** 内联定义（mode = "inline" 时使用） */
  inline?: Partial<AgentDefinition>;
  
  /** 在可视化画布中的位置 */
  position: { x: number; y: number };
}

// ============================================================================
// 委托规则
// ============================================================================

/** 委托规则优先级 */
export type DelegationPriority = "low" | "medium" | "high" | "critical";

/** 单条委托规则 */
export interface DelegationRule {
  /** 规则 ID */
  id: string;
  
  /** 目标子 Agent ID */
  subagentId: string;
  
  /** 触发领域 */
  domain: string;
  
  /** 触发条件描述 */
  condition: string;
  
  /** 优先级 */
  priority: DelegationPriority;
  
  /** 是否在后台执行 */
  runInBackground?: boolean;
  
  /** 规则是否启用 */
  enabled: boolean;
}

/** 委托规则集 */
export interface DelegationRuleset {
  /** 规则列表 */
  rules: DelegationRule[];
  
  /** 默认行为：无规则匹配时的处理方式 */
  defaultBehavior: "handle-self" | "ask-user" | "delegate-to";
  
  /** 默认委托目标（defaultBehavior = "delegate-to" 时使用） */
  defaultSubagentId?: string;
  
  /** 自定义委托指南（Markdown 格式，会注入到主 Agent 系统提示） */
  customGuidelines?: string;
}

// ============================================================================
// 工作流定义
// ============================================================================

/** 工作流状态 */
export type WorkflowStatus = "draft" | "active" | "archived";

/** 工作流定义 */
export interface WorkflowDefinition {
  /** 唯一标识 */
  id: string;
  
  /** 工作流名称 */
  name: string;
  
  /** 工作流描述 */
  description: string;
  
  /** 图标（emoji 或图标名称） */
  icon?: string;
  
  /** 主题色 */
  color?: string;
  
  /** 状态 */
  status: WorkflowStatus;
  
  /** 主 Agent 配置 */
  primaryAgent: PrimaryAgentConfig;
  
  /** 子 Agent 配置列表 */
  subagents: SubagentConfig[];
  
  /** 委托规则集 */
  delegationRuleset: DelegationRuleset;
  
  /** 画布视口配置 */
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  
  /** 创建时间 */
  createdAt: number;
  
  /** 更新时间 */
  updatedAt: number;
  
  /** 版本号 */
  version: number;
}

// ============================================================================
// 工作流摘要（列表显示用）
// ============================================================================

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  status: WorkflowStatus;
  subagentCount: number;
  updatedAt: number;
}

// ============================================================================
// 工厂函数
// ============================================================================

/** 创建默认的工作流定义 */
export function createDefaultWorkflow(partial?: Partial<WorkflowDefinition>): WorkflowDefinition {
  const now = Date.now();
  return {
    id: `workflow-${now}-${Math.random().toString(36).slice(2, 9)}`,
    name: "新建工作流",
    description: "",
    status: "draft",
    primaryAgent: {
      mode: "inline",
      inline: {
        name: "主编排 Agent",
        description: "负责接收用户输入并协调子 Agent",
      },
      position: { x: 400, y: 100 },
    },
    subagents: [],
    delegationRuleset: {
      rules: [],
      defaultBehavior: "handle-self",
    },
    createdAt: now,
    updatedAt: now,
    version: 1,
    ...partial,
  };
}

/** 创建默认的子 Agent 配置 */
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

/** 创建默认的委托规则 */
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

// ============================================================================
// 工具函数
// ============================================================================

/** 从工作流定义生成摘要 */
export function workflowToSummary(workflow: WorkflowDefinition): WorkflowSummary {
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    icon: workflow.icon,
    color: workflow.color,
    status: workflow.status,
    subagentCount: workflow.subagents.length,
    updatedAt: workflow.updatedAt,
  };
}

/** 验证工作流定义 */
export function validateWorkflow(workflow: WorkflowDefinition): string[] {
  const errors: string[] = [];
  
  if (!workflow.name.trim()) {
    errors.push("工作流名称不能为空");
  }
  
  if (workflow.primaryAgent.mode === "reference" && !workflow.primaryAgent.agentId) {
    errors.push("主 Agent 引用模式下必须指定 agentId");
  }
  
  // 检查子 Agent ID 唯一性
  const subagentIds = new Set<string>();
  for (const subagent of workflow.subagents) {
    if (subagentIds.has(subagent.id)) {
      errors.push(`子 Agent ID 重复: ${subagent.id}`);
    }
    subagentIds.add(subagent.id);
  }
  
  // 检查委托规则引用的子 Agent 是否存在
  for (const rule of workflow.delegationRuleset.rules) {
    if (!subagentIds.has(rule.subagentId)) {
      errors.push(`委托规则引用了不存在的子 Agent: ${rule.subagentId}`);
    }
  }
  
  return errors;
}
