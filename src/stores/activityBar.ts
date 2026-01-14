/**
 * 活动栏状态管理
 * 
 * 管理活动栏的位置（左侧/右侧）和当前选中的活动项
 * 类似 VSCode 的活动栏功能
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// 活动栏位置
export type ActivityBarPosition = "left" | "right";

// 活动项类型
export type ActivityId = "chat" | "search" | "extensions" | "terminal";

interface ActivityBarState {
  // 活动栏位置（左侧或右侧）
  position: ActivityBarPosition;
  // 当前激活的活动项
  activeActivity: ActivityId;
  // 侧边栏是否可见（点击同一个活动项可以切换显示/隐藏）
  sidebarVisible: boolean;
}

interface ActivityBarActions {
  // 设置活动栏位置
  setPosition: (position: ActivityBarPosition) => void;
  // 切换活动栏位置（左右互换）
  togglePosition: () => void;
  // 设置当前激活的活动项
  setActiveActivity: (activity: ActivityId) => void;
  // 切换侧边栏可见性
  toggleSidebarVisible: () => void;
  // 处理活动项点击（如果点击当前激活项则切换侧边栏可见性）
  handleActivityClick: (activity: ActivityId) => void;
}

type ActivityBarStore = ActivityBarState & ActivityBarActions;

// localStorage 存储键名
const ACTIVITY_BAR_STORAGE_KEY = "axon-activity-bar";

export const useActivityBar = create<ActivityBarStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      position: "left",
      activeActivity: "chat",
      sidebarVisible: true,

      // 设置位置
      setPosition: (position) => set({ position }),

      // 切换位置
      togglePosition: () =>
        set((state) => ({
          position: state.position === "left" ? "right" : "left",
        })),

      // 设置激活的活动项
      setActiveActivity: (activity) =>
        set({ activeActivity: activity, sidebarVisible: true }),

      // 切换侧边栏可见性
      toggleSidebarVisible: () =>
        set((state) => ({ sidebarVisible: !state.sidebarVisible })),

      // 处理活动项点击
      handleActivityClick: (activity) => {
        const { activeActivity, sidebarVisible } = get();
        if (activity === activeActivity) {
          // 点击当前激活项，切换侧边栏可见性
          set({ sidebarVisible: !sidebarVisible });
        } else {
          // 点击其他项，切换到该项并显示侧边栏
          set({ activeActivity: activity, sidebarVisible: true });
        }
      },
    }),
    {
      name: ACTIVITY_BAR_STORAGE_KEY,
      partialize: (state) => ({
        position: state.position,
        activeActivity: state.activeActivity,
        sidebarVisible: state.sidebarVisible,
      }),
    }
  )
);
