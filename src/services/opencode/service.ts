/**
 * OpenCode Service
 * 
 * 管理 OpenCode 客户端连接和状态
 * 支持本地模式和远程模式的切换
 */

import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { opencode as tauriOpencode } from "../tauri";
import {
  type OpencodeClient,
  type OpencodeServiceConfig,
  type OpencodeServiceState,
  type ConnectionState,
  type BackendServiceStatus,
  type ServiceMode,
  DEFAULT_CONFIG,
  getEndpointUrl,
} from "./types";

// Tauri 事件名称
const EVENT_SERVICE_STATUS = "service:status";

type StateListener = (state: OpencodeServiceState) => void;

/**
 * OpenCode 服务管理类
 * 
 * 职责：
 * 1. 管理 SDK 客户端实例
 * 2. 监听 Rust 后端的服务状态变化
 * 3. 处理本地/远程模式切换
 * 4. 提供统一的状态接口
 */
export class OpencodeService {
  private client: OpencodeClient | null = null;
  private config: OpencodeServiceConfig;
  private backendStatus: BackendServiceStatus = { type: "uninitialized" };
  private connectionState: ConnectionState = { status: "disconnected" };
  private endpoint: string | null = null;
  private listeners: Set<StateListener> = new Set();
  private unlistenBackend: UnlistenFn | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<OpencodeServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 初始化服务
   * - 监听 Rust 后端状态
   * - 如果配置了 autoConnect，尝试连接
   */
  async initialize(): Promise<void> {
    console.log("[OpencodeService] Initializing...");
    
    // 监听 Rust 后端的状态事件
    this.unlistenBackend = await listen<BackendServiceStatus>(
      EVENT_SERVICE_STATUS,
      (event) => {
        console.log("[OpencodeService] Received backend status event:", event.payload);
        this.handleBackendStatusChange(event.payload);
      }
    );
    console.log("[OpencodeService] Listening for backend status events");

    // 获取初始状态
    try {
      const status = await tauriOpencode.getStatus();
      console.log("[OpencodeService] Initial backend status:", status);
      this.backendStatus = status as BackendServiceStatus;
      
      const config = await tauriOpencode.getConfig();
      console.log("[OpencodeService] Backend config:", config);
      this.config = {
        ...this.config,
        mode: config.mode as ServiceMode,
        port: config.port,
        autoStart: config.autoStart,
      };
    } catch (e) {
      console.warn("[OpencodeService] Failed to get initial backend status:", e);
    }

    // 如果后端已在运行，自动连接
    if (this.config.autoConnect && this.backendStatus.type === "running") {
      console.log("[OpencodeService] Backend is running, auto-connecting...");
      await this.connect();
    } else {
      console.log("[OpencodeService] Backend status:", this.backendStatus.type, "- not auto-connecting yet");
    }

    this.notifyListeners();
    console.log("[OpencodeService] Initialization complete");
  }

  /**
   * 处理后端状态变化
   */
  private handleBackendStatusChange(status: BackendServiceStatus): void {
    const prevStatus = this.backendStatus;
    this.backendStatus = status;

    // 当服务启动完成时，自动连接
    if (
      this.config.autoConnect &&
      prevStatus.type !== "running" &&
      status.type === "running"
    ) {
      this.connect().catch(console.error);
    }

    // 当服务停止时，断开连接
    if (status.type === "stopped" || status.type === "error") {
      this.disconnect();
    }

    this.notifyListeners();
  }

  /**
   * 连接到 OpenCode 服务器
   */
  async connect(): Promise<void> {
    if (this.connectionState.status === "connecting") {
      return;
    }

    this.setConnectionState({ status: "connecting" });

    try {
      // 确定端点 URL
      let baseUrl: string;
      
      if (this.config.mode.type === "remote") {
        baseUrl = this.config.mode.url;
      } else {
        // 本地模式：从后端获取端点或使用默认值
        const backendEndpoint = await tauriOpencode.getEndpoint();
        baseUrl = backendEndpoint || getEndpointUrl(this.config);
      }

      // 创建 SDK 客户端
      this.client = createOpencodeClient({ baseUrl });
      this.endpoint = baseUrl;

      // 验证连接
      const health = await this.client.global.health();
      
      if (health.data?.healthy) {
        this.setConnectionState({ 
          status: "connected", 
          version: health.data.version || "unknown" 
        });
        
        // 启动健康检查
        this.startHealthCheck();
      } else {
        throw new Error("Server health check failed");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Connection failed";
      this.setConnectionState({ status: "error", message });
      this.client = null;
      this.endpoint = null;
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopHealthCheck();
    this.client = null;
    this.endpoint = null;
    this.setConnectionState({ status: "disconnected" });
  }

  /**
   * 切换服务模式
   */
  async setMode(mode: ServiceMode): Promise<void> {
    // 先断开当前连接
    this.disconnect();

    // 更新配置
    this.config = { ...this.config, mode };

    // 通知 Rust 后端
    try {
      await tauriOpencode.setMode(mode);
    } catch (e) {
      console.warn("Failed to update backend mode:", e);
    }

    // 如果是远程模式，直接尝试连接
    if (mode.type === "remote") {
      await this.connect();
    } else {
      // 本地模式：等待后端启动服务
      // 服务启动后会通过事件触发自动连接
      this.notifyListeners();
    }
  }

  /**
   * 获取 SDK 客户端
   */
  getClient(): OpencodeClient | null {
    return this.client;
  }

  /**
   * 获取当前状态
   */
  getState(): OpencodeServiceState {
    return {
      config: this.config,
      backendStatus: this.backendStatus,
      connectionState: this.connectionState,
      endpoint: this.endpoint,
    };
  }

  /**
   * 订阅状态变化
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    // 立即通知当前状态
    listener(this.getState());
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.disconnect();
    this.unlistenBackend?.();
    this.listeners.clear();
  }

  // ============== 后端服务控制 ==============

  /**
   * 初始化后端服务（下载二进制等）
   */
  async initializeBackend(): Promise<void> {
    await tauriOpencode.initialize();
  }

  /**
   * 启动后端服务
   */
  async startBackend(): Promise<void> {
    await tauriOpencode.start();
  }

  /**
   * 停止后端服务
   */
  async stopBackend(): Promise<void> {
    await tauriOpencode.stop();
  }

  /**
   * 重启后端服务
   */
  async restartBackend(): Promise<void> {
    await tauriOpencode.restart();
  }

  // ============== 私有方法 ==============

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  private startHealthCheck(): void {
    this.stopHealthCheck();
    
    // 每 30 秒检查一次连接状态
    this.healthCheckInterval = setInterval(async () => {
      if (!this.client || this.connectionState.status !== "connected") {
        return;
      }

      try {
        const health = await this.client.global.health();
        if (!health.data?.healthy) {
          this.setConnectionState({ 
            status: "error", 
            message: "Health check failed" 
          });
        }
      } catch (e) {
        this.setConnectionState({ 
          status: "error", 
          message: "Connection lost" 
        });
      }
    }, 30000);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// 单例实例
let serviceInstance: OpencodeService | null = null;

/**
 * 获取 OpenCode 服务单例
 */
export function getOpencodeService(): OpencodeService {
  if (!serviceInstance) {
    serviceInstance = new OpencodeService();
  }
  return serviceInstance;
}

/**
 * 初始化并返回服务实例
 */
export async function initOpencodeService(
  config?: Partial<OpencodeServiceConfig>
): Promise<OpencodeService> {
  if (serviceInstance) {
    serviceInstance.dispose();
  }
  serviceInstance = new OpencodeService(config);
  await serviceInstance.initialize();
  return serviceInstance;
}
