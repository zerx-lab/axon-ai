/**
 * 聊天状态管理 - 类型定义
 * 
 * 包含所有与聊天相关的类型定义
 */

import type {
  Message,
  Session,
} from "@/types/chat";

// ============== 常量 ==============

/** localStorage 存储键名 - 模型选择 */
export const MODEL_STORAGE_KEY = "axon-selected-model";

/** localStorage 存储键名 - 活动会话 ID */
export const ACTIVE_SESSION_STORAGE_KEY = "axon-active-session-id";

/** localStorage 存储键名 - 模型 variant 选择 */
export const VARIANT_STORAGE_KEY = "axon-model-variants";

// ============== 类型定义 ==============

/** 模型推理深度变体配置 */
export type ModelVariants = Record<string, Record<string, unknown>>;

/** 模型信息 */
export interface Model {
  id: string;
  name: string;
  provider: string;
  /** 可用的推理深度变体 (如 "low", "medium", "high", "max") */
  variants?: ModelVariants;
}

/** Provider 信息 */
export interface Provider {
  id: string;
  name: string;
  models: Model[];
}

/** 会话状态 */
export type SessionStatus = "idle" | "running" | "error";

/** 选中的模型 */
export interface SelectedModel {
  providerId: string;
  modelId: string;
}

/** 选中的 Variant (按模型存储) */
export type SelectedVariants = Record<string, string | undefined>;

/** Chat Hook 返回值 */
export interface UseChatReturn {
  // 状态
  sessions: Session[];
  activeSession: Session | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  
  // 模型相关
  providers: Provider[];
  models: Model[];
  selectedModel: SelectedModel | null;
  isLoadingModels: boolean;
  
  // Variant 相关
  /** 当前模型可用的 variants 列表 */
  currentVariants: string[];
  /** 当前选中的 variant */
  selectedVariant: string | undefined;
  
  // 会话操作
  createNewSession: (directory?: string) => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  
  // 消息操作
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => Promise<void>;
  
  // 模型操作
  selectModel: (providerId: string, modelId: string) => void;
  refreshProviders: () => Promise<void>;
  
  // Variant 操作
  /** 设置当前模型的 variant */
  selectVariant: (variant: string | undefined) => void;
  /** 循环切换 variant */
  cycleVariant: () => void;
  
  // 其他
  clearError: () => void;
  refreshSessions: () => Promise<void>;
}
