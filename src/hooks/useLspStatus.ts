/**
 * LSP 状态 Hook
 * 
 * 获取和监听 OpenCode LSP 服务器状态
 * 支持通过 SSE 事件实时更新
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useOpencode } from "./useOpencode";
import { getOpencodeService } from "@/services/opencode";

/**
 * LSP 服务器状态
 */
export interface LspServer {
  id: string;
  name: string;
  root: string;
  status: "connected" | "error";
}

/**
 * LSP 状态统计
 */
export interface LspStatusStats {
  total: number;
  connected: number;
  error: number;
}

interface UseLspStatusReturn {
  // 状态
  servers: LspServer[];
  stats: LspStatusStats;
  isLoading: boolean;
  error: string | null;
  
  // 操作
  refresh: () => Promise<void>;
}

/**
 * 计算 LSP 状态统计
 */
function getLspStatusStats(servers: LspServer[]): LspStatusStats {
  return {
    total: servers.length,
    connected: servers.filter(s => s.status === "connected").length,
    error: servers.filter(s => s.status === "error").length,
  };
}

/**
 * Hook: 获取 LSP 服务器状态
 * 
 * @param directory - 可选的项目目录，不传则获取所有
 */
export function useLspStatus(directory?: string): UseLspStatusReturn {
  const { client, isConnected } = useOpencode();
  const [servers, setServers] = useState<LspServer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 使用 ref 存储 client，避免依赖变化导致的重新渲染
  const clientRef = useRef(client);
  clientRef.current = client;
  
  // 跟踪上一次的 isConnected 状态
  const prevIsConnectedRef = useRef(false);

  // 加载 LSP 状态 - 不依赖 client，使用 ref
  const loadLspStatus = useCallback(async () => {
    const currentClient = clientRef.current;
    if (!currentClient) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await currentClient.lsp.status({ directory });
      
      if (result.data) {
        // SDK 返回的数据可能是数组或对象
        const lspData = result.data as unknown;
        
        if (Array.isArray(lspData)) {
          setServers(lspData as LspServer[]);
        } else if (typeof lspData === "object" && lspData !== null) {
          // 如果是对象形式，转换为数组
          const serversArray = Object.values(lspData) as LspServer[];
          setServers(serversArray);
        } else {
          setServers([]);
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "获取 LSP 状态失败";
      console.error("[useLspStatus] 加载失败:", message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [directory]);

  // 当连接状态从 false 变为 true 时加载
  useEffect(() => {
    const wasConnected = prevIsConnectedRef.current;
    prevIsConnectedRef.current = isConnected;
    
    // 只在从断开变为连接时加载
    if (isConnected && !wasConnected) {
      loadLspStatus();
    }
  }, [isConnected, loadLspStatus]);

  // 监听 SSE 事件，实时更新 LSP 状态
  useEffect(() => {
    if (!isConnected) return;

    const service = getOpencodeService();
    
    const unsubscribe = service.onEvent((event) => {
      // 监听 LSP 更新事件
      if (event.payload.type === "lsp.updated") {
        // 重新加载状态
        loadLspStatus();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isConnected, loadLspStatus]);

  // 计算统计数据
  const stats = useMemo(() => getLspStatusStats(servers), [servers]);

  return useMemo(() => ({
    servers,
    stats,
    isLoading,
    error,
    refresh: loadLspStatus,
  }), [servers, stats, isLoading, error, loadLspStatus]);
}
