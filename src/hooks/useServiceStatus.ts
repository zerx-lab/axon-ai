/**
 * Hook for listening to opencode service status changes via Tauri events
 */

import { useEffect, useState, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { opencode, type ServiceStatus, type ServiceConfig } from "@/services/tauri";

// Event names (must match Rust constants)
const EVENT_SERVICE_STATUS = "service:status";
const EVENT_DOWNLOAD_PROGRESS = "service:download-progress";

interface DownloadProgress {
  downloaded: number;
  total: number | null;
  percentage: number;
}

interface UseServiceStatusReturn {
  status: ServiceStatus;
  config: ServiceConfig | null;
  downloadProgress: DownloadProgress | null;
  isLoading: boolean;
  error: string | null;
  // Actions
  initialize: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook to monitor and control the opencode service
 */
export function useServiceStatus(): UseServiceStatusReturn {
  const [status, setStatus] = useState<ServiceStatus>({ type: "uninitialized" });
  const [config, setConfig] = useState<ServiceConfig | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial status and config
  const refresh = useCallback(async () => {
    try {
      const [newStatus, newConfig] = await Promise.all([
        opencode.getStatus(),
        opencode.getConfig(),
      ]);
      setStatus(newStatus);
      setConfig(newConfig);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch status");
    }
  }, []);

  // Initialize service
  const initialize = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await opencode.initialize();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initialize");
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  // Start service
  const start = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await opencode.start();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start service");
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  // Stop service
  const stop = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await opencode.stop();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to stop service");
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  // Restart service
  const restart = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await opencode.restart();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restart service");
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  // Listen for status updates from Tauri
  useEffect(() => {
    let unlistenStatus: UnlistenFn | undefined;
    let unlistenProgress: UnlistenFn | undefined;

    const setupListeners = async () => {
      // Listen for status changes
      unlistenStatus = await listen<ServiceStatus>(EVENT_SERVICE_STATUS, (event) => {
        setStatus(event.payload);
        // Clear download progress when not downloading
        if (event.payload.type !== "downloading") {
          setDownloadProgress(null);
        }
      });

      // Listen for download progress
      unlistenProgress = await listen<DownloadProgress>(EVENT_DOWNLOAD_PROGRESS, (event) => {
        setDownloadProgress(event.payload);
      });
    };

    setupListeners();

    // Initial fetch
    refresh();

    return () => {
      unlistenStatus?.();
      unlistenProgress?.();
    };
  }, [refresh]);

  return {
    status,
    config,
    downloadProgress,
    isLoading,
    error,
    initialize,
    start,
    stop,
    restart,
    refresh,
  };
}
