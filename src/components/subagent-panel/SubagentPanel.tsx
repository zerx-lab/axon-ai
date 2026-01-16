/**
 * Subagent 面板主组件
 *
 * 右侧面板，显示 subagent 的完整会话内容
 * 通过图拓扑视图选择查看任意子代理
 * 支持拖拽调整宽度和图面板高度
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Network, X, Layers } from "lucide-react";
import {
  useSubagentPanelStore,
  PANEL_MIN_WIDTH,
  PANEL_MAX_WIDTH,
  GRAPH_MIN_HEIGHT,
  GRAPH_MAX_HEIGHT,
} from "@/stores/subagentPanel";
import { useSubagentSession } from "@/hooks/useSubagentSession";
import { useSubagentMessagesStore } from "@/stores/subagentMessages";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { SubagentPanelHeader } from "./SubagentPanelHeader";
import { SubagentSessionView } from "./SubagentSessionView";
import { SubagentPanelFooter } from "./SubagentPanelFooter";
import { SubagentGraph } from "./SubagentGraph";

export function SubagentPanel() {
  const { 
    isOpen, 
    tabs, 
    activeTabId, 
    closePanel, 
    panelWidth, 
    setPanelWidth,
    isGraphExpanded,
    toggleGraphExpanded,
    graphHeight,
    setGraphHeight,
  } = useSubagentPanelStore();

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

  // 宽度拖拽状态
  const [isWidthDragging, setIsWidthDragging] = useState(false);
  const widthDragStartX = useRef(0);
  const widthDragStartWidth = useRef(0);

  // 高度拖拽状态
  const [isHeightDragging, setIsHeightDragging] = useState(false);
  const heightDragStartY = useRef(0);
  const heightDragStartHeight = useRef(0);

  // 处理宽度拖拽开始
  const handleWidthDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsWidthDragging(true);
    widthDragStartX.current = e.clientX;
    widthDragStartWidth.current = panelWidth;
  }, [panelWidth]);

  // 处理高度拖拽开始
  const handleHeightDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHeightDragging(true);
    heightDragStartY.current = e.clientY;
    heightDragStartHeight.current = graphHeight;
  }, [graphHeight]);

  // 添加全局鼠标事件监听 - 宽度拖拽
  useEffect(() => {
    if (!isWidthDragging) return;

    const handleMove = (e: MouseEvent) => {
      const deltaX = widthDragStartX.current - e.clientX;
      const newWidth = widthDragStartWidth.current + deltaX;
      const clampedWidth = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, newWidth));
      setPanelWidth(clampedWidth);
    };

    const handleUp = () => {
      setIsWidthDragging(false);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";

    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isWidthDragging, setPanelWidth]);

  // 添加全局鼠标事件监听 - 高度拖拽
  useEffect(() => {
    if (!isHeightDragging) return;

    const handleMove = (e: MouseEvent) => {
      const deltaY = e.clientY - heightDragStartY.current;
      const newHeight = heightDragStartHeight.current + deltaY;
      const clampedHeight = Math.max(GRAPH_MIN_HEIGHT, Math.min(GRAPH_MAX_HEIGHT, newHeight));
      setGraphHeight(clampedHeight);
    };

    const handleUp = () => {
      setIsHeightDragging(false);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";

    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isHeightDragging, setGraphHeight]);

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
  if (!isOpen) {
    return null;
  }

  // 空状态标志
  const isEmpty = tabs.length === 0;

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
          isWidthDragging && "bg-primary/50"
        )}
        onMouseDown={handleWidthDragStart}
      />

      {/* 面板标题栏 */}
      <div
        className={cn(
          "flex items-center h-[32px] px-2 shrink-0",
          "bg-sidebar border-b border-sidebar-border/40"
        )}
      >
        <Network className="h-4 w-4 text-muted-foreground/70 mr-2" />
        <span className="flex-1 text-xs font-medium text-foreground/90">
          Subagent
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-sidebar-accent"
          onClick={closePanel}
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      {/* 空状态 */}
      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-muted/50 mb-4">
            <Layers className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground/80 mb-1">
            暂无子任务
          </p>
          <p className="text-xs text-muted-foreground/70 text-center leading-relaxed">
            当 AI 启动 subagent 执行任务时，<br />
            相关信息将在此处显示
          </p>
        </div>
      ) : (
        <>
          {/* 图拓扑视图折叠面板 */}
          <Collapsible
            open={isGraphExpanded}
            onOpenChange={toggleGraphExpanded}
            className="shrink-0"
          >
            {/* 折叠面板头部 */}
            <CollapsibleTrigger asChild>
              <div
                className={cn(
                  "group flex items-center h-[26px] px-2 cursor-pointer select-none",
                  "bg-sidebar hover:bg-sidebar-accent/50",
                  "border-b border-sidebar-border/40",
                  "transition-colors duration-150"
                )}
              >
                {/* 展开/折叠图标 */}
                <span className="h-5 w-5 flex items-center justify-center shrink-0">
                  {isGraphExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>

                {/* 标题 */}
                <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/90 truncate">
                  调用拓扑
                </span>

                {/* 节点数量 */}
                <span className="text-xs text-muted-foreground/70">
                  {tabs.length}
                </span>
              </div>
            </CollapsibleTrigger>

            {/* 图视图内容 */}
            <CollapsibleContent>
              <div 
                className="relative border-b border-border/40"
                style={{ height: `${graphHeight}px` }}
              >
                <SubagentGraph />
                
                {/* 底部高度拖拽手柄 */}
                <div
                  className={cn(
                    "absolute left-0 right-0 bottom-0 h-1 cursor-ns-resize z-10",
                    "hover:bg-primary/30 transition-colors duration-150",
                    isHeightDragging && "bg-primary/50"
                  )}
                  onMouseDown={handleHeightDragStart}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

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
        </>
      )}
    </div>
  );
}
