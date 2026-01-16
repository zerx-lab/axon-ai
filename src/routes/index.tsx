import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChatContainer } from "@/components/chat";
import { WorkspaceSidebar } from "@/components/sidebar";
import { FilePreviewPanel } from "@/components/editor";
import { ActivityBar } from "@/components/activitybar";
import { SubagentPanel } from "@/components/subagent-panel";
import { useChat } from "@/providers/ChatProvider";
import { useProjectContext } from "@/providers/ProjectProvider";
import { useActivityBar } from "@/stores/activityBar";
import { useEditor } from "@/stores/editor";
import { useLayout } from "@/stores/layout";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import type { PanelSize } from "react-resizable-panels";
import { normalizeDirectory } from "@/types/project";

// 侧边栏面板配置（像素值）
// react-resizable-panels: 数字 = 像素，字符串如 "15%" = 百分比
const SIDEBAR_CONFIG = {
  defaultSize: 256, // 默认宽度 256px
  minSize: 180, // 最小宽度 180px
  maxSize: 400, // 最大宽度 400px
};

// 编辑器面板配置（百分比字符串）
const EDITOR_PANEL_CONFIG = {
  defaultSize: "50%", // 默认占比 50%（均匀分割）
  minSize: "20%", // 最小占比 20%
};

// 聊天面板配置（像素值）
const CHAT_PANEL_CONFIG = {
  minSize: 460, // 最小宽度 460px
};

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 活动栏状态
  const { position: activityBarPosition, sidebarVisible } = useActivityBar();

  // 编辑器状态
  const {
    isVisible: editorVisible,
    openFile,
    tabs,
    activeTabPath,
    restoreFromLayout,
    getTabsForPersistence,
    closeTab,
  } = useEditor();

  // 布局状态
  const {
    layout,
    isInitialized: layoutInitialized,
    loadLayout,
    updateSidebarWidth,
    updateEditorPanelRatio,
    updateOpenedTabs,
    updateActiveTabPath,
    updateEditorVisible,
    saveLayout,
  } = useLayout();

  // 路由导航
  const navigate = useNavigate();

  // 用于防抖保存的定时器
  const sidebarSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const editorSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 聊天状态
  const {
    sessions,
    activeSession,
    messages,
    isLoading,
    error,
    providers,
    selectedModel,
    isLoadingModels,
    currentVariants,
    selectedVariant,
    agents,
    currentAgent,
    sendMessage,
    sendCommand,
    stopGeneration,
    createNewSession,
    selectSession,
    deleteSession,
    clearAllSessions,
    selectModel,
    selectVariant,
    cycleVariant,
    selectAgent,
    clearError,
    refreshSessions,
  } = useChat();

  // 项目状态
  const { projects, getProjectByDirectory } = useProjectContext();

  const lastActiveSessionDirectoryRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeSession?.directory) {
      lastActiveSessionDirectoryRef.current = activeSession.directory;
    }
  }, [activeSession?.directory]);

  // 获取当前项目 - 优先使用活动会话目录；在删除最后一个会话到新会话创建的间隙，保持上一次目录避免抖动
  const currentProject = useMemo(() => {
    const preferredDirectory =
      activeSession?.directory ?? lastActiveSessionDirectoryRef.current;

    if (preferredDirectory) {
      const project = getProjectByDirectory(preferredDirectory);
      return project || (projects.length > 0 ? projects[0] : null);
    }

    return projects.length > 0 ? projects[0] : null;
  }, [activeSession?.directory, getProjectByDirectory, projects]);

  // 加载项目布局
  const lastLoadedProjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      currentProject &&
      currentProject.directory !== lastLoadedProjectRef.current
    ) {
      lastLoadedProjectRef.current = currentProject.directory;
      loadLayout(currentProject.directory);
    }
  }, [currentProject, loadLayout]);

  // 当布局加载完成后，恢复编辑器状态
  // 使用项目目录作为 key，确保每个项目只恢复一次
  const restoredProjectRef = useRef<string | null>(null);
  useEffect(() => {
    // 只有当布局初始化完成，且是新项目时才恢复
    if (!layoutInitialized || !layout) return;

    const projectDir = layout.project_directory;
    if (restoredProjectRef.current === projectDir) {
      // 已经恢复过这个项目了
      return;
    }

    console.log("[HomePage] 恢复布局:", {
      projectDir,
      openedTabs: layout.opened_tabs?.length,
      activeTabPath: layout.active_tab_path,
      editorVisible: layout.editor_visible,
    });

    // 标记为已恢复
    restoredProjectRef.current = projectDir;

    if (layout.opened_tabs.length > 0) {
      restoreFromLayout(
        layout.opened_tabs,
        layout.active_tab_path,
        layout.editor_visible,
      );
    }
  }, [layoutInitialized, layout, restoreFromLayout]);

  // 同步编辑器状态到布局（当标签页变化时）
  const prevTabsRef = useRef<string>("");
  useEffect(() => {
    if (!layoutInitialized) return;

    const tabsKey = tabs.map((t) => t.path).join("|");
    if (tabsKey !== prevTabsRef.current) {
      prevTabsRef.current = tabsKey;
      updateOpenedTabs(getTabsForPersistence());
      
      if (tabs.length === 0) {
        // 延迟保存，确保 activeTabPath 和 editorVisible 的 effect 先执行完成
        requestAnimationFrame(() => {
          saveLayout();
        });
      }
    }
  }, [tabs, layoutInitialized, updateOpenedTabs, getTabsForPersistence, saveLayout]);

  // 同步活动标签页到布局
  useEffect(() => {
    if (layoutInitialized) {
      updateActiveTabPath(activeTabPath);
    }
  }, [activeTabPath, layoutInitialized, updateActiveTabPath]);

  // 同步编辑器可见性到布局
  useEffect(() => {
    if (layoutInitialized) {
      updateEditorVisible(editorVisible);
    }
  }, [editorVisible, layoutInitialized, updateEditorVisible]);

  // 从布局获取初始值
  // 侧边栏使用像素值（数字会被解释为像素）
  const initialSidebarSize =
    layout?.sidebar_width ?? SIDEBAR_CONFIG.defaultSize;
  // 编辑器使用百分比字符串
  const initialEditorSize = layout?.editor_panel_ratio
    ? `${layout.editor_panel_ratio}%`
    : EDITOR_PANEL_CONFIG.defaultSize;

  // 用于强制 ResizablePanelGroup 重新挂载的 key
  // 只在以下情况触发重新挂载：
  // 1. 布局首次加载完成
  // 2. 项目变化
  // 3. activityBarPosition 变化
  // 不包含 updated_at，避免每次保存都触发刷新
  const layoutKey = useMemo(() => {
    if (!layoutInitialized) return "loading";
    return `${activityBarPosition}-${layout?.project_directory || "default"}`;
  }, [layoutInitialized, activityBarPosition, layout?.project_directory]);

  // 获取当前项目的会话列表
  const currentProjectSessions = useMemo(() => {
    if (!currentProject) return [];

    const projectDir = normalizeDirectory(currentProject.directory);
    return sessions.filter((session) => {
      const sessionDir = normalizeDirectory(session.directory || "");
      return sessionDir === projectDir;
    });
  }, [currentProject, sessions]);

  // 处理刷新会话列表
  const handleRefreshSessions = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshSessions();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshSessions]);

  // 处理新建会话（在当前项目下）
  const handleNewSession = useCallback(async () => {
    if (currentProject) {
      await createNewSession(currentProject.directory);
    }
  }, [currentProject, createNewSession]);

  // 处理清除当前项目所有会话
  const handleClearAllSessions = useCallback(async () => {
    if (currentProject) {
      await clearAllSessions(currentProject.directory);
    }
  }, [currentProject, clearAllSessions]);

  // 处理清空当前会话消息（用于 /clear 命令）
  const handleClearMessages = useCallback(() => {
    // 清空当前会话的消息（通过重新创建会话实现）
    handleNewSession();
  }, [handleNewSession]);

  // 处理打开设置（用于 /settings 命令）
  const handleOpenSettings = useCallback(() => {
    // 导航到设置页面
    navigate({ to: "/settings" });
  }, [navigate]);

  // 监听 Ctrl+N 和 Ctrl+W 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        handleNewSession();
      }
      if (e.ctrlKey && e.key === "w") {
        e.preventDefault();
        if (activeTabPath) {
          closeTab(activeTabPath);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewSession, activeTabPath, closeTab]);

  // 处理文件点击 - 打开文件预览
  const handleFileClick = useCallback(
    (path: string, name: string) => {
      openFile(path, name);
    },
    [openFile],
  );

  // 处理侧边栏尺寸变化（使用 Panel 的 onResize 回调）
  // 防抖 500ms 后保存，避免拖拽过程中频繁更新状态
  const handleSidebarResize = useCallback(
    (size: PanelSize) => {
      // 清除之前的定时器
      if (sidebarSaveTimerRef.current) {
        clearTimeout(sidebarSaveTimerRef.current);
      }
      // 防抖保存
      sidebarSaveTimerRef.current = setTimeout(() => {
        updateSidebarWidth(size.inPixels);
      }, 500);
    },
    [updateSidebarWidth],
  );

  // 处理编辑器面板尺寸变化
  const handleEditorResize = useCallback(
    (size: PanelSize) => {
      // 清除之前的定时器
      if (editorSaveTimerRef.current) {
        clearTimeout(editorSaveTimerRef.current);
      }
      // 防抖保存
      editorSaveTimerRef.current = setTimeout(() => {
        updateEditorPanelRatio(size.asPercentage);
      }, 500);
    },
    [updateEditorPanelRatio],
  );

  // 是否显示分屏（编辑器可见且有打开的文件）
  const showSplitView = editorVisible && tabs.length > 0;

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* 主体区域（活动栏 + 内容） */}
      <div className="flex flex-1 overflow-hidden">
        {/* 活动栏 - 左侧位置 */}
        {activityBarPosition === "left" && <ActivityBar />}

        {/* 主内容区域 */}
        <div className="flex flex-1 h-full overflow-hidden">
          <ResizablePanelGroup
            key={layoutKey}
            orientation="horizontal"
            className="flex-1"
          >
            {/* 活动栏在左侧时：侧边栏在左 */}
            {activityBarPosition === "left" && sidebarVisible && (
              <>
                <ResizablePanel
                  id="sidebar"
                  defaultSize={initialSidebarSize}
                  minSize={SIDEBAR_CONFIG.minSize}
                  maxSize={SIDEBAR_CONFIG.maxSize}
                  onResize={handleSidebarResize}
                >
                  <WorkspaceSidebar
                    currentProject={currentProject}
                    sessions={currentProjectSessions}
                    activeSessionId={activeSession?.id ?? null}
                    onSelectSession={selectSession}
                    onNewSession={handleNewSession}
                    onDeleteSession={deleteSession}
                    onClearAll={handleClearAllSessions}
                    onRefresh={handleRefreshSessions}
                    isRefreshing={isRefreshing}
                    onFileClick={handleFileClick}
                    activeFilePath={activeTabPath}
                  />
                </ResizablePanel>
                <ResizableHandle withHandle />
              </>
            )}

            {/* 主内容区域面板 - 包含聊天和/或编辑器 */}
            <ResizablePanel id="main" minSize={sidebarVisible ? "50%" : "100%"}>
              {showSplitView ? (
                // 分屏模式：编辑器 + 聊天（默认均匀分割 50%）
                <ResizablePanelGroup
                  key={`editor-${layoutKey}`}
                  orientation="horizontal"
                >
                  {/* 编辑器面板 */}
                  <ResizablePanel
                    id="editor"
                    defaultSize={initialEditorSize}
                    minSize={EDITOR_PANEL_CONFIG.minSize}
                    onResize={handleEditorResize}
                  >
                    <FilePreviewPanel />
                  </ResizablePanel>

                  {/* 拖拽手柄 */}
                  <ResizableHandle withHandle />

                  {/* 聊天面板 */}
                  <ResizablePanel
                    id="chat"
                    minSize={`${CHAT_PANEL_CONFIG.minSize}px`}
                  >
                    <div className="flex flex-1 h-full flex-col overflow-hidden">
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
                        onSendCommand={sendCommand}
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
                        agents={agents}
                        currentAgent={currentAgent}
                        onSelectAgent={selectAgent}
                        sessions={sessions}
                        activeSessionId={activeSession?.id ?? null}
                        onSelectSession={selectSession}
                        onClearMessages={handleClearMessages}
                        onNewSession={handleNewSession}
                        onOpenSettings={handleOpenSettings}
                        projectPath={currentProject?.directory}
                      />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                // 单面板模式：仅聊天
                <div className="flex flex-1 h-full flex-col overflow-hidden">
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
                    onSendCommand={sendCommand}
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
                    agents={agents}
                    currentAgent={currentAgent}
                    onSelectAgent={selectAgent}
                    sessions={sessions}
                    activeSessionId={activeSession?.id ?? null}
                    onSelectSession={selectSession}
                    onClearMessages={handleClearMessages}
                    onNewSession={handleNewSession}
                    onOpenSettings={handleOpenSettings}
                    projectPath={currentProject?.directory}
                  />
                </div>
              )}
            </ResizablePanel>

            {/* 活动栏在右侧时：侧边栏在右 */}
            {activityBarPosition === "right" && sidebarVisible && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel
                  id="sidebar"
                  defaultSize={initialSidebarSize}
                  minSize={SIDEBAR_CONFIG.minSize}
                  maxSize={SIDEBAR_CONFIG.maxSize}
                  onResize={handleSidebarResize}
                >
                  <WorkspaceSidebar
                    currentProject={currentProject}
                    sessions={currentProjectSessions}
                    activeSessionId={activeSession?.id ?? null}
                    onSelectSession={selectSession}
                    onNewSession={handleNewSession}
                    onDeleteSession={deleteSession}
                    onClearAll={handleClearAllSessions}
                    onRefresh={handleRefreshSessions}
                    isRefreshing={isRefreshing}
                    onFileClick={handleFileClick}
                    activeFilePath={activeTabPath}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>

          {/* Subagent 面板 - 右侧固定宽度 */}
          <SubagentPanel />
        </div>

        {/* 活动栏 - 右侧位置 */}
        {activityBarPosition === "right" && <ActivityBar />}
      </div>

    </div>
  );
}
