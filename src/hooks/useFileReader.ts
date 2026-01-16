/**
 * useFileReader hook
 *
 * 通过 Tauri Command 读取本地文件内容
 * 用于 @ 提及时获取文件内容
 */

import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface UseFileReaderReturn {
  /** 是否正在读取 */
  isReading: boolean;
  /** 读取文件内容 */
  readFile: (path: string) => Promise<string | null>;
  /** 批量读取文件 */
  readFiles: (paths: string[]) => Promise<Map<string, string>>;
}

/**
 * useFileReader hook
 *
 * 通过 Tauri Command 读取文件内容
 */
export function useFileReader(): UseFileReaderReturn {
  const [isReading, setIsReading] = useState(false);

  /**
   * 读取单个文件内容
   * @param path 文件的绝对路径
   * @returns 文件内容，失败返回 null
   */
  const readFile = useCallback(async (path: string): Promise<string | null> => {
    setIsReading(true);
    try {
      const content = await invoke<string>("read_file_content", { path });
      return content;
    } catch (e) {
      console.error("[useFileReader] 读取文件失败:", path, e);
      return null;
    } finally {
      setIsReading(false);
    }
  }, []);

  /**
   * 批量读取文件
   * @param paths 文件路径数组
   * @returns Map<路径, 内容>，失败的文件不会包含在结果中
   */
  const readFiles = useCallback(
    async (paths: string[]): Promise<Map<string, string>> => {
      setIsReading(true);
      const results = new Map<string, string>();

      try {
        // 并行读取所有文件
        const promises = paths.map(async (path) => {
          try {
            const content = await invoke<string>("read_file_content", { path });
            return { path, content };
          } catch {
            return { path, content: null };
          }
        });

        const settled = await Promise.all(promises);

        for (const { path, content } of settled) {
          if (content !== null) {
            results.set(path, content);
          }
        }
      } finally {
        setIsReading(false);
      }

      return results;
    },
    []
  );

  return {
    isReading,
    readFile,
    readFiles,
  };
}

/**
 * 构建绝对路径
 * 如果 path 已是绝对路径则返回原值
 * 否则拼接 projectPath
 */
export function toAbsolutePath(path: string, projectPath?: string): string {
  // Windows 绝对路径: C:\ 或 D:\
  // Unix 绝对路径: /
  const isAbsolute =
    path.startsWith("/") || /^[a-zA-Z]:[/\\]/.test(path);

  if (isAbsolute) {
    return path;
  }

  if (projectPath) {
    // 确保路径分隔符一致
    const separator = projectPath.includes("\\") ? "\\" : "/";
    return `${projectPath}${separator}${path}`;
  }

  return path;
}
