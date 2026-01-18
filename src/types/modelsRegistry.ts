/**
 * 模型注册表类型定义
 *
 * 与后端 Rust 类型对应，用于从 models.dev/api.json 获取模型默认参数
 */

export interface ModelDefaults {
  modelId: string;
  name: string;
  providerId: string;
  providerName: string;
  supportsReasoning: boolean;
  supportsToolCall: boolean;
  supportsStructuredOutput: boolean;
  supportsTemperature: boolean;
  supportsAttachment: boolean;
  contextWindow: number;
  maxOutputTokens: number;
  defaultTemperature: number | null;
  defaultTopP: number | null;
  defaultMaxTokens: number | null;
  costInput: number;
  costOutput: number;
}

export interface ModelsRegistryCacheInfo {
  hash: string;
  timestamp: number;
  isExpired: boolean;
}
