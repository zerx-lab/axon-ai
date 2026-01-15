/**
 * Subagent 面板状态管理
 *
 * 管理右侧 Subagent 面板的显示状态、标签页和活动标签
 */

import { create } from "zustand";

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
}

/** Subagent 面板操作 */
interface SubagentPanelActions {
  /** 打开面板并添加/激活标签 */
  openPanel: (tab: SubagentTab) => void;
  /** 关闭面板 */
  closePanel: () => void;
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
  /** 获取活动标签信息 */
  getActiveTab: () => SubagentTab | null;
  /** 检查标签是否存在 */
  hasTab: (sessionId: string) => boolean;
  /** 重置状态 */
  reset: () => void;
}

type SubagentPanelStore = SubagentPanelState & SubagentPanelActions;

// ============== Store 实现 ==============

const initialState: SubagentPanelState = {
  isOpen: false,
  tabs: [],
  activeTabId: null,
};

export const useSubagentPanelStore = create<SubagentPanelStore>()((set, get) => ({
  ...initialState,

  openPanel: (tab) => {
    set((state) => {
      // 检查标签是否已存在
      const existingTab = state.tabs.find((t) => t.sessionId === tab.sessionId);

      if (existingTab) {
        // 标签已存在，只激活它
        return {
          isOpen: true,
          activeTabId: tab.sessionId,
        };
      }

      // 添加新标签并激活
      return {
        isOpen: true,
        tabs: [...state.tabs, tab],
        activeTabId: tab.sessionId,
      };
    });
  },

  closePanel: () => {
    set({ isOpen: false });
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
}));
