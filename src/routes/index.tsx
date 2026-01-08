import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChatContainer } from "@/components/chat";
import { ProjectSidebar } from "@/components/sidebar";
import { ActivityBar } from "@/components/activitybar";
import { useChat } from "@/providers/ChatProvider";
import { useProjectContext } from "@/providers/ProjectProvider";
import { useActivityBar } from "@/stores/activityBar";
import { useTranslation } from "react-i18next";
import { AlertCircle, Wifi, WifiOff } from "lucide-react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import type { PanelImperativeHandle, PanelSize } from "react-resizable-panels";

// 侧边栏面板配置（使用像素值）
const SIDEBAR_CONFIG = {
  defaultSize: 256,   // 默认宽度 256px
  minSize: 180,       // 最小宽度 180px
  maxSize: 400,       // 最大宽度 400px
  collapsedSize: 48,  // 折叠宽度 48px
};

// localStorage 存储键名
const SIDEBAR_STORAGE_KEY = "axon-sidebar-layout";

// 从 localStorage 读取保存的侧边栏大小
function getSavedSidebarSize(): number | null {
  try {
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.size === "number") {
        return parsed.size;
      }
    }
  } catch {
    // 忽略解析错误
  }
  return null;
}

// 保存侧边栏大小到 localStorage
function saveSidebarSize(size: number): void {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify({ size }));
  } catch {
    // 忽略存储错误
  }
}

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const sidebarPanelRef = useRef<PanelImperativeHandle>(null);
  
  // 活动栏状态
  const { position: activityBarPosition, sidebarVisible } = useActivityBar();
  
  // 从 localStorage 获取初始侧边栏大小
  const [initialSidebarSize] = useState(() => {
    const saved = getSavedSidebarSize();
    return saved ?? SIDEBAR_CONFIG.defaultSize;
  });
  
  // 聊天状态
  const {
    sessions,
    activeSession,
    messages,
    isLoading,
    error,
    isConnected,
    providers,
    selectedModel,
    isLoadingModels,
    currentVariants,
    selectedVariant,
    sendMessage,
    stopGeneration,
    createNewSession,
    selectSession,
    deleteSession,
    selectModel,
    selectVariant,
    cycleVariant,
    clearError,
    refreshSessions,
  } = useChat();
  
  // 项目状态
  const {
    closeProject,
    toggleProjectExpanded,
    getProjectsWithSessions,
  } = useProjectContext();
  
  // 计算项目和会话列表
  const projectsWithSessions = useMemo(() => {
    return getProjectsWithSessions(sessions);
  }, [getProjectsWithSessions, sessions]);

  // 处理刷新会话列表
  const handleRefreshSessions = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshSessions();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshSessions]);
  
  // 处理在指定项目下新建会话
  const handleNewSessionInProject = useCallback(async (directory: string) => {
    await createNewSession(directory);
  }, [createNewSession]);

  // 处理关闭项目 - 同时删除该项目下的所有会话
  const handleCloseProject = useCallback(async (projectId: string) => {
    // 先找到该项目下的所有会话
    const projectData = projectsWithSessions.find(
      (p) => p.project.id === projectId
    );
    
    if (!projectData) {
      console.warn("[HomePage] 关闭项目时未找到项目数据:", projectId);
      return;
    }
    
    // 关闭项目
    const result = closeProject(projectId);
    if (!result.success) {
      return;
    }
    
    // 删除该项目下的所有会话
    const sessionsToDelete = projectData.sessions;
    console.log(`[HomePage] 关闭项目 ${result.project?.name}，删除 ${sessionsToDelete.length} 个会话`);
    
    for (const session of sessionsToDelete) {
      try {
        await deleteSession(session.id);
      } catch (e) {
        console.error("[HomePage] 删除会话失败:", session.id, e);
      }
    }
  }, [projectsWithSessions, closeProject, deleteSession]);

  // 切换侧边栏折叠状态
  const handleToggleCollapse = useCallback(() => {
    if (sidebarCollapsed) {
      sidebarPanelRef.current?.expand();
    } else {
      sidebarPanelRef.current?.collapse();
    }
  }, [sidebarCollapsed]);

  // 处理面板大小变化，检测是否折叠并保存到 localStorage
  const handlePanelResize = useCallback((size: PanelSize) => {
    // 当宽度接近折叠宽度时，认为是折叠状态
    const isNowCollapsed = size.inPixels <= SIDEBAR_CONFIG.collapsedSize + 10;
    setSidebarCollapsed(isNowCollapsed);
    
    // 只有非折叠状态时才保存尺寸（避免保存折叠时的小尺寸）
    if (!isNowCollapsed && size.inPixels >= SIDEBAR_CONFIG.minSize) {
      saveSidebarSize(size.inPixels);
    }
  }, []);
  
  // 初始化时恢复折叠状态
  useEffect(() => {
    const saved = getSavedSidebarSize();
    if (saved !== null && saved <= SIDEBAR_CONFIG.collapsedSize + 10) {
      setSidebarCollapsed(true);
    }
  }, []);

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* 活动栏 - 左侧位置 */}
      {activityBarPosition === "left" && <ActivityBar />}

      {/* 主内容区域 */}
      <div className="flex flex-1 h-full overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          {/* 侧边栏面板 - 仅在 sidebarVisible 时显示 */}
          {sidebarVisible && (
            <>
              <ResizablePanel
                id="sidebar"
                panelRef={sidebarPanelRef}
                defaultSize={initialSidebarSize}
                minSize={SIDEBAR_CONFIG.minSize}
                maxSize={SIDEBAR_CONFIG.maxSize}
                collapsible={true}
                collapsedSize={SIDEBAR_CONFIG.collapsedSize}
                onResize={handlePanelResize}
              >
                <ProjectSidebar
                  projectsWithSessions={projectsWithSessions}
                  activeSessionId={activeSession?.id ?? null}
                  onSelectSession={selectSession}
                  onNewSession={handleNewSessionInProject}
                  onDeleteSession={deleteSession}
                  onCloseProject={handleCloseProject}
                  onToggleProjectExpanded={toggleProjectExpanded}
                  onRefresh={handleRefreshSessions}
                  isRefreshing={isRefreshing}
                  collapsed={sidebarCollapsed}
                  onToggleCollapse={handleToggleCollapse}
                />
              </ResizablePanel>

              {/* 拖拽手柄 */}
              <ResizableHandle withHandle />
            </>
          )}

          {/* 主聊天区域面板 */}
          <ResizablePanel id="main" minSize={sidebarVisible ? "50%" : "100%"}>
            <div className="flex flex-1 h-full flex-col overflow-hidden">
              {/* 顶部工具栏 - 简化版本，只显示连接状态 */}
              <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-background/95 backdrop-blur">
                {/* 连接状态指示器 */}
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                      <Wifi className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("settings.serviceSettings.connected")}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <WifiOff className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("chat.connecting")}</span>
                    </div>
                  )}
                </div>

                {/* 占位符，保持布局平衡 */}
                <div />
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="flex items-center gap-2 bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{error}</span>
                  <button
                    onClick={clearError}
                    className="text-xs underline hover:no-underline"
                  >
                    {t("common.close")}
                  </button>
                </div>
              )}

              {/* 聊天容器 */}
              <ChatContainer
                messages={messages}
                onSend={sendMessage}
                onStop={stopGeneration}
                isLoading={isLoading}
                providers={providers}
                selectedModel={selectedModel}
                onSelectModel={selectModel}
                isLoadingModels={isLoadingModels}
                currentVariants={currentVariants}
                selectedVariant={selectedVariant}
                onSelectVariant={selectVariant}
                onCycleVariant={cycleVariant}
                sessions={sessions}
                activeSessionId={activeSession?.id ?? null}
                onSelectSession={selectSession}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* 活动栏 - 右侧位置 */}
      {activityBarPosition === "right" && <ActivityBar />}
    </div>
  );
}
