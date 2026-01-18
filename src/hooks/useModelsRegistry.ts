import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ModelDefaults, ModelsRegistryCacheInfo } from "@/types/modelsRegistry";

export interface UseModelsRegistryReturn {
  getModelDefaults: (modelId: string) => Promise<ModelDefaults | null>;
  getCachedModelDefaults: (modelId: string) => ModelDefaults | undefined;
  allModels: ModelDefaults[];
  isLoading: boolean;
  error: string | null;
  cacheInfo: ModelsRegistryCacheInfo | null;
  refresh: () => Promise<void>;
  triggerBackgroundRefresh: () => Promise<void>;
}

export function useModelsRegistry(): UseModelsRegistryReturn {
  const [allModels, setAllModels] = useState<ModelDefaults[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<ModelsRegistryCacheInfo | null>(null);

  const modelsMap = useMemo(() => {
    const map = new Map<string, ModelDefaults>();
    for (const model of allModels) {
      map.set(model.modelId, model);
    }
    return map;
  }, [allModels]);

  const loadAllModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const models = await invoke<ModelDefaults[]>("get_all_model_defaults");
      setAllModels(models);

      const info = await invoke<[string, number, boolean] | null>("get_models_registry_cache_info");
      if (info) {
        setCacheInfo({
          hash: info[0],
          timestamp: info[1],
          isExpired: info[2],
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      console.error("加载模型注册表失败:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllModels();
  }, [loadAllModels]);

  const getModelDefaults = useCallback(async (modelId: string): Promise<ModelDefaults | null> => {
    const cached = modelsMap.get(modelId);
    if (cached) {
      return cached;
    }

    try {
      const defaults = await invoke<ModelDefaults | null>("get_model_defaults", { modelId });
      return defaults;
    } catch (e) {
      console.error(`获取模型默认参数失败: ${modelId}`, e);
      return null;
    }
  }, [modelsMap]);

  const getCachedModelDefaults = useCallback((modelId: string): ModelDefaults | undefined => {
    return modelsMap.get(modelId);
  }, [modelsMap]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await invoke("refresh_models_registry");
      await loadAllModels();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      console.error("刷新模型注册表失败:", e);
    } finally {
      setIsLoading(false);
    }
  }, [loadAllModels]);

  const triggerBackgroundRefresh = useCallback(async () => {
    try {
      await invoke("trigger_background_refresh");
    } catch (e) {
      console.error("触发后台刷新失败:", e);
    }
  }, []);

  return {
    getModelDefaults,
    getCachedModelDefaults,
    allModels,
    isLoading,
    error,
    cacheInfo,
    refresh,
    triggerBackgroundRefresh,
  };
}
