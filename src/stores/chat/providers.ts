/**
 * 聊天状态管理 - Provider/模型管理
 * 
 * 包含 Provider 列表获取、模型选择、Variant 管理等功能
 */

import { useCallback } from "react";
import type { OpencodeClient } from "@/services/opencode/types";
import { 
  MODEL_STORAGE_KEY, 
  VARIANT_STORAGE_KEY, 
  type Provider, 
  type SelectedModel, 
  type SelectedVariants, 
  type ModelVariants 
} from "./types";

// ============== 刷新 Providers ==============

/**
 * 刷新 Providers 和 Models Hook
 */
export function useRefreshProviders(
  client: OpencodeClient | null,
  selectedModelRef: React.MutableRefObject<SelectedModel | null>,
  setProviders: React.Dispatch<React.SetStateAction<Provider[]>>,
  setSelectedModel: React.Dispatch<React.SetStateAction<SelectedModel | null>>,
  setIsLoadingModels: React.Dispatch<React.SetStateAction<boolean>>
) {
  return useCallback(async () => {
    if (!client) return;
    
    setIsLoadingModels(true);
    
    try {
      // 获取 providers 列表
      const providerResponse = await client.provider.list();
      
      if (providerResponse.data) {
        // response.data 包含 { all, connected, default }
        // SDK 返回的 Provider 类型比我们需要的更复杂，只提取我们需要的字段
        const providerData = providerResponse.data;
        
        const all = providerData.all as Array<{
          id: string;
          name: string;
          models: Record<string, { 
            id: string; 
            name: string;
            variants?: ModelVariants;
          }>;
        }>;
        const connected = providerData.connected as string[];
        // default 是一个 map: { [agentName: string]: "provider/modelId" }
        // 例如: { "coder": "anthropic/claude-3-5-sonnet", "task": "openai/gpt-4" }
        const defaultModels = providerData.default as Record<string, string> | undefined;
        
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
              // 解析模型的 variants 配置
              variants: model.variants,
            })),
          }));
        
        setProviders(connectedProviders);
        
        // 如果没有选择模型，按优先级选择：
        // 1. 从 localStorage 获取已保存的模型（用户上次的选择）
        // 2. 使用 provider.list() 返回的默认模型
        // 3. 选择第一个可用的模型
        // 使用 ref 获取最新的 selectedModel 值，避免闭包问题
        if (!selectedModelRef.current) {
          let modelSet = false;
          
          // 优先级 1: 从 localStorage 读取已保存的模型
          try {
            const savedModelStr = localStorage.getItem(MODEL_STORAGE_KEY);
            if (savedModelStr) {
              const savedModel = JSON.parse(savedModelStr) as { providerId?: string; modelId?: string };
              if (savedModel.providerId && savedModel.modelId) {
                // 验证模型是否存在于已连接的 providers 中
                const providerExists = connectedProviders.find((p) => p.id === savedModel.providerId);
                const modelExists = providerExists?.models.find((m) => m.id === savedModel.modelId);
                if (providerExists && modelExists) {
                  setSelectedModel({
                    providerId: savedModel.providerId,
                    modelId: savedModel.modelId,
                  });
                  modelSet = true;
                }
              }
            }
          } catch {
            // 忽略 localStorage 读取错误
          }
          
          // 优先级 2: 使用 provider.list() 返回的默认模型
          // defaultModels 格式: { "coder": "provider/modelId", ... }
          // 使用 "coder" agent 的默认模型
          if (!modelSet && defaultModels) {
            const defaultModelStr = defaultModels["coder"] || Object.values(defaultModels)[0];
            if (defaultModelStr && typeof defaultModelStr === "string" && defaultModelStr.includes("/")) {
              const parts = defaultModelStr.split("/");
              if (parts.length >= 2 && parts[0] && parts[1]) {
                const defaultProviderId = parts[0];
                const defaultModelId = parts.slice(1).join("/");
                // 验证默认模型是否存在
                const providerExists = connectedProviders.find((p) => p.id === defaultProviderId);
                const modelExists = providerExists?.models.find((m) => m.id === defaultModelId);
                if (providerExists && modelExists) {
                  setSelectedModel({
                    providerId: defaultProviderId,
                    modelId: defaultModelId,
                  });
                  modelSet = true;
                }
              }
            }
          }
          
          // 优先级 3: 选择第一个可用的模型
          if (!modelSet && connectedProviders.length > 0 && connectedProviders[0].models.length > 0) {
            const firstProvider = connectedProviders[0];
            const firstModel = firstProvider.models[0];
            setSelectedModel({
              providerId: firstProvider.id,
              modelId: firstModel.id,
            });
          }
        }
      }
    } catch (e) {
      console.error("加载 providers 失败:", e);
    } finally {
      setIsLoadingModels(false);
    }
  }, [client, selectedModelRef, setProviders, setSelectedModel, setIsLoadingModels]);
}

// ============== 选择模型 ==============

/**
 * 选择模型 Hook
 */
export function useSelectModel(
  setSelectedModel: React.Dispatch<React.SetStateAction<SelectedModel | null>>
) {
  return useCallback((providerId: string, modelId: string) => {
    const model = { providerId, modelId };
    setSelectedModel(model);
    
    // 保存到 localStorage
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(model));
    } catch (e) {
      console.error("保存模型选择失败:", e);
    }
  }, [setSelectedModel]);
}

// ============== Variant 管理 ==============

/**
 * 生成模型的唯一键
 */
export function getModelKey(providerId: string, modelId: string): string {
  return `${providerId}/${modelId}`;
}

/**
 * 从 localStorage 加载已保存的 variant 选择
 */
export function loadSavedVariants(): SelectedVariants {
  try {
    const saved = localStorage.getItem(VARIANT_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as SelectedVariants;
    }
  } catch {
    // 忽略读取错误
  }
  return {};
}

/**
 * 保存 variant 选择到 localStorage
 */
export function saveVariants(variants: SelectedVariants): void {
  try {
    localStorage.setItem(VARIANT_STORAGE_KEY, JSON.stringify(variants));
  } catch (e) {
    console.error("保存 variant 选择失败:", e);
  }
}

/**
 * 使用 Variant 操作 Hook
 */
export function useVariantOperations(
  providers: Provider[],
  selectedModel: SelectedModel | null,
  selectedVariants: SelectedVariants,
  setSelectedVariants: React.Dispatch<React.SetStateAction<SelectedVariants>>
) {
  // 获取当前模型
  const getCurrentModel = useCallback(() => {
    if (!selectedModel) return null;
    for (const provider of providers) {
      if (provider.id === selectedModel.providerId) {
        const model = provider.models.find((m) => m.id === selectedModel.modelId);
        if (model) return model;
      }
    }
    return null;
  }, [providers, selectedModel]);

  // 获取当前模型可用的 variants 列表
  const currentVariants = useCallback((): string[] => {
    const model = getCurrentModel();
    if (!model?.variants) return [];
    return Object.keys(model.variants);
  }, [getCurrentModel]);

  // 获取当前选中的 variant
  const selectedVariant = useCallback((): string | undefined => {
    if (!selectedModel) return undefined;
    const key = getModelKey(selectedModel.providerId, selectedModel.modelId);
    return selectedVariants[key];
  }, [selectedModel, selectedVariants]);

  // 设置当前模型的 variant
  const selectVariant = useCallback((variant: string | undefined) => {
    if (!selectedModel) return;
    const key = getModelKey(selectedModel.providerId, selectedModel.modelId);
    
    setSelectedVariants((prev) => {
      const updated = { ...prev };
      if (variant === undefined) {
        delete updated[key];
      } else {
        updated[key] = variant;
      }
      // 持久化保存
      saveVariants(updated);
      return updated;
    });
  }, [selectedModel, setSelectedVariants]);

  // 循环切换 variant
  const cycleVariant = useCallback(() => {
    const variants = currentVariants();
    if (variants.length === 0) return;

    const current = selectedVariant();
    
    if (!current) {
      // 没有选中任何 variant，选择第一个
      selectVariant(variants[0]);
      return;
    }

    const index = variants.indexOf(current);
    if (index === -1 || index === variants.length - 1) {
      // 找不到或已经是最后一个，重置为默认
      selectVariant(undefined);
      return;
    }

    // 选择下一个
    selectVariant(variants[index + 1]);
  }, [currentVariants, selectedVariant, selectVariant]);

  return {
    getCurrentModel,
    currentVariants,
    selectedVariant,
    selectVariant,
    cycleVariant,
  };
}
