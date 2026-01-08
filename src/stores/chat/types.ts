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

// ============== 类型定义 ==============

/** 模型信息 */
export interface Model {
  id: string;
  name: string;
  provider: string;
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
  
  // 其他
  clearError: () => void;
  refreshSessions: () => Promise<void>;
}
