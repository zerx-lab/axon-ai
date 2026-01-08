/**
 * 聊天状态管理 - Provider/模型管理
 * 
 * 包含 Provider 列表获取、模型选择等功能
 */

import { useCallback } from "react";
import type { OpencodeClient } from "@/services/opencode/types";
import { MODEL_STORAGE_KEY, type Provider, type SelectedModel } from "./types";

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
          models: Record<string, { id: string; name: string }>;
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
