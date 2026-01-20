/**
 * OpenCode Service
 * 
 * 管理 OpenCode 客户端连接和状态
 * 支持本地模式和远程模式的切换
 * 支持 SSE 事件订阅，实现流式对话
 * 
 * SSE 优化：
 * - 心跳检测：处理 server.heartbeat 事件
 * - 指数退避重连：连接失败时使用指数退避策略
 * - 连接健康监测：监控 SSE 连接状态
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
  type OpencodeEvent,
  type GlobalEvent,
  type EventListener,
  DEFAULT_CONFIG,
  getEndpointUrl,
} from "./types";

// Tauri 事件名称
const EVENT_SERVICE_STATUS = "service:status";

// SSE 重连配置
const SSE_RECONNECT_CONFIG = {
  baseDelay: 1000,      // 初始重连延迟 1秒
  maxDelay: 30000,      // 最大重连延迟 30秒
  maxRetries: 10,       // 最大重试次数
  backoffMultiplier: 2, // 退避倍数
};

// 心跳超时配置（服务器每30秒发送心跳）
const HEARTBEAT_TIMEOUT = 45000; // 45秒无心跳视为连接断开

type StateListener = (state: OpencodeServiceState) => void;

/**
 * SSE 连接健康状态
 */
export interface SSEHealthStatus {
  isConnected: boolean;
  lastHeartbeat: number | null;
  reconnectAttempts: number;
  lastError: string | null;
}

/**
 * OpenCode 服务管理类
 * 
 * 职责：
 * 1. 管理 SDK 客户端实例
 * 2. 监听 Rust 后端的服务状态变化
 * 3. 处理本地/远程模式切换
 * 4. 提供统一的状态接口
 * 5. 管理 SSE 事件流，支持流式对话
 * 6. SSE 连接健康监测和自动重连
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
  
  // SSE 事件相关
  private eventListeners: Set<EventListener> = new Set();
  private eventAbortController: AbortController | null = null;
  private eventStreamActive = false;
  
  // SSE 健康监测相关
  private sseReconnectAttempts = 0;
  private sseReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastHeartbeatTime: number | null = null;
  private heartbeatCheckInterval: ReturnType<typeof setInterval> | null = null;
  private lastSSEError: string | null = null;

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
      
      // 立即通知监听器状态已更新，确保 UI 显示正确的初始状态
      this.notifyListeners();
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

    // 当服务停止时，断开连接
    if (status.type === "stopped" || status.type === "error") {
      this.disconnect();
    }

    // 当服务启动完成时，检查是否需要（重新）连接
    if (this.config.autoConnect && status.type === "running") {
      const newPort = status.port;
      const currentPort = this.getCurrentPort();
      
      // 如果之前不是 running 状态，或者端口发生了变化，需要重新连接
      if (prevStatus.type !== "running" || currentPort !== newPort) {
        console.log(
          `[OpencodeService] 服务状态变化: ${prevStatus.type} -> running, 端口: ${currentPort} -> ${newPort}`
        );
        
        // 如果已有连接但端口变化，需要先断开旧连接
        if (currentPort !== null && currentPort !== newPort) {
          console.log("[OpencodeService] 端口变化，断开旧连接并重新连接...");
          this.disconnect();
        }
        
        this.connect().catch(console.error);
      }
    }

    this.notifyListeners();
  }

  /**
   * 获取当前连接的端口号
   * 从当前 endpoint URL 中提取端口
   */
  private getCurrentPort(): number | null {
    if (!this.endpoint) {
      return null;
    }
    
    try {
      const url = new URL(this.endpoint);
      return parseInt(url.port, 10) || null;
    } catch {
      return null;
    }
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
        
        // 启动 SSE 事件流
        this.startEventStream();
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
    this.stopEventStream();
    this.client = null;
    this.endpoint = null;
    this.setConnectionState({ status: "disconnected" });
  }

  // ============== SSE 事件订阅 ==============

  /**
   * 启动 SSE 事件流
   * 使用 global.event() 订阅全局事件，接收所有目录的事件
   * 包含心跳检测和自动重连机制
   */
  async startEventStream(): Promise<void> {
    if (this.eventStreamActive || !this.client) {
      return;
    }

    console.log("[OpencodeService] Starting SSE event stream (global.event)...");
    this.eventAbortController = new AbortController();
    this.eventStreamActive = true;
    this.lastSSEError = null;

    try {
      // 使用 global.event() 订阅全局事件流（而不是 event.subscribe）
      // 全局事件流会接收所有目录的事件，事件中包含 directory 字段
      const response = await this.client.global.event();
      
      if (!response.stream) {
        console.warn("[OpencodeService] SSE stream not available");
        this.eventStreamActive = false;
        this.scheduleReconnect();
        return;
      }

      // 重置重连计数器（连接成功）
      this.sseReconnectAttempts = 0;
      
      // 启动心跳检测
      this.startHeartbeatCheck();

      // 在后台处理事件流
      this.processGlobalEventStream(response.stream);
      console.log("[OpencodeService] SSE event stream started successfully");
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      console.error("[OpencodeService] Failed to start SSE event stream:", errorMessage);
      this.lastSSEError = errorMessage;
      this.eventStreamActive = false;
      this.scheduleReconnect();
    }
  }

  /**
   * 处理全局 SSE 事件流
   * 全局事件格式: { directory: string, payload: Event }
   * 优化：增加心跳处理，使用批量事件处理减少重渲染
   */
  private async processGlobalEventStream(
    stream: AsyncIterable<{ directory?: string; payload: OpencodeEvent }>
  ): Promise<void> {
    try {
      for await (const globalEvent of stream) {
        // 检查是否已停止
        if (!this.eventStreamActive) {
          break;
        }

        const { directory, payload: event } = globalEvent;
        
        // 调试日志：打印所有 SSE 事件（详细模式）
        console.log("[OpencodeService] SSE event:", event.type, JSON.stringify(globalEvent, null, 2));

        // 处理心跳事件（服务器可能发送此类型，但 SDK 类型定义可能不包含）
        // 使用类型断言处理未知事件类型
        const eventType = event.type as string;
        if (eventType === "server.heartbeat") {
          this.lastHeartbeatTime = Date.now();
          // 心跳事件不需要通知业务监听器
          continue;
        }

        // 更新心跳时间（任何事件都表示连接活跃）
        this.lastHeartbeatTime = Date.now();

        // 通知所有监听器（传递完整的全局事件，包含 directory）
        this.notifyEventListeners({ directory, payload: event });
      }
      
      // 流正常结束，可能是服务器主动关闭
      if (this.eventStreamActive) {
        console.log("[OpencodeService] SSE stream ended normally, scheduling reconnect...");
        this.eventStreamActive = false;
        this.scheduleReconnect();
      }
    } catch (e) {
      if (this.eventStreamActive) {
        const errorMessage = e instanceof Error ? e.message : "Unknown error";
        console.error("[OpencodeService] SSE stream error:", errorMessage);
        this.lastSSEError = errorMessage;
        this.eventStreamActive = false;
        this.scheduleReconnect();
      }
    }
  }
  
  /**
   * 通知事件监听器（优化版本）
   * 使用 queueMicrotask 批量处理，减少同步阻塞
   */
  private notifyEventListeners(event: GlobalEvent): void {
    // 使用 Set 转数组避免迭代中修改问题
    const listeners = Array.from(this.eventListeners);
    
    for (const listener of listeners) {
      // 使用 queueMicrotask 异步执行，避免单个监听器阻塞
      queueMicrotask(() => {
        try {
          listener(event);
        } catch (e) {
          console.error("[OpencodeService] Event listener error:", e);
        }
      });
    }
  }

  /**
   * 调度 SSE 重连（指数退避策略）
   */
  private scheduleReconnect(): void {
    // 清除现有的重连定时器
    if (this.sseReconnectTimeout) {
      clearTimeout(this.sseReconnectTimeout);
      this.sseReconnectTimeout = null;
    }

    // 检查是否超过最大重试次数
    if (this.sseReconnectAttempts >= SSE_RECONNECT_CONFIG.maxRetries) {
      console.error("[OpencodeService] SSE max reconnect attempts reached, giving up");
      this.lastSSEError = "Max reconnect attempts reached";
      return;
    }

    // 计算退避延迟
    const delay = Math.min(
      SSE_RECONNECT_CONFIG.baseDelay * Math.pow(SSE_RECONNECT_CONFIG.backoffMultiplier, this.sseReconnectAttempts),
      SSE_RECONNECT_CONFIG.maxDelay
    );
    
    this.sseReconnectAttempts++;
    
    console.log(
      `[OpencodeService] Scheduling SSE reconnect in ${delay}ms (attempt ${this.sseReconnectAttempts}/${SSE_RECONNECT_CONFIG.maxRetries})`
    );

    this.sseReconnectTimeout = setTimeout(() => {
      if (this.connectionState.status === "connected") {
        this.startEventStream();
      }
    }, delay);
  }

  /**
   * 启动心跳检测
   * 如果超过 HEARTBEAT_TIMEOUT 没有收到心跳，认为连接已断开
   */
  private startHeartbeatCheck(): void {
    this.stopHeartbeatCheck();
    
    this.lastHeartbeatTime = Date.now();
    
    this.heartbeatCheckInterval = setInterval(() => {
      if (!this.eventStreamActive || !this.lastHeartbeatTime) {
        return;
      }
      
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeatTime;
      
      if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
        console.warn(
          `[OpencodeService] SSE heartbeat timeout (${timeSinceLastHeartbeat}ms since last heartbeat)`
        );
        
        // 强制重连
        this.eventStreamActive = false;
        this.lastSSEError = "Heartbeat timeout";
        this.scheduleReconnect();
      }
    }, 10000); // 每10秒检查一次
  }

  /**
   * 停止心跳检测
   */
  private stopHeartbeatCheck(): void {
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
      this.heartbeatCheckInterval = null;
    }
  }

  /**
   * 停止 SSE 事件流
   */
  stopEventStream(): void {
    if (!this.eventStreamActive && !this.sseReconnectTimeout) {
      return;
    }

    console.log("[OpencodeService] Stopping SSE event stream...");
    this.eventStreamActive = false;
    
    // 停止心跳检测
    this.stopHeartbeatCheck();
    
    // 取消重连定时器
    if (this.sseReconnectTimeout) {
      clearTimeout(this.sseReconnectTimeout);
      this.sseReconnectTimeout = null;
    }
    
    // 取消正在进行的请求
    this.eventAbortController?.abort();
    this.eventAbortController = null;
    
    // 重置状态
    this.sseReconnectAttempts = 0;
    this.lastHeartbeatTime = null;
  }

  /**
   * 注册 SSE 事件监听器
   * @returns 取消订阅函数
   */
  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  /**
   * 获取 SSE 事件流状态
   */
  isEventStreamActive(): boolean {
    return this.eventStreamActive;
  }
  
  /**
   * 获取 SSE 健康状态
   */
  getSSEHealthStatus(): SSEHealthStatus {
    return {
      isConnected: this.eventStreamActive,
      lastHeartbeat: this.lastHeartbeatTime,
      reconnectAttempts: this.sseReconnectAttempts,
      lastError: this.lastSSEError,
    };
  }
  
  /**
   * 手动触发 SSE 重连
   * 用于用户主动触发或错误恢复
   */
  async reconnectSSE(): Promise<void> {
    console.log("[OpencodeService] Manual SSE reconnect triggered");
    this.stopEventStream();
    this.sseReconnectAttempts = 0; // 重置重试计数
    await this.startEventStream();
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
    this.eventListeners.clear();
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
