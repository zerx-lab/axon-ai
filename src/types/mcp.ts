/**
 * MCP (Model Context Protocol) 相关类型定义
 */

// MCP 状态类型定义
export type McpStatus =
  | { status: "connected" }
  | { status: "disabled" }
  | { status: "failed"; error: string }
  | { status: "needs_auth" }
  | { status: "needs_client_registration"; error: string };

// MCP 本地配置类型
export interface McpLocalConfig {
  type: "local";
  command: string[];
  environment?: Record<string, string>;
  enabled?: boolean;
  timeout?: number;
}

// MCP 远程配置类型
export interface McpRemoteConfig {
  type: "remote";
  url: string;
  enabled?: boolean;
  headers?: Record<string, string>;
  oauth?: { clientId?: string; clientSecret?: string; scope?: string } | false;
  timeout?: number;
}

// MCP 配置联合类型
export type McpConfig = McpLocalConfig | McpRemoteConfig;

// MCP 服务器状态映射
export type McpServersStatus = Record<string, McpStatus>;

// MCP 配置映射
export type McpConfigMap = Record<string, McpConfig>;

/**
 * 获取 MCP 状态的统计信息
 */
export interface McpStatusStats {
  total: number;
  connected: number;
  disabled: number;
  failed: number;
  needsAuth: number;
}

/**
 * 计算 MCP 状态统计
 */
export function getMcpStatusStats(servers: McpServersStatus): McpStatusStats {
  const entries = Object.values(servers);
  return {
    total: entries.length,
    connected: entries.filter(s => s.status === "connected").length,
    disabled: entries.filter(s => s.status === "disabled").length,
    failed: entries.filter(s => s.status === "failed").length,
    needsAuth: entries.filter(s => s.status === "needs_auth" || s.status === "needs_client_registration").length,
  };
}
