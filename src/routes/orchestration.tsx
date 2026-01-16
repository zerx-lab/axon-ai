/**
 * 编排页面路由
 * 
 * 提供多代理工作流的可视化编排功能
 * 使用与首页相同的 ActivityBar + Sidebar 布局结构
 */

import { useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { OrchestrationPage } from "@/components/orchestration/OrchestrationPage";
import { OrchestrationSidebar } from "@/components/orchestration/OrchestrationSidebar";
import { ActivityBar } from "@/components/activitybar";
import { UsagePanel } from "@/components/usage-panel";
import { useActivityBar } from "@/stores/activityBar";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

// 侧边栏面板配置（像素值）
const SIDEBAR_CONFIG = {
  defaultSize: 220, // 编排侧边栏可以稍微窄一点
  minSize: 180,
  maxSize: 320,
};

export const Route = createFileRoute("/orchestration")({
  component: OrchestrationRoute,
});

function OrchestrationRoute() {
  // 活动栏状态
  const { position: activityBarPosition, sidebarVisible } = useActivityBar();

  // 用于从 OrchestrationPage 获取回调函数的引用
  const onAddNodeRef = useRef<((type: string) => void) | null>(null);
  const onNewWorkflowRef = useRef<(() => void) | null>(null);
  const onSaveRef = useRef<(() => void) | null>(null);

  // 包装回调函数，确保引用存在时才调用
  const handleAddNode = useCallback((type: string) => {
    onAddNodeRef.current?.(type);
  }, []);

  const handleNewWorkflow = useCallback(() => {
    onNewWorkflowRef.current?.();
  }, []);

  const handleSave = useCallback(() => {
    onSaveRef.current?.();
  }, []);

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* 主体区域（活动栏 + 内容） */}
      <div className="flex flex-1 overflow-hidden">
        {/* 活动栏 - 左侧位置 */}
        {activityBarPosition === "left" && <ActivityBar />}

        {/* 使用量面板 - 左侧位置（编排页面也可以查看使用量） */}
        {activityBarPosition === "left" && <UsagePanel messages={[]} />}

        {/* 主内容区域 */}
        <div className="flex flex-1 h-full overflow-hidden">
          <ResizablePanelGroup
            orientation="horizontal"
            className="flex-1"
          >
            {/* 活动栏在左侧时：侧边栏在左 */}
            {activityBarPosition === "left" && sidebarVisible && (
              <>
                <ResizablePanel
                  id="orchestration-sidebar"
                  defaultSize={SIDEBAR_CONFIG.defaultSize}
                  minSize={SIDEBAR_CONFIG.minSize}
                  maxSize={SIDEBAR_CONFIG.maxSize}
                >
                  <OrchestrationSidebar
                    onAddNode={handleAddNode}
                    onNewWorkflow={handleNewWorkflow}
                    onSave={handleSave}
                  />
                </ResizablePanel>
                <ResizableHandle withHandle />
              </>
            )}

            {/* 主内容区域 - 编排画布 */}
            <ResizablePanel id="orchestration-main" minSize={sidebarVisible ? "50%" : "100%"}>
              <OrchestrationPage
                onAddNodeRef={onAddNodeRef}
                onNewWorkflowRef={onNewWorkflowRef}
                onSaveRef={onSaveRef}
              />
            </ResizablePanel>

            {/* 活动栏在右侧时：侧边栏在右 */}
            {activityBarPosition === "right" && sidebarVisible && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel
                  id="orchestration-sidebar"
                  defaultSize={SIDEBAR_CONFIG.defaultSize}
                  minSize={SIDEBAR_CONFIG.minSize}
                  maxSize={SIDEBAR_CONFIG.maxSize}
                >
                  <OrchestrationSidebar
                    onAddNode={handleAddNode}
                    onNewWorkflow={handleNewWorkflow}
                    onSave={handleSave}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>

        {/* 使用量面板 - 右侧位置 */}
        {activityBarPosition === "right" && <UsagePanel messages={[]} />}

        {/* 活动栏 - 右侧位置 */}
        {activityBarPosition === "right" && <ActivityBar />}
      </div>
    </div>
  );
}
