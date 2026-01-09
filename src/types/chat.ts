/**
 * Axon Desktop 聊天类型定义
 * 
 * 基于 OpenCode SDK 消息格式
 * 参考: opencode/packages/opencode/src/session/message-v2.ts
 */

// ============== 基础类型 ==============

export type MessageRole = "user" | "assistant" | "system";

// ============== Part 类型 ==============

/** Part 基础字段 */
interface PartBase {
  id: string;
  sessionID: string;
  messageID: string;
}

/** 文本 Part */
export interface TextPart extends PartBase {
  type: "text";
  text: string;
  synthetic?: boolean;
  ignored?: boolean;
  time?: {
    start: number;
    end?: number;
  };
  metadata?: Record<string, unknown>;
}

/** 文件 Part */
export interface FilePart extends PartBase {
  type: "file";
  mime: string;
  filename?: string;
  url: string;
  source?: unknown;
}

/** 推理 Part */
export interface ReasoningPart extends PartBase {
  type: "reasoning";
  text: string;
  metadata?: Record<string, unknown>;
  time: {
    start: number;
    end?: number;
  };
}

/** 步骤开始 Part */
export interface StepStartPart extends PartBase {
  type: "step-start";
  snapshot?: string;
}

/** 步骤结束 Part */
export interface StepFinishPart extends PartBase {
  type: "step-finish";
  reason: string;
  snapshot?: string;
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: {
      read: number;
      write: number;
    };
  };
}

/** 工具状态 - 等待中 */
export interface ToolStatePending {
  status: "pending";
  input: Record<string, unknown>;
  raw: string;
}

/** 工具状态 - 运行中 */
export interface ToolStateRunning {
  status: "running";
  input: Record<string, unknown>;
  title?: string;
  metadata?: Record<string, unknown>;
  time: {
    start: number;
  };
}

/** 工具状态 - 已完成 */
export interface ToolStateCompleted {
  status: "completed";
  input: Record<string, unknown>;
  output: string;
  title: string;
  metadata: Record<string, unknown>;
  time: {
    start: number;
    end: number;
    compacted?: number;
  };
  attachments?: FilePart[];
}

/** 工具状态 - 错误 */
export interface ToolStateError {
  status: "error";
  input: Record<string, unknown>;
  error: string;
  metadata?: Record<string, unknown>;
  time: {
    start: number;
    end: number;
  };
}

/** 工具状态联合类型 */
export type ToolState = 
  | ToolStatePending 
  | ToolStateRunning 
  | ToolStateCompleted 
  | ToolStateError;

/** 工具 Part */
export interface ToolPart extends PartBase {
  type: "tool";
  callID: string;
  tool: string;
  state: ToolState;
  metadata?: Record<string, unknown>;
}

/** Agent Part */
export interface AgentPart extends PartBase {
  type: "agent";
  name: string;
  source?: {
    value: string;
    start: number;
    end: number;
  };
}

/** 子任务 Part */
export interface SubtaskPart extends PartBase {
  type: "subtask";
  prompt: string;
  description: string;
  agent: string;
  command?: string;
}

/** 重试 Part */
export interface RetryPart extends PartBase {
  type: "retry";
  attempt: number;
  error: unknown;
  time: {
    created: number;
  };
}

/** 快照 Part */
export interface SnapshotPart extends PartBase {
  type: "snapshot";
  snapshot: string;
}

/** 补丁 Part */
export interface PatchPart extends PartBase {
  type: "patch";
  hash: string;
  files: string[];
}

/** 压缩 Part */
export interface CompactionPart extends PartBase {
  type: "compaction";
  auto: boolean;
}

/** Part 联合类型 */
export type Part =
  | TextPart
  | FilePart
  | ReasoningPart
  | StepStartPart
  | StepFinishPart
  | ToolPart
  | AgentPart
  | SubtaskPart
  | RetryPart
  | SnapshotPart
  | PatchPart
  | CompactionPart;

// ============== 消息类型 ==============

/** 用户消息信息 */
export interface UserMessageInfo {
  id: string;
  sessionID: string;
  role: "user";
  time: {
    created: number;
  };
  summary?: {
    title?: string;
    body?: string;
    diffs: unknown[];
  };
  agent: string;
  model: {
    providerID: string;
    modelID: string;
  };
  system?: string;
  tools?: Record<string, boolean>;
  variant?: string;
}

/** 助手消息信息 */
export interface AssistantMessageInfo {
  id: string;
  sessionID: string;
  role: "assistant";
  time: {
    created: number;
    completed?: number;
  };
  error?: unknown;
  parentID: string;
  modelID: string;
  providerID: string;
  mode: string;
  agent: string;
  path: {
    cwd: string;
    root: string;
  };
  summary?: boolean;
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: {
      read: number;
      write: number;
    };
  };
  finish?: string;
}

/** 消息信息联合类型 */
export type MessageInfo = UserMessageInfo | AssistantMessageInfo;

/** 完整消息（包含 info 和 parts） */
export interface Message {
  info: MessageInfo;
  parts: Part[];
}

// ============== 会话类型 ==============

/** 
 * 会话类型
 */
export interface Session {
  id: string;
  title: string;
  /** 会话工作目录 */
  directory: string;
  /** 项目 ID */
  projectID: string;
  createdAt: number;
  updatedAt: number;
  parentId?: string;
}

// ============== 状态类型 ==============

export interface ChatState {
  sessions: Session[];
  activeSessionId: string | null;
  isLoading: boolean;
  error: string | null;
}

// ============== 辅助函数 ==============

/** 生成唯一 ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/** 创建一个新的空会话 */
export function createSession(title?: string, directory?: string, projectID?: string): Session {
  const id = generateId();
  const now = Date.now();
  return {
    id,
    title: title || "新对话",
    directory: directory || "",
    projectID: projectID || "global",
    createdAt: now,
    updatedAt: now,
  };
}

/** 判断是否为用户消息 */
export function isUserMessage(info: MessageInfo): info is UserMessageInfo {
  return info.role === "user";
}

/** 判断是否为助手消息 */
export function isAssistantMessage(info: MessageInfo): info is AssistantMessageInfo {
  return info.role === "assistant";
}

/** 从消息中提取纯文本内容 */
export function extractTextContent(parts: Part[]): string {
  return parts
    .filter((p): p is TextPart => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/** 工具名称映射（用于显示） */
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  bash: "终端命令",
  read: "读取文件",
  write: "写入文件",
  edit: "编辑文件",
  multiedit: "多文件编辑",
  patch: "应用补丁",
  list: "列出目录",
  glob: "文件搜索",
  grep: "内容搜索",
  task: "子任务",
  todowrite: "任务计划",
  todoread: "读取任务",
  webfetch: "获取网页",
  websearch: "网页搜索",
  codesearch: "代码搜索",
  lsp: "LSP",
  skill: "技能",
  batch: "批量操作",
};

/** 获取工具显示名称 */
export function getToolDisplayName(toolName: string): string {
  return TOOL_DISPLAY_NAMES[toolName] || toolName;
}

// ============== 权限请求类型 ==============

/** 权限动作类型 */
export type PermissionAction = "allow" | "deny" | "ask";

/** 权限回复类型 */
export type PermissionReply = "once" | "always" | "reject";

/** 权限请求 */
export interface PermissionRequest {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
  tool?: {
    messageID: string;
    callID: string;
  };
  /** 请求来源的工作目录（从 SSE 全局事件中提取） */
  directory?: string;
}

/** 权限回复事件 */
export interface PermissionReplyEvent {
  sessionID: string;
  requestID: string;
  reply: PermissionReply;
}

// ============== Todo 任务类型 ==============

/** 任务状态 */
export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

/** 任务优先级 */
export type TodoPriority = "low" | "medium" | "high";

/** 任务项 */
export interface TodoItem {
  id: string;
  content: string;
  status: TodoStatus;
  priority: TodoPriority;
}

/** Todo 更新事件 */
export interface TodoUpdatedEvent {
  sessionID: string;
  todos: TodoItem[];
}
