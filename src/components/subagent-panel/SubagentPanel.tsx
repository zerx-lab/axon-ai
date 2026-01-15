/**
 * Subagent 面板主组件
 *
 * 右侧面板，显示 subagent 的完整会话内容
 * 支持多标签页切换，支持拖拽调整宽度
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import {
  useSubagentPanelStore,
  PANEL_MIN_WIDTH,
  PANEL_MAX_WIDTH,
} from "@/stores/subagentPanel";
import { useSubagentSession } from "@/hooks/useSubagentSession";
import { useSubagentMessagesStore } from "@/stores/subagentMessages";
import { SubagentTabBar } from "./SubagentTabBar";
import { SubagentPanelHeader } from "./SubagentPanelHeader";
import { SubagentSessionView } from "./SubagentSessionView";
import { SubagentPanelFooter } from "./SubagentPanelFooter";

export function SubagentPanel() {
  const { isOpen, tabs, activeTabId, closePanel, setActiveTab, removeTab, panelWidth, setPanelWidth } =
    useSubagentPanelStore();

  // 获取当前活动标签
  const activeTab = tabs.find((t) => t.sessionId === activeTabId);

  // 获取活动 session 的消息
  const { messages, isLoading, error, reload } = useSubagentSession(
    activeTab?.sessionId ?? null
  );

  // 保存 tabs 引用，用于关闭时清理
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  // 追踪上一次的 isOpen 状态（初始化为 false，确保首次打开时会加载）
  const prevIsOpenRef = useRef(false);

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // 处理拖拽开始
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
  }, [panelWidth]);

  // 处理拖拽移动
  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    // 向左拖动增加宽度，向右拖动减少宽度（因为面板在右侧）
    const deltaX = dragStartX.current - e.clientX;
    const newWidth = dragStartWidth.current + deltaX;

    // 限制宽度范围
    const clampedWidth = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, newWidth));
    setPanelWidth(clampedWidth);
  }, [isDragging, setPanelWidth]);

  // 处理拖拽结束
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleDragMove);
      document.addEventListener("mouseup", handleDragEnd);
      // 防止选中文本
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ew-resize";
    }

    return () => {
      document.removeEventListener("mousemove", handleDragMove);
      document.removeEventListener("mouseup", handleDragEnd);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // 面板打开/关闭时的处理
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (!isOpen) {
      // 面板关闭时清理追踪
      const store = useSubagentMessagesStore.getState();
      // 使用 ref 获取最新的 tabs，避免依赖项变化触发 effect
      tabsRef.current.forEach((tab) => {
        store.untrackSession(tab.sessionId);
      });
    } else if (!wasOpen && isOpen && activeTab?.sessionId) {
      // 面板从关闭变成打开时，重新加载消息
      reload();
    }
  }, [isOpen, activeTab?.sessionId, reload]);

  // 不显示面板
  if (!isOpen || tabs.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        // 布局
        "relative flex flex-col h-full",

        // 背景与边框
        "bg-background",
        "border-l border-border/50",

        // 动画
        "animate-in slide-in-from-right-4 duration-200 ease-out"
      )}
      style={{ width: `${panelWidth}px`, minWidth: `${PANEL_MIN_WIDTH}px` }}
    >
      {/* 左侧拖拽手柄 */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize z-10",
          "hover:bg-primary/30 transition-colors duration-150",
          isDragging && "bg-primary/50"
        )}
        onMouseDown={handleDragStart}
      />

      {/* 标签栏 */}
      <SubagentTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={setActiveTab}
        onTabClose={removeTab}
        onClose={closePanel}
      />

      {/* 面板内容 */}
      {activeTab && (
        <>
          {/* 头部 */}
          <SubagentPanelHeader tab={activeTab} />

          {/* 会话内容 */}
          <SubagentSessionView
            messages={messages}
            isLoading={isLoading}
            error={error}
          />

          {/* 底部统计 */}
          <SubagentPanelFooter
            messages={messages}
            toolCallCount={activeTab.toolCallCount}
          />
        </>
      )}
    </div>
  );
}
