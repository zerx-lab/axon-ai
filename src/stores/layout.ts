/**
 * 工作区布局状态管理
 *
 * 管理每个项目的工作区布局配置：
 * - 面板宽度比例
 * - 打开的文件标签
 * - 编辑器可见性
 * - 与 Rust 后端同步持久化
 * 
 * 设计原则：
 * - 使用 localStorage 缓存，实现同步加载，避免闪烁
 * - 后台与 Rust 后端同步，保证数据一致性
 * - 拖拽过程中防抖保存，避免频繁更新
 */

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

// ============== 类型定义 ==============

/** 打开的文件标签信息（与 Rust 后端对应） */
export interface OpenedTab {
  /** 文件路径 */
  path: string;
  /** 文件名 */
  name: string;
  /** 语言类型 */
  language: string;
}

/** 工作区布局配置（与 Rust 后端对应） */
export interface WorkspaceLayout {
  /** 项目目录（用于标识） */
  project_directory: string;
  /** 侧边栏宽度（像素） */
  sidebar_width: number | null;
  /** 编辑器面板占比（百分比 0-100） */
  editor_panel_ratio: number | null;
  /** 终端面板高度（像素） */
  terminal_panel_height: number | null;
  /** 打开的文件标签列表 */
  opened_tabs: OpenedTab[];
  /** 当前活动的文件路径 */
  active_tab_path: string | null;
  /** 编辑器面板是否可见 */
  editor_visible: boolean;
  /** 最后更新时间（Unix 时间戳毫秒） */
  updated_at: number;
}

/** 布局 Store 状态 */
interface LayoutState {
  /** 当前项目目录 */
  currentProjectDirectory: string | null;
  /** 当前布局配置 */
  layout: WorkspaceLayout | null;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否已初始化 */
  isInitialized: boolean;
  /** 错误信息 */
  error: string | null;
}

/** 布局 Store 操作 */
interface LayoutActions {
  /** 加载项目布局（同步从缓存加载，后台从 Rust 同步） */
  loadLayout: (projectDirectory: string) => void;
  /** 保存当前布局（立即保存） */
  saveLayout: () => Promise<void>;
  /** 更新侧边栏宽度 */
  updateSidebarWidth: (width: number) => void;
  /** 更新编辑器面板比例 */
  updateEditorPanelRatio: (ratio: number) => void;
  /** 更新终端面板高度 */
  updateTerminalPanelHeight: (height: number) => void;
  /** 更新打开的标签页 */
  updateOpenedTabs: (tabs: OpenedTab[]) => void;
  /** 更新活动标签页 */
  updateActiveTabPath: (path: string | null) => void;
  /** 更新编辑器可见性 */
  updateEditorVisible: (visible: boolean) => void;
  /** 重置布局为默认值 */
  resetLayout: () => void;
  /** 清除错误 */
  clearError: () => void;
}

type LayoutStore = LayoutState & LayoutActions;

// ============== 缓存管理 ==============

const CACHE_KEY_PREFIX = "axon_layout_";

/** 生成缓存 key（基于项目目录的 hash） */
function getCacheKey(projectDirectory: string): string {
  // 简单 hash，避免路径中的特殊字符
  let hash = 0;
  for (let i = 0; i < projectDirectory.length; i++) {
    const char = projectDirectory.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${CACHE_KEY_PREFIX}${Math.abs(hash).toString(36)}`;
}

/** 从 localStorage 同步读取缓存 */
function loadFromCache(projectDirectory: string): WorkspaceLayout | null {
  try {
    const key = getCacheKey(projectDirectory);
    const cached = localStorage.getItem(key);
    if (cached) {
      const layout = JSON.parse(cached) as WorkspaceLayout;
      // 验证项目目录匹配
      if (layout.project_directory === projectDirectory) {
        return layout;
      }
    }
  } catch (e) {
    console.warn("[Layout] 读取缓存失败:", e);
  }
  return null;
}

/** 保存到 localStorage */
function saveToCache(layout: WorkspaceLayout): void {
  try {
    const key = getCacheKey(layout.project_directory);
    localStorage.setItem(key, JSON.stringify(layout));
  } catch (e) {
    console.warn("[Layout] 写入缓存失败:", e);
  }
}

// ============== 默认值 ==============

/** 创建默认布局 */
function createDefaultLayout(projectDirectory: string): WorkspaceLayout {
  return {
    project_directory: projectDirectory,
    sidebar_width: 256,
    editor_panel_ratio: 50,
    terminal_panel_height: null,
    opened_tabs: [],
    active_tab_path: null,
    editor_visible: false,
    updated_at: Date.now(),
  };
}

// ============== 保存管理 ==============

let saveTimerId: ReturnType<typeof setTimeout> | null = null;
const SAVE_DELAY = 2000;

function cancelPendingSave(): void {
  if (saveTimerId) {
    clearTimeout(saveTimerId);
    saveTimerId = null;
  }
}

/** 延迟保存（同时保存到缓存和 Rust） */
function deferredSave(getLayout: () => WorkspaceLayout | null): void {
  cancelPendingSave();
  saveTimerId = setTimeout(async () => {
    const layout = getLayout();
    if (!layout) return;
    
    // 立即保存到缓存
    saveToCache(layout);
    
    // 异步保存到 Rust
    try {
      await invoke("save_workspace_layout", { layout });
      console.log("[Layout] 布局已保存");
    } catch (e) {
      console.error("[Layout] 保存到 Rust 失败:", e);
    }
  }, SAVE_DELAY);
}

// ============== Store 实现 ==============

export const useLayout = create<LayoutStore>((set, get) => ({
  // 初始状态
  currentProjectDirectory: null,
  layout: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  // 加载项目布局（同步）
  loadLayout: (projectDirectory: string) => {
    const state = get();
    
    // 如果是同一个项目且已初始化，不重复加载
    if (state.currentProjectDirectory === projectDirectory && state.isInitialized) {
      return;
    }

    // 1. 先同步从缓存加载（立即可用，无闪烁）
    const cachedLayout = loadFromCache(projectDirectory);
    
    if (cachedLayout) {
      console.log("[Layout] 从缓存加载布局:", projectDirectory);
      set({
        currentProjectDirectory: projectDirectory,
        layout: cachedLayout,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } else {
      // 没有缓存，使用默认布局
      console.log("[Layout] 使用默认布局:", projectDirectory);
      const defaultLayout = createDefaultLayout(projectDirectory);
      set({
        currentProjectDirectory: projectDirectory,
        layout: defaultLayout,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    }

    // 2. 后台从 Rust 同步最新数据
    invoke<WorkspaceLayout | null>("load_workspace_layout", { projectDirectory })
      .then((rustLayout) => {
        if (rustLayout) {
          const currentState = get();
          // 只有当 Rust 数据更新时才更新（比较 updated_at）
          if (
            currentState.currentProjectDirectory === projectDirectory &&
            (!currentState.layout || rustLayout.updated_at > currentState.layout.updated_at)
          ) {
            console.log("[Layout] 从 Rust 更新布局:", projectDirectory);
            set({ layout: rustLayout });
            // 更新缓存
            saveToCache(rustLayout);
          }
        }
      })
      .catch((e) => {
        console.warn("[Layout] 从 Rust 加载失败（使用缓存）:", e);
      });
  },

  // 立即保存当前布局
  saveLayout: async () => {
    const { layout } = get();
    if (!layout) return;

    cancelPendingSave();
    
    // 保存到缓存
    saveToCache(layout);

    // 保存到 Rust
    try {
      await invoke("save_workspace_layout", { layout });
      console.log("[Layout] 布局已保存");
    } catch (e) {
      console.error("[Layout] 保存布局失败:", e);
      set({ error: e instanceof Error ? e.message : "保存布局失败" });
    }
  },

  // 更新侧边栏宽度
  updateSidebarWidth: (width: number) => {
    const { layout } = get();
    if (!layout) return;

    const updatedLayout = {
      ...layout,
      sidebar_width: width,
      updated_at: Date.now(),
    };
    set({ layout: updatedLayout });
    deferredSave(() => get().layout);
  },

  // 更新编辑器面板比例
  updateEditorPanelRatio: (ratio: number) => {
    const { layout } = get();
    if (!layout) return;

    const updatedLayout = {
      ...layout,
      editor_panel_ratio: ratio,
      updated_at: Date.now(),
    };
    set({ layout: updatedLayout });
    deferredSave(() => get().layout);
  },

  // 更新终端面板高度
  updateTerminalPanelHeight: (height: number) => {
    const { layout } = get();
    if (!layout) return;

    const updatedLayout = {
      ...layout,
      terminal_panel_height: height,
      updated_at: Date.now(),
    };
    set({ layout: updatedLayout });
    deferredSave(() => get().layout);
  },

  // 更新打开的标签页
  updateOpenedTabs: (tabs: OpenedTab[]) => {
    const { layout } = get();
    if (!layout) return;

    const updatedLayout = {
      ...layout,
      opened_tabs: tabs,
      updated_at: Date.now(),
    };
    set({ layout: updatedLayout });
    deferredSave(() => get().layout);
  },

  // 更新活动标签页
  updateActiveTabPath: (path: string | null) => {
    const { layout } = get();
    if (!layout) return;

    const updatedLayout = {
      ...layout,
      active_tab_path: path,
      updated_at: Date.now(),
    };
    set({ layout: updatedLayout });
    deferredSave(() => get().layout);
  },

  // 更新编辑器可见性
  updateEditorVisible: (visible: boolean) => {
    const { layout } = get();
    if (!layout) return;

    const updatedLayout = {
      ...layout,
      editor_visible: visible,
      updated_at: Date.now(),
    };
    set({ layout: updatedLayout });
    deferredSave(() => get().layout);
  },

  // 重置布局为默认值
  resetLayout: () => {
    const { currentProjectDirectory } = get();
    if (!currentProjectDirectory) return;

    const defaultLayout = createDefaultLayout(currentProjectDirectory);
    set({ layout: defaultLayout });
    deferredSave(() => get().layout);
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },
}));

// 页面卸载前保存
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    const { layout } = useLayout.getState();
    if (layout) {
      cancelPendingSave();
      // 同步保存到缓存（立即生效）
      saveToCache(layout);
      // 异步保存到 Rust（尽力而为）
      invoke("save_workspace_layout", { layout }).catch(() => {});
    }
  });
}
