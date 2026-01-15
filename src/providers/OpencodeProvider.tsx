/**
 * OpenCode Service Provider
 * 
 * 在应用启动时自动初始化和启动 OpenCode 服务
 * 提供全局的服务状态上下文
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode
} from "react";
import {
  OpencodeService,
  getOpencodeService,
  type OpencodeServiceState,
  type OpencodeClient,
  type ServiceMode,
  type EventListener,
  type SSEHealthStatus,
} from "@/services/opencode";
import { useTerminal } from "@/stores/terminal";
import { useServiceStore } from "@/stores/service";
import { hideAppLoading } from "@/main";

interface OpencodeContextValue {
  // 状态
  state: OpencodeServiceState;
  client: OpencodeClient | null;
  isConnected: boolean;
  isInitializing: boolean;
  error: string | null;
  
  // SSE 健康状态
  sseHealth: SSEHealthStatus;
  
  // 操作
  connect: () => Promise<void>;
  disconnect: () => void;
  setMode: (mode: ServiceMode) => Promise<void>;
  startService: () => Promise<void>;
  stopService: () => Promise<void>;
  restartService: () => Promise<void>;
  retry: () => Promise<void>;
  
  // SSE 事件订阅
  onEvent: (listener: EventListener) => () => void;
  
  // SSE 重连（用于手动恢复连接）
  reconnectSSE: () => Promise<void>;
}

const OpencodeContext = createContext<OpencodeContextValue | null>(null);

interface OpencodeProviderProps {
  children: ReactNode;
  autoStart?: boolean;
}

/**
 * OpenCode 服务 Provider
 * 
 * 功能：
 * 1. 应用启动时自动初始化服务
 * 2. 如果配置了 autoStart，自动启动 opencode serve
 * 3. 服务启动后自动连接
 * 4. 提供全局状态和操作方法
 */
export function OpencodeProvider({
  children,
  autoStart = true
}: OpencodeProviderProps) {
  const [service] = useState<OpencodeService>(() => getOpencodeService());
  const [state, setState] = useState<OpencodeServiceState>(service.getState());
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 用于确保 loading 只隐藏一次
  const loadingHiddenRef = useRef(false);

  // 获取 terminal store 的方法
  const setTerminalClient = useTerminal((s) => s.setOpencodeClient);
  const clearTerminalTabs = useTerminal((s) => s.clearAllTabs);

  // 初始化服务
  useEffect(() => {
    let mounted = true;
    
    // 立即隐藏首屏 loading，让用户直接看到主界面
    // 下载/启动等状态在右上角 ServiceStatus 组件中展示
    if (!loadingHiddenRef.current) {
      loadingHiddenRef.current = true;
      hideAppLoading();
    }

    const initService = async () => {
      // 用于追踪是否已完成初始化的标志
      let initializationCompleted = false;
      
      const completeInitialization = () => {
        if (!initializationCompleted && mounted) {
          initializationCompleted = true;
          setIsInitializing(false);
          console.log("[OpencodeProvider] Initialization completed");
        }
      };
      
      try {
        console.log("[OpencodeProvider] Starting initialization...");
        setIsInitializing(true);
        setError(null);

        // 订阅状态变化
        const unsubscribe = service.subscribe((newState) => {
          if (mounted) {
            console.log("[OpencodeProvider] State updated:", {
              backendStatus: newState.backendStatus.type,
              connectionStatus: newState.connectionState.status,
            });
            setState(newState);
            
            // 更新错误状态
            if (newState.connectionState.status === "error") {
              setError(newState.connectionState.message);
              // 连接出错时也完成初始化（让用户看到错误）
              completeInitialization();
            } else if (newState.backendStatus.type === "error") {
              const errorState = newState.backendStatus as { type: "error"; message: string };
              setError(errorState.message);
              // 后端出错时也完成初始化
              completeInitialization();
            }
            
            // 当连接成功时，完成初始化
            if (newState.connectionState.status === "connected") {
              completeInitialization();
            }
          }
        });

        // 初始化服务（监听 Tauri 事件等）
        await service.initialize();

        // 检查后端状态，如果需要则启动服务
        const currentState = service.getState();
        console.log("[OpencodeProvider] Current state after init:", {
          backendStatus: currentState.backendStatus.type,
          mode: currentState.config.mode.type,
          autoStart,
        });
        
        if (autoStart && currentState.config.mode.type === "local") {
          // 本地模式：检查是否需要启动服务
          if (currentState.backendStatus.type === "ready") {
            console.log("[OpencodeProvider] Starting opencode service...");
            await service.startBackend();
            // startBackend 会触发状态变化，连接成功后会自动完成初始化
          } else if (currentState.backendStatus.type === "running") {
            // 服务已在运行，直接连接
            console.log("[OpencodeProvider] Service already running, connecting...");
            await service.connect();
            // connect 完成后检查是否已连接
            const afterConnectState = service.getState();
            if (afterConnectState.connectionState.status === "connected") {
              completeInitialization();
            }
          } else {
            console.log("[OpencodeProvider] Backend status is:", currentState.backendStatus.type, "- waiting for status change");
            // 等待后端状态变化，当变为 running 并连接成功时会自动完成初始化
            // 但设置一个超时保护，避免无限等待
            setTimeout(() => {
              if (!initializationCompleted && mounted) {
                console.log("[OpencodeProvider] Initialization timeout, completing anyway");
                completeInitialization();
              }
            }, 10000); // 10秒超时
          }
        } else if (currentState.config.mode.type === "remote") {
          // 远程模式：直接尝试连接
          console.log("[OpencodeProvider] Remote mode, connecting...");
          await service.connect();
          const afterConnectState = service.getState();
          if (afterConnectState.connectionState.status === "connected") {
            completeInitialization();
          }
        } else {
          // 非自动启动模式，直接完成初始化
          completeInitialization();
        }

        return () => {
          mounted = false;
          unsubscribe();
        };
      } catch (e) {
        console.error("[OpencodeProvider] Failed to initialize:", e);
        if (mounted) {
          setError(e instanceof Error ? e.message : "初始化失败");
          completeInitialization();
        }
      }
    };

    initService();

    return () => {
      mounted = false;
    };
  }, [service, autoStart]);

  // 追踪之前的连接状态，用于检测服务断开
  const prevConnectionStatusRef = useRef<string | null>(null);

  // 获取 ServiceStore 的同步方法
  const setServiceClient = useServiceStore(s => s._setClient);
  const setServiceConnected = useServiceStore(s => s._setConnected);

  // 同步 client、endpoint 和 directory 到 terminal store 和 service store
  // 并在服务断开时清理终端
  useEffect(() => {
    const client = service.getClient();
    const endpoint = state.endpoint || null;
    // 使用当前工作目录作为默认目录
    const directory = ".";
    const currentStatus = state.connectionState.status;
    const prevStatus = prevConnectionStatusRef.current;
    const isConnected = currentStatus === "connected";

    console.log("[OpencodeProvider] Syncing to stores:", {
      hasClient: !!client,
      endpoint,
      directory,
      connectionStatus: currentStatus,
      prevStatus,
    });

    // 检测服务断开：从 connected 变为其他状态
    // 此时服务端的 PTY 会话已失效，需要清理前端终端 tabs
    if (prevStatus === "connected" && currentStatus !== "connected") {
      console.log("[OpencodeProvider] 服务断开，清理终端标签页");
      clearTerminalTabs();
    }

    prevConnectionStatusRef.current = currentStatus;
    setTerminalClient(client, endpoint, directory);

    // 同步到 ServiceStore
    setServiceClient(client);
    setServiceConnected(isConnected);
  }, [service, state.connectionState.status, state.endpoint, setTerminalClient, clearTerminalTabs, setServiceClient, setServiceConnected]);

  // 连接
  const connect = useCallback(async () => {
    setError(null);
    try {
      await service.connect();
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败");
    }
  }, [service]);

  // 断开
  const disconnect = useCallback(() => {
    service.disconnect();
  }, [service]);

  // 设置模式
  const setMode = useCallback(async (mode: ServiceMode) => {
    setError(null);
    try {
      await service.setMode(mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "模式切换失败");
    }
  }, [service]);

  // 启动服务
  const startService = useCallback(async () => {
    setError(null);
    try {
      await service.startBackend();
    } catch (e) {
      setError(e instanceof Error ? e.message : "启动服务失败");
    }
  }, [service]);

  // 停止服务
  const stopService = useCallback(async () => {
    setError(null);
    try {
      await service.stopBackend();
    } catch (e) {
      setError(e instanceof Error ? e.message : "停止服务失败");
    }
  }, [service]);

  // 重启服务
  const restartService = useCallback(async () => {
    setError(null);
    try {
      await service.restartBackend();
    } catch (e) {
      setError(e instanceof Error ? e.message : "重启服务失败");
    }
  }, [service]);

  // 重试（重新初始化和启动）
  const retry = useCallback(async () => {
    setError(null);
    setIsInitializing(true);
    try {
      // 先停止现有服务
      await service.stopBackend().catch(() => {});
      // 重新初始化
      await service.initializeBackend();
      // 启动服务
      await service.startBackend();
    } catch (e) {
      setError(e instanceof Error ? e.message : "重试失败");
    } finally {
      setIsInitializing(false);
    }
  }, [service]);

  // SSE 事件订阅
  const onEvent = useCallback((listener: EventListener) => {
    return service.onEvent(listener);
  }, [service]);
  
  // SSE 重连
  const reconnectSSE = useCallback(async () => {
    try {
      await service.reconnectSSE();
    } catch (e) {
      console.error("[OpencodeProvider] SSE reconnect failed:", e);
    }
  }, [service]);
  
  // 获取 SSE 健康状态
  const sseHealth = service.getSSEHealthStatus();

  const value: OpencodeContextValue = {
    state,
    client: service.getClient(),
    isConnected: state.connectionState.status === "connected",
    isInitializing,
    error,
    sseHealth,
    connect,
    disconnect,
    setMode,
    startService,
    stopService,
    restartService,
    retry,
    onEvent,
    reconnectSSE,
  };

  return (
    <OpencodeContext.Provider value={value}>
      {children}
    </OpencodeContext.Provider>
  );
}

/**
 * 使用 OpenCode 上下文的 Hook
 */
export function useOpencodeContext(): OpencodeContextValue {
  const context = useContext(OpencodeContext);
  if (!context) {
    throw new Error("useOpencodeContext must be used within OpencodeProvider");
  }
  return context;
}
