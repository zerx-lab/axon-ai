/**
 * OpenCode Service Layer
 * 
 * 架构设计：
 * 
 * 1. 本地模式 (Local Mode):
 *    - Rust 后端负责下载、启动和管理 opencode serve 进程
 *    - 前端通过 SDK 连接到本地服务器 (默认 http://127.0.0.1:9120)
 *    - 服务状态通过 Tauri 事件同步到前端
 * 
 * 2. 远程模式 (Remote Mode):
 *    - 前端直接使用 SDK 连接到远程 OpenCode 服务器
 *    - Rust 后端只记录配置，不管理进程
 *    - 适用于团队共享服务器或云端部署
 * 
 * 状态管理：
 * - ServiceMode: 当前模式 (local/remote)
 * - ConnectionState: 连接状态 (disconnected/connecting/connected/error)
 * - OpenCode SDK Client: 实际的 API 客户端
 */

export { OpencodeService, getOpencodeService, type SSEHealthStatus } from "./service";
export type { 
  ConnectionState, 
  ServiceMode, 
  OpencodeServiceConfig,
  OpencodeServiceState,
  OpencodeClient,
  OpencodeEvent,
  EventListener,
} from "./types";
export { getToolIds, getTools, getToolsSimple, type ToolInfo } from "./tools";
