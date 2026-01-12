/**
 * OpenCode Service Types
 */

import type { OpencodeClient as SDKClient } from "@opencode-ai/sdk/v2/client";
import type { Event as SDKEvent } from "@opencode-ai/sdk/v2";

/**
 * SDK 事件类型 (re-export)
 */
export type OpencodeEvent = SDKEvent;

/**
 * 带有 directory 的全局事件（从 global.event() 接收）
 */
export interface GlobalEvent {
  /** 事件来源的工作目录 */
  directory?: string;
  /** 实际的事件负载 */
  payload: OpencodeEvent;
}

/**
 * 事件监听器类型
 * 接收完整的全局事件，包含 directory 信息
 */
export type EventListener = (event: GlobalEvent) => void;

/**
 * 服务连接模式
 */
export type ServiceMode = 
  | { type: "local" }
  | { type: "remote"; url: string };

/**
 * 连接状态
 */
export type ConnectionState = 
  | { status: "disconnected" }
  | { status: "connecting" }
  | { status: "connected"; version: string }
  | { status: "error"; message: string };

/**
 * 后端服务状态 (来自 Rust)
 */
export type BackendServiceStatus =
  | { type: "uninitialized" }
  | { type: "downloading"; progress: number }
  | { type: "ready" }
  | { type: "starting" }
  | { type: "running"; port: number }
  | { type: "stopped" }
  | { type: "error"; message: string };

/**
 * 服务配置
 */
export interface OpencodeServiceConfig {
  mode: ServiceMode;
  port: number;
  autoStart: boolean;
  autoConnect: boolean;
}

/**
 * 完整的服务状态
 */
export interface OpencodeServiceState {
  config: OpencodeServiceConfig;
  backendStatus: BackendServiceStatus;
  connectionState: ConnectionState;
  endpoint: string | null;
}

/**
 * SDK 客户端类型 (re-export)
 */
export type OpencodeClient = SDKClient;

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: OpencodeServiceConfig = {
  mode: { type: "local" },
  port: 0,
  autoStart: true,
  autoConnect: true,
};

/**
 * 获取端点 URL
 */
export function getEndpointUrl(config: OpencodeServiceConfig): string {
  if (config.mode.type === "remote") {
    return config.mode.url;
  }
  return `http://127.0.0.1:${config.port}`;
}

/**
 * 版本信息
 */
export interface VersionInfo {
  installed: string | null;
  latest: string | null;
  updateAvailable: boolean;
}

/**
 * 应用全局设置
 */
export interface AppSettings {
  autoUpdate: boolean;
  customOpencodePath: string | null;
  installedVersion: string | null;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  autoUpdate: false,
  customOpencodePath: null,
  installedVersion: null,
};

/**
 * 下载进度信息（来自 Tauri 事件）
 */
export interface DownloadProgress {
  downloaded: number;
  total: number | null;
  percentage: number;
}
