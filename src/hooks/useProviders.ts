/**
 * React hook for fetching model providers
 * 
 * 提供模型列表获取功能，供编排页面和其他需要模型选择的地方复用
 */

import { useState, useEffect, useCallback } from "react";
import { useOpencode } from "./useOpencode";

/** 模型信息 */
export interface ProviderModel {
  id: string;
  name: string;
  provider: string;
}

/** Provider 信息 */
export interface Provider {
  id: string;
  name: string;
  models: ProviderModel[];
}

export interface UseProvidersReturn {
  /** Provider 列表（已连接的） */
  providers: Provider[];
  /** 所有模型的平铺列表 */
  models: ProviderModel[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 刷新 providers */
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching model providers from OpenCode API
 */
export function useProviders(): UseProvidersReturn {
  const { client, isConnected } = useOpencode();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!client) return;

    setIsLoading(true);
    setError(null);

    try {
      const providerResponse = await client.provider.list();

      if (providerResponse.data) {
        const providerData = providerResponse.data;

        const all = providerData.all as Array<{
          id: string;
          name: string;
          models: Record<string, { id: string; name: string }>;
        }>;
        const connected = providerData.connected as string[];

        // 只显示已连接的 providers
        const connectedProviders = all
          .filter((p) => connected.includes(p.id))
          .map((p) => ({
            id: p.id,
            name: p.name,
            models: Object.entries(p.models).map(([modelId, model]) => ({
              id: modelId,
              name: model.name,
              provider: p.id,
            })),
          }));

        setProviders(connectedProviders);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "加载 providers 失败";
      setError(message);
      console.error("加载 providers 失败:", e);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // 连接成功后自动加载
  useEffect(() => {
    if (isConnected && client) {
      refresh();
    }
  }, [isConnected, client, refresh]);

  // 派生：所有模型的平铺列表
  const models = providers.flatMap((p) => p.models);

  return {
    providers,
    models,
    isLoading,
    error,
    refresh,
  };
}
