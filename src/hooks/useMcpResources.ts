/**
 * useMcpResources hook
 *
 * 从 OpenCode SDK 获取 MCP 资源列表
 * 用于 "@" 提及补全
 */

import { useState, useEffect, useCallback } from "react";
import { useOpencodeContext } from "@/providers/OpencodeProvider";

/**
 * MCP 资源类型
 */
export interface McpResource {
  /** 资源名称 */
  name: string;
  /** 资源 URI */
  uri: string;
  /** 资源描述 */
  description?: string;
  /** MIME 类型 */
  mimeType?: string;
  /** 提供该资源的 MCP 客户端名称 */
  client: string;
}

export interface UseMcpResourcesOptions {
  /** 项目目录 */
  directory?: string;
}

export interface UseMcpResourcesReturn {
  /** MCP 资源列表 */
  resources: McpResource[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 刷新资源列表 */
  refreshResources: () => Promise<void>;
  /** 根据搜索词过滤资源 */
  filterResources: (searchText: string) => McpResource[];
}

/**
 * useMcpResources hook
 *
 * 从 SDK 获取 MCP 资源列表
 * 用于 @ 提及补全
 */
export function useMcpResources(options: UseMcpResourcesOptions = {}): UseMcpResourcesReturn {
  const { directory } = options;
  const { client, isConnected } = useOpencodeContext();
  const [resources, setResources] = useState<McpResource[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 加载 MCP 资源
  const refreshResources = useCallback(async () => {
    if (!client || !isConnected) return;

    setIsLoading(true);
    try {
      const response = await client.experimental.resource.list({ directory });
      if (response.data) {
        // SDK 返回 { [key: string]: McpResource }
        const resourceMap = response.data as Record<string, McpResource>;
        const resourceList = Object.values(resourceMap);
        setResources(resourceList);
      }
    } catch (e) {
      console.error("[useMcpResources] 加载资源失败:", e);
    } finally {
      setIsLoading(false);
    }
  }, [client, isConnected, directory]);

  // 连接时自动加载
  useEffect(() => {
    if (isConnected) {
      refreshResources();
    }
  }, [isConnected, refreshResources]);

  // 过滤函数
  const filterResources = useCallback(
    (searchText: string): McpResource[] => {
      if (!searchText) return resources;

      const search = searchText.toLowerCase();
      return resources.filter(
        (res) =>
          res.name.toLowerCase().includes(search) ||
          res.uri.toLowerCase().includes(search) ||
          (res.description?.toLowerCase().includes(search) ?? false) ||
          res.client.toLowerCase().includes(search)
      );
    },
    [resources]
  );

  return {
    resources,
    isLoading,
    refreshResources,
    filterResources,
  };
}
