/**
 * Subagent 面板状态管理
 *
 * 管理右侧 Subagent 面板的显示状态、标签页和活动标签
 */

import { create } from "zustand";

// ============== 常量 ==============

/** 图面板折叠状态存储 key */
const GRAPH_COLLAPSED_STORAGE_KEY = "axon-subagent-graph-collapsed";
/** 图面板高度存储 key */
const GRAPH_HEIGHT_STORAGE_KEY = "axon-subagent-graph-height";

/** 图面板最小高度 */
export const GRAPH_MIN_HEIGHT = 120;
/** 图面板最大高度 */
export const GRAPH_MAX_HEIGHT = 400;
/** 图面板默认高度 */
export const GRAPH_DEFAULT_HEIGHT = 200;

// ============== 类型定义 ==============

/** Subagent 状态 */
export type SubagentStatus = "running" | "completed" | "error";

/** Subagent 标签页信息 */
export interface SubagentTab {
  /** 子 session ID */
  sessionId: string;
  /** 父 session ID */
  parentSessionId: string;
  /** 任务描述 */
  description: string;
  /** subagent 类型 (explore/general 等) */
  subagentType: string;
  /** 执行状态 */
  status: SubagentStatus;
  /** 工具调用数量 */
  toolCallCount: number;
  /** 创建时间 */
  createdAt: number;
}

/** Subagent 面板状态 */
interface SubagentPanelState {
  /** 面板是否打开 */
  isOpen: boolean;
  /** 所有标签页 */
  tabs: SubagentTab[];
  /** 当前激活的标签 session ID */
  activeTabId: string | null;
  /** 面板宽度（像素） */
  panelWidth: number;
  /** 图面板是否展开 */
  isGraphExpanded: boolean;
  /** 用户是否手动折叠过图面板（用于控制自动展开逻辑） */
  graphManuallyCollapsed: boolean;
  /** 图面板高度（像素） */
  graphHeight: number;
}

/** Subagent 面板操作 */
interface SubagentPanelActions {
  /** 打开面板并激活指定标签 */
  openPanel: (tab: SubagentTab) => void;
  /** 关闭面板（同时清空所有标签） */
  closePanel: () => void;
  /** 切换面板显示状态 */
  togglePanel: () => void;
  /** 设置面板宽度 */
  setPanelWidth: (width: number) => void;
  /** 
   * 注册 subagent（不打开面板，仅注册到列表）
   * 用于组件挂载时自动收集所有 subagent 信息
   */
  registerSubagent: (tab: SubagentTab) => void;
  /** 添加标签页 */
  addTab: (tab: SubagentTab) => void;
  /** 移除标签页 */
  removeTab: (sessionId: string) => void;
  /** 设置活动标签 */
  setActiveTab: (sessionId: string) => void;
  /** 更新标签状态 */
  updateTabStatus: (
    sessionId: string,
    status: SubagentStatus,
    toolCallCount?: number
  ) => void;
  /** 根据父 session 清除标签 */
  clearTabsByParent: (parentSessionId: string) => void;
  /** 清空所有标签 */
  clearAllTabs: () => void;
  /** 获取活动标签信息 */
  getActiveTab: () => SubagentTab | null;
  /** 检查标签是否存在 */
  hasTab: (sessionId: string) => boolean;
  /** 重置状态 */
  reset: () => void;
  /** 设置图面板展开状态 */
  setGraphExpanded: (expanded: boolean) => void;
  /** 切换图面板展开状态（用户手动操作） */
  toggleGraphExpanded: () => void;
  /** 设置图面板高度 */
  setGraphHeight: (height: number) => void;
}

type SubagentPanelStore = SubagentPanelState & SubagentPanelActions;

// ============== Store 实现 ==============

/** 面板最小宽度 */
export const PANEL_MIN_WIDTH = 360;
/** 面板最大宽度 */
export const PANEL_MAX_WIDTH = 800;
/** 面板默认宽度 */
export const PANEL_DEFAULT_WIDTH = 400;

/** 从 localStorage 读取图面板折叠状态 */
const loadGraphCollapsedState = (): boolean => {
  try {
    const saved = localStorage.getItem(GRAPH_COLLAPSED_STORAGE_KEY);
    return saved === "true";
  } catch {
    return false;
  }
};

/** 保存图面板折叠状态到 localStorage */
const saveGraphCollapsedState = (collapsed: boolean): void => {
  try {
    localStorage.setItem(GRAPH_COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // 忽略存储错误
  }
};

/** 从 localStorage 读取图面板高度 */
const loadGraphHeight = (): number => {
  try {
    const saved = localStorage.getItem(GRAPH_HEIGHT_STORAGE_KEY);
    if (saved) {
      const height = parseInt(saved, 10);
      if (!isNaN(height)) {
        return Math.max(GRAPH_MIN_HEIGHT, Math.min(GRAPH_MAX_HEIGHT, height));
      }
    }
  } catch {
    // 忽略读取错误
  }
  return GRAPH_DEFAULT_HEIGHT;
};

/** 保存图面板高度到 localStorage */
const saveGraphHeight = (height: number): void => {
  try {
    localStorage.setItem(GRAPH_HEIGHT_STORAGE_KEY, String(height));
  } catch {
    // 忽略存储错误
  }
};

const initialState: SubagentPanelState = {
  isOpen: false,
  tabs: [],
  activeTabId: null,
  panelWidth: PANEL_DEFAULT_WIDTH,
  isGraphExpanded: true,
  graphManuallyCollapsed: loadGraphCollapsedState(),
  graphHeight: loadGraphHeight(),
};

export const useSubagentPanelStore = create<SubagentPanelStore>()((set, get) => ({
  ...initialState,

  openPanel: (tab) => {
    set((state) => {
      // 检查标签是否已存在
      const existingTabIndex = state.tabs.findIndex((t) => t.sessionId === tab.sessionId);

      if (existingTabIndex !== -1) {
        // 标签已存在，更新状态并激活
        const updatedTabs = [...state.tabs];
        updatedTabs[existingTabIndex] = {
          ...updatedTabs[existingTabIndex],
          // 更新状态和工具调用数量（使用最新值）
          status: tab.status,
          toolCallCount: tab.toolCallCount,
        };
        return {
          isOpen: true,
          tabs: updatedTabs,
          activeTabId: tab.sessionId,
        };
      }

      // 添加新标签并激活
      // 如果用户没有手动折叠过图面板，则自动展开
      const shouldExpandGraph = !state.graphManuallyCollapsed;
      return {
        isOpen: true,
        tabs: [...state.tabs, tab],
        activeTabId: tab.sessionId,
        isGraphExpanded: shouldExpandGraph ? true : state.isGraphExpanded,
      };
    });
  },

  closePanel: () => {
    // 关闭面板时同时清空所有标签
    set({ isOpen: false, tabs: [], activeTabId: null });
  },

  togglePanel: () => {
    set((state) => {
      // 如果没有标签页，不能打开面板
      if (!state.isOpen && state.tabs.length === 0) {
        return state;
      }
      return { isOpen: !state.isOpen };
    });
  },

  setPanelWidth: (width) => {
    // 确保宽度在允许范围内
    const clampedWidth = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, width));
    set({ panelWidth: clampedWidth });
  },

  registerSubagent: (tab) => {
    set((state) => {
      // 检查是否已存在
      const existingIndex = state.tabs.findIndex((t) => t.sessionId === tab.sessionId);
      
      if (existingIndex !== -1) {
        // 已存在，更新状态
        const updatedTabs = [...state.tabs];
        updatedTabs[existingIndex] = {
          ...updatedTabs[existingIndex],
          status: tab.status,
          toolCallCount: tab.toolCallCount,
        };
        return { tabs: updatedTabs };
      }
      
      // 不存在，添加到列表（但不打开面板，不设置激活）
      return {
        tabs: [...state.tabs, tab],
      };
    });
  },

  addTab: (tab) => {
    set((state) => {
      // 检查是否已存在
      if (state.tabs.some((t) => t.sessionId === tab.sessionId)) {
        return state;
      }
      return {
        tabs: [...state.tabs, tab],
      };
    });
  },

  removeTab: (sessionId) => {
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.sessionId !== sessionId);
      let newActiveTabId = state.activeTabId;

      // 如果移除的是活动标签，切换到下一个
      if (state.activeTabId === sessionId) {
        const removedIndex = state.tabs.findIndex(
          (t) => t.sessionId === sessionId
        );
        if (newTabs.length > 0) {
          // 优先选择下一个，否则选择上一个
          const nextIndex = Math.min(removedIndex, newTabs.length - 1);
          newActiveTabId = newTabs[nextIndex].sessionId;
        } else {
          newActiveTabId = null;
        }
      }

      // 如果没有标签了，关闭面板
      const shouldClose = newTabs.length === 0;

      return {
        tabs: newTabs,
        activeTabId: newActiveTabId,
        isOpen: shouldClose ? false : state.isOpen,
      };
    });
  },

  setActiveTab: (sessionId) => {
    set((state) => {
      // 确保标签存在
      if (!state.tabs.some((t) => t.sessionId === sessionId)) {
        return state;
      }
      return { activeTabId: sessionId };
    });
  },

  updateTabStatus: (sessionId, status, toolCallCount) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.sessionId === sessionId
          ? {
              ...tab,
              status,
              toolCallCount: toolCallCount ?? tab.toolCallCount,
            }
          : tab
      ),
    }));
  },

  clearTabsByParent: (parentSessionId) => {
    set((state) => {
      const newTabs = state.tabs.filter(
        (t) => t.parentSessionId !== parentSessionId
      );
      let newActiveTabId = state.activeTabId;

      // 如果活动标签被移除，重新选择
      if (
        state.activeTabId &&
        !newTabs.some((t) => t.sessionId === state.activeTabId)
      ) {
        newActiveTabId = newTabs.length > 0 ? newTabs[0].sessionId : null;
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveTabId,
        isOpen: newTabs.length > 0 ? state.isOpen : false,
      };
    });
  },

  clearAllTabs: () => {
    // 新会话时重置图面板状态：展开图面板，清除手动折叠标记
    saveGraphCollapsedState(false);
    set({ 
      tabs: [], 
      activeTabId: null, 
      isOpen: false,
      isGraphExpanded: true,
      graphManuallyCollapsed: false,
    });
  },

  getActiveTab: () => {
    const state = get();
    if (!state.activeTabId) return null;
    return state.tabs.find((t) => t.sessionId === state.activeTabId) ?? null;
  },

  hasTab: (sessionId) => {
    return get().tabs.some((t) => t.sessionId === sessionId);
  },

  reset: () => {
    set(initialState);
  },

  setGraphExpanded: (expanded) => {
    set({ isGraphExpanded: expanded });
  },

  toggleGraphExpanded: () => {
    set((state) => {
      const newExpanded = !state.isGraphExpanded;
      // 用户手动折叠时，记录状态并持久化
      if (!newExpanded) {
        saveGraphCollapsedState(true);
        return { 
          isGraphExpanded: false, 
          graphManuallyCollapsed: true,
        };
      }
      // 用户手动展开时，不改变 graphManuallyCollapsed
      // （因为用户可能只是临时查看，下次新会话还是要自动展开）
      return { isGraphExpanded: true };
    });
  },

  setGraphHeight: (height) => {
    // 确保高度在允许范围内
    const clampedHeight = Math.max(GRAPH_MIN_HEIGHT, Math.min(GRAPH_MAX_HEIGHT, height));
    saveGraphHeight(clampedHeight);
    set({ graphHeight: clampedHeight });
  },
}));
