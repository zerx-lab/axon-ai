/**
 * Subagent 面板主组件
 *
 * 右侧面板，显示 subagent 的完整会话内容
 * 支持多标签页切换
 */

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useSubagentPanelStore } from "@/stores/subagentPanel";
import { useSubagentSession } from "@/hooks/useSubagentSession";
import { useSubagentMessagesStore } from "@/stores/subagentMessages";
import { SubagentTabBar } from "./SubagentTabBar";
import { SubagentPanelHeader } from "./SubagentPanelHeader";
import { SubagentSessionView } from "./SubagentSessionView";
import { SubagentPanelFooter } from "./SubagentPanelFooter";

export function SubagentPanel() {
  const { isOpen, tabs, activeTabId, closePanel, setActiveTab } =
    useSubagentPanelStore();

  // 获取当前活动标签
  const activeTab = tabs.find((t) => t.sessionId === activeTabId);

  // 获取活动 session 的消息
  const { messages, isLoading, error } = useSubagentSession(
    activeTab?.sessionId ?? null
  );

  // 保存 tabs 引用，用于关闭时清理
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  // 面板关闭时清理追踪
  useEffect(() => {
    if (!isOpen) {
      const store = useSubagentMessagesStore.getState();
      // 使用 ref 获取最新的 tabs，避免依赖项变化触发 effect
      tabsRef.current.forEach((tab) => {
        store.untrackSession(tab.sessionId);
      });
    }
  }, [isOpen]);

  // 不显示面板
  if (!isOpen || tabs.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        // 布局
        "flex flex-col h-full",
        "w-[400px] min-w-[320px] max-w-[35vw]",

        // 背景与边框
        "bg-background",
        "border-l border-border/50",

        // 动画
        "animate-in slide-in-from-right-4 duration-200 ease-out"
      )}
    >
      {/* 标签栏 */}
      <SubagentTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={setActiveTab}
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
