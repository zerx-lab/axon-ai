/**
 * React hook for OpenCode service integration
 * 
 * Provides:
 * - Service state (connection status, backend status)
 * - SDK client access
 * - Service control actions
 */

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { 
  OpencodeService, 
  getOpencodeService,
  type OpencodeServiceState,
  type OpencodeClient,
  type ServiceMode,
} from "@/services/opencode";

interface UseOpencodeReturn {
  // State
  state: OpencodeServiceState;
  client: OpencodeClient | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  setMode: (mode: ServiceMode) => Promise<void>;
  
  // Backend control (local mode only)
  initializeBackend: () => Promise<void>;
  startBackend: () => Promise<void>;
  stopBackend: () => Promise<void>;
  restartBackend: () => Promise<void>;
}

// 全局初始化标记，确保只初始化一次
let globalInitialized = false;

/**
 * Hook for interacting with OpenCode service
 */
export function useOpencode(): UseOpencodeReturn {
  const [service] = useState<OpencodeService>(() => getOpencodeService());
  const [state, setState] = useState<OpencodeServiceState>(service.getState());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 使用 ref 缓存 client，避免每次渲染都获取新引用
  const clientRef = useRef<OpencodeClient | null>(null);

  // Subscribe to service state changes
  useEffect(() => {
    const unsubscribe = service.subscribe((newState) => {
      setState(newState);
      
      // Update error state based on connection
      if (newState.connectionState.status === "error") {
        setError(newState.connectionState.message);
      } else if (newState.connectionState.status === "connected") {
        setError(null);
      }
    });

    // 只初始化一次（全局）
    if (!globalInitialized) {
      globalInitialized = true;
      service.initialize().catch((e) => {
        console.error("Failed to initialize service:", e);
        setError(e instanceof Error ? e.message : "Initialization failed");
        // 初始化失败时重置标记，允许重试
        globalInitialized = false;
      });
    }

    return () => {
      unsubscribe();
    };
  }, [service]);

  // 派生状态 - 使用 useMemo 缓存
  const isConnected = state.connectionState.status === "connected";
  
  // 只在连接状态变化时更新 client ref
  const client = useMemo(() => {
    if (isConnected) {
      clientRef.current = service.getClient();
    } else {
      clientRef.current = null;
    }
    return clientRef.current;
  }, [isConnected, service]);

  // Actions
  const connect = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await service.connect();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const disconnect = useCallback(() => {
    service.disconnect();
  }, [service]);

  const setMode = useCallback(async (mode: ServiceMode) => {
    setIsLoading(true);
    setError(null);
    try {
      await service.setMode(mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to change mode");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  // Backend control
  const initializeBackend = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await service.initializeBackend();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backend initialization failed");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const startBackend = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await service.startBackend();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start backend");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const stopBackend = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await service.stopBackend();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to stop backend");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const restartBackend = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await service.restartBackend();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restart backend");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  return useMemo(() => ({
    state,
    client,
    isConnected,
    isLoading,
    error,
    connect,
    disconnect,
    setMode,
    initializeBackend,
    startBackend,
    stopBackend,
    restartBackend,
  }), [
    state,
    client,
    isConnected,
    isLoading,
    error,
    connect,
    disconnect,
    setMode,
    initializeBackend,
    startBackend,
    stopBackend,
    restartBackend,
  ]);
}
