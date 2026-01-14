/**
 * Provider 类型定义
 * 
 * 统一的 AI 服务商配置类型定义
 * 数据来源: OpenCode SDK client.provider.list()
 */

/** 模型基本信息 (来自 OpenCode SDK) */
export interface ModelInfo {
  id: string;
  name: string;
  family?: string;
  release_date?: string;
  /** 是否支持附件 */
  attachment?: boolean;
  /** 是否支持推理 */
  reasoning?: boolean;
  /** 是否支持温度参数 */
  temperature?: boolean;
  /** 是否支持工具调用 */
  tool_call?: boolean;
  /** 输入/输出模态 */
  modalities?: {
    input: string[];
    output: string[];
  };
  /** 成本信息 */
  cost?: {
    input: number;
    output: number;
    cache_read?: number;
    cache_write?: number;
  };
  /** 上下文限制 */
  limit?: {
    context: number;
    output: number;
  };
  /** 模型变体 */
  variants?: Record<string, Record<string, unknown>>;
  /** 实验性标志 */
  experimental?: boolean;
  /** 状态 */
  status?: "alpha" | "beta" | "deprecated";
  /** 额外选项 */
  options?: Record<string, unknown>;
}

/** 
 * Provider 信息 (来自 OpenCode SDK client.provider.list())
 * 对应 SDK 返回的 all 数组中的元素
 */
export interface ProviderRegistryEntry {
  id: string;
  name: string;
  /** 环境变量名列表 */
  env: string[];
  /** SDK 包名 */
  npm?: string;
  /** 默认 API 地址 */
  api?: string;
  /** 可用模型 */
  models: Record<string, ModelInfo>;
}

/** Provider 认证方法 (来自 SDK client.provider.auth()) */
export interface ProviderAuthMethod {
  type: "oauth" | "api";
  label: string;
}

/** OAuth 授权响应 (来自 SDK client.provider.oauth.authorize()) */
export interface OAuthAuthorization {
  url: string;
  method: "auto" | "code";
  instructions: string;
}

/** 
 * OpenCode SDK provider.list() 返回格式
 */
export interface ProviderListResponse {
  /** 所有可用的 provider */
  all: ProviderRegistryEntry[];
  /** 已连接（已配置凭证）的 provider ID 列表 */
  connected: string[];
  /** 默认模型映射 (agent -> provider/model) */
  default: Record<string, string>;
}

/** 认证类型 */
export type AuthType = "api" | "oauth" | "subscription";

/** API Key 认证配置 */
export interface ApiAuth {
  type: "api";
  /** API Key */
  key: string;
}

/** OAuth 认证配置 */
export interface OAuthAuth {
  type: "oauth";
  /** 是否已连接 */
  connected: boolean;
  /** OAuth 方法索引 */
  method: number;
}

/** 订阅服务认证配置 */
export interface SubscriptionAuth {
  type: "subscription";
  /** 订阅服务类型 */
  provider: "claude-code" | "github-copilot" | "openai-subscription";
  /** 是否已连接 */
  connected: boolean;
}

/** 联合认证类型 */
export type ProviderAuth = ApiAuth | OAuthAuth | SubscriptionAuth;

/** 自定义配置 */
export interface CustomConfig {
  baseURL?: string;
  apiKey?: string;
  enterpriseUrl?: string;
  setCacheKey?: boolean;
  timeout?: number | false;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  /** 模型白名单 - 只显示这些模型 */
  whitelist?: string[];
  /** 模型黑名单 - 隐藏这些模型 */
  blacklist?: string[];
  [key: string]: unknown;
}

/** 用户添加的服务商配置 (保存在 settings.json) */
export interface UserProviderConfig {
  /** 唯一 ID */
  id: string;
  /** 关联到注册表的 ID */
  registryId: string;
  /** 显示名称 */
  name: string;
  /** 认证配置 */
  auth: ProviderAuth;
  /** 自定义配置 (可选) */
  customConfig?: CustomConfig;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/** UI 展示的服务商卡片 */
export interface ProviderCard {
  id: string;
  name: string;
  description: string;
  logo?: string;
  category: "popular" | "custom" | "subscription";
  registryEntry?: ProviderRegistryEntry;
}


