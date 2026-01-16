/**
 * 使用量面板状态管理
 *
 * 管理左侧使用量面板的显示状态
 * 显示当前会话中每条消息的 token 使用量和费用统计
 */

import { create } from "zustand";

// ============== 常量 ==============

/** 面板宽度存储 key */
const PANEL_WIDTH_STORAGE_KEY = "axon-usage-panel-width";

/** 面板最小宽度 */
export const USAGE_PANEL_MIN_WIDTH = 280;
/** 面板最大宽度 */
export const USAGE_PANEL_MAX_WIDTH = 500;
/** 面板默认宽度 */
export const USAGE_PANEL_DEFAULT_WIDTH = 320;

// ============== 类型定义 ==============

/** 使用量面板状态 */
interface UsagePanelState {
  /** 面板是否打开 */
  isOpen: boolean;
  /** 面板宽度（像素） */
  panelWidth: number;
}

/** 使用量面板操作 */
interface UsagePanelActions {
  /** 打开面板 */
  openPanel: () => void;
  /** 关闭面板 */
  closePanel: () => void;
  /** 切换面板显示状态 */
  togglePanel: () => void;
  /** 设置面板宽度 */
  setPanelWidth: (width: number) => void;
}

type UsagePanelStore = UsagePanelState & UsagePanelActions;

// ============== 辅助函数 ==============

/** 从 localStorage 读取面板宽度 */
const loadPanelWidth = (): number => {
  try {
    const saved = localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
    if (saved) {
      const width = parseInt(saved, 10);
      if (!isNaN(width)) {
        return Math.max(
          USAGE_PANEL_MIN_WIDTH,
          Math.min(USAGE_PANEL_MAX_WIDTH, width)
        );
      }
    }
  } catch {
    // 忽略读取错误
  }
  return USAGE_PANEL_DEFAULT_WIDTH;
};

/** 保存面板宽度到 localStorage */
const savePanelWidth = (width: number): void => {
  try {
    localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // 忽略存储错误
  }
};

// ============== Store 实现 ==============

const initialState: UsagePanelState = {
  isOpen: false,
  panelWidth: loadPanelWidth(),
};

export const useUsagePanelStore = create<UsagePanelStore>()((set) => ({
  ...initialState,

  openPanel: () => {
    set({ isOpen: true });
  },

  closePanel: () => {
    set({ isOpen: false });
  },

  togglePanel: () => {
    set((state) => ({ isOpen: !state.isOpen }));
  },

  setPanelWidth: (width) => {
    // 确保宽度在允许范围内
    const clampedWidth = Math.max(
      USAGE_PANEL_MIN_WIDTH,
      Math.min(USAGE_PANEL_MAX_WIDTH, width)
    );
    savePanelWidth(clampedWidth);
    set({ panelWidth: clampedWidth });
  },
}));
