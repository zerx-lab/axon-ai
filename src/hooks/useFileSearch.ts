/**
 * useFileSearch hook
 *
 * 使用 OpenCode SDK find.files API 搜索文件
 * 带防抖处理，避免频繁请求
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useOpencodeContext } from "@/providers/OpencodeProvider";

/**
 * 文件搜索结果项
 */
export interface FileSearchResult {
  /** 文件路径 */
  path: string;
  /** 显示名称 */
  display: string;
  /** 是否为目录 */
  isDirectory: boolean;
}

export interface UseFileSearchOptions {
  /** 防抖延迟（毫秒），默认 150 */
  debounceMs?: number;
  /** 最大结果数量，默认 50 */
  limit?: number;
  /** 项目目录 */
  directory?: string;
}

export interface UseFileSearchReturn {
  /** 搜索结果 */
  results: FileSearchResult[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 执行搜索 */
  search: (query: string) => void;
  /** 清空结果 */
  clearResults: () => void;
}

/**
 * 从路径中提取文件名
 */
function getFileName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

/**
 * useFileSearch hook
 *
 * 使用 SDK find.files API 搜索文件
 * 带防抖处理，避免频繁请求
 */
export function useFileSearch(options: UseFileSearchOptions = {}): UseFileSearchReturn {
  const { debounceMs = 150, limit = 50, directory } = options;
  const { client, isConnected } = useOpencodeContext();
  const [results, setResults] = useState<FileSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 防抖定时器
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 请求计数器（用于处理竞态）
  const requestIdRef = useRef<number>(0);

  /**
   * 执行文件搜索
   */
  const search = useCallback(
    (query: string) => {
      // 清除之前的防抖定时器
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // 如果查询为空，清空结果
      if (!query.trim()) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      // 如果未连接，不执行搜索
      if (!client || !isConnected) {
        setResults([]);
        return;
      }

      // 设置加载状态
      setIsLoading(true);

      // 防抖
      debounceTimer.current = setTimeout(async () => {
        const currentRequestId = ++requestIdRef.current;

        try {
          // 调用 SDK API
          const response = await client.find.files({
            query: query.trim(),
            dirs: "true", // 包含目录
            limit,
            directory,
          });

          // 检查是否是最新请求（处理竞态）
          if (currentRequestId !== requestIdRef.current) {
            return;
          }

          if (response.data) {
            const items: FileSearchResult[] = response.data.map((path) => ({
              path,
              display: getFileName(path),
              isDirectory: path.endsWith("/") || path.endsWith("\\"),
            }));
            setResults(items);
          } else {
            setResults([]);
          }
        } catch (e) {
          console.error("[useFileSearch] 搜索失败:", e);
          if (currentRequestId === requestIdRef.current) {
            setResults([]);
          }
        } finally {
          if (currentRequestId === requestIdRef.current) {
            setIsLoading(false);
          }
        }
      }, debounceMs);
    },
    [client, isConnected, debounceMs, limit, directory]
  );

  // 清空结果
  const clearResults = useCallback(() => {
    setResults([]);
    setIsLoading(false);
    // 增加请求 ID 以取消正在进行的请求
    requestIdRef.current++;
    // 清除防抖定时器
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    results,
    isLoading,
    search,
    clearResults,
  };
}
