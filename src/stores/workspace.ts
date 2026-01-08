/**
 * 工作区状态管理
 * 
 * 管理默认工作目录和会话工作目录
 * - 默认目录：用于普通聊天会话，固定在用户配置目录下
 * - 项目目录：创建新会话时可以选择不同的项目目录
 */

import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";

// ============== 常量 ==============

/** 默认工作区子目录名称 */
const DEFAULT_WORKSPACE_NAME = "workspace";

/** localStorage 存储键名 - 默认工作区路径 */
const DEFAULT_WORKSPACE_STORAGE_KEY = "axon-default-workspace";

// ============== 类型定义 ==============

/** 工作区状态 */
export interface WorkspaceState {
  /** 默认工作目录（用于普通聊天） */
  defaultDirectory: string;
  /** 是否已初始化 */
  isInitialized: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
}

/** 工作区 Hook 返回值 */
export interface UseWorkspaceReturn {
  // 状态
  state: WorkspaceState;
  
  // 目录判断
  isDefaultDirectory: (directory: string) => boolean;
  getDisplayPath: (directory: string) => string;
  
  // 操作
  initialize: () => Promise<void>;
  openDirectoryPicker: () => Promise<string | null>;
}

// ============== 辅助函数 ==============

/**
 * 获取默认工作区目录
 * 优先从 localStorage 读取，否则使用应用数据目录
 */
async function getDefaultWorkspace(): Promise<string> {
  // 尝试从 localStorage 读取
  try {
    const saved = localStorage.getItem(DEFAULT_WORKSPACE_STORAGE_KEY);
    if (saved) {
      return saved;
    }
  } catch {
    // 忽略 localStorage 错误
  }
  
  // 使用应用数据目录
  const appData = await appDataDir();
  // 路径规范化：确保使用正斜杠，移除末尾斜杠
  const normalized = appData.replace(/\\/g, "/").replace(/\/$/, "");
  return `${normalized}/${DEFAULT_WORKSPACE_NAME}`;
}

/**
 * 确保目录存在
 */
async function ensureDirectoryExists(path: string): Promise<void> {
  try {
    await invoke("ensure_directory_exists", { path });
  } catch (e) {
    console.error("创建目录失败:", e);
    throw e;
  }
}

/**
 * 打开目录选择器
 */
async function selectDirectory(): Promise<string | null> {
  try {
    const result = await invoke<string | null>("select_directory");
    return result;
  } catch (e) {
    console.error("选择目录失败:", e);
    return null;
  }
}

/**
 * 获取目录显示名称
 * 如果是默认目录，返回 "默认"
 * 否则返回目录名或完整路径
 */
function getDirectoryDisplayName(
  directory: string,
  defaultDirectory: string
): string {
  // 规范化路径进行比较
  const normalizedDir = directory.replace(/\\/g, "/").replace(/\/$/, "");
  const normalizedDefault = defaultDirectory.replace(/\\/g, "/").replace(/\/$/, "");
  
  if (normalizedDir === normalizedDefault) {
    return "默认";
  }
  
  // 提取目录名
  const parts = normalizedDir.split("/");
  const dirName = parts[parts.length - 1];
  
  // 如果目录名太短或为空，返回更多路径信息
  if (!dirName || dirName.length < 2) {
    return parts.slice(-2).join("/") || normalizedDir;
  }
  
  return dirName;
}

// ============== Hook ==============

/**
 * 工作区管理 Hook
 */
export function useWorkspace(): UseWorkspaceReturn {
  const [state, setState] = useState<WorkspaceState>({
    defaultDirectory: "",
    isInitialized: false,
    isLoading: false,
    error: null,
  });

  // 初始化工作区
  const initialize = useCallback(async () => {
    if (state.isInitialized) return;
    
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // 获取默认工作区目录
      const defaultDir = await getDefaultWorkspace();
      
      // 确保目录存在
      await ensureDirectoryExists(defaultDir);
      
      // 保存到 localStorage
      try {
        localStorage.setItem(DEFAULT_WORKSPACE_STORAGE_KEY, defaultDir);
      } catch {
        // 忽略 localStorage 错误
      }
      
      setState({
        defaultDirectory: defaultDir,
        isInitialized: true,
        isLoading: false,
        error: null,
      });
      
      console.log("[Workspace] 初始化完成，默认目录:", defaultDir);
    } catch (e) {
      console.error("[Workspace] 初始化失败:", e);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: e instanceof Error ? e.message : "初始化工作区失败",
      }));
    }
  }, [state.isInitialized]);

  // 组件挂载时自动初始化
  useEffect(() => {
    initialize();
  }, [initialize]);

  // 判断是否为默认目录
  const isDefaultDirectory = useCallback(
    (directory: string): boolean => {
      const normalizedDir = directory.replace(/\\/g, "/").replace(/\/$/, "");
      const normalizedDefault = state.defaultDirectory.replace(/\\/g, "/").replace(/\/$/, "");
      return normalizedDir === normalizedDefault;
    },
    [state.defaultDirectory]
  );

  // 获取目录显示名称
  const getDisplayPath = useCallback(
    (directory: string): string => {
      return getDirectoryDisplayName(directory, state.defaultDirectory);
    },
    [state.defaultDirectory]
  );

  // 打开目录选择器
  const openDirectoryPicker = useCallback(async (): Promise<string | null> => {
    return selectDirectory();
  }, []);

  return {
    state,
    isDefaultDirectory,
    getDisplayPath,
    initialize,
    openDirectoryPicker,
  };
}
