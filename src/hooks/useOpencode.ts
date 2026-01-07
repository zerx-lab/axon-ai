/**
 * React hook for OpenCode service integration
 * 
 * Provides:
 * - Service state (connection status, backend status)
 * - SDK client access
 * - Service control actions
 */

import { useEffect, useState, useCallback, useMemo } from "react";
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

/**
 * Hook for interacting with OpenCode service
 */
export function useOpencode(): UseOpencodeReturn {
  const [service] = useState<OpencodeService>(() => getOpencodeService());
  const [state, setState] = useState<OpencodeServiceState>(service.getState());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    // Initialize service on mount
    service.initialize().catch((e) => {
      console.error("Failed to initialize service:", e);
      setError(e instanceof Error ? e.message : "Initialization failed");
    });

    return () => {
      unsubscribe();
    };
  }, [service]);

  // Derived state
  const isConnected = state.connectionState.status === "connected";
  const client = service.getClient();

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
