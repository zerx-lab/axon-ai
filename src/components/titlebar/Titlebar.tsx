/**
 * Custom titlebar component
 * Zed-style minimal design with drag region
 * 自定义标题栏组件 - Zed 风格极简设计
 * 
 * 中间区域为 VSCode 风格的项目选择器触发器
 */

import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, ChevronDown, PanelRight } from "lucide-react";
import { toast } from "sonner";
import { WindowControls } from "./WindowControls";
import { ThemeToggle } from "./ThemeToggle";
import { ServiceStatus } from "./ServiceStatus";
import { ProjectPicker } from "./ProjectPicker";
import { AxonLogo } from "@/components/icons";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChat } from "@/providers/ChatProvider";
import { useWorkspace } from "@/stores/workspace";
import { useProjectContext } from "@/providers/ProjectProvider";
import { useSubagentPanelStore } from "@/stores/subagentPanel";
import { useOpencode } from "@/hooks";
import { settings as tauriSettings } from "@/services/tauri";
import { cn } from "@/lib/utils";

export function Titlebar() {
  const { t } = useTranslation();
  const { activeSession, createNewSession, refreshAgents } = useChat();
  const { getDisplayPath, state: workspaceState, openDirectoryPicker } = useWorkspace();
  const { projects, openProject } = useProjectContext();
  const { isOpen: isPanelOpen, tabs: panelTabs, togglePanel } = useSubagentPanelStore();
  const { restartBackend } = useOpencode();

  // 项目选择器状态
  const [pickerOpen, setPickerOpen] = useState(false);

  // 是否有可显示的 subagent 标签
  const hasSubagentTabs = panelTabs.length > 0;

  // 获取当前会话的目录显示名称
  const currentDirectory = activeSession?.directory || workspaceState.defaultDirectory;
  const directoryDisplayName = currentDirectory ? getDisplayPath(currentDirectory) : t("titlebar.default");

  // 处理打开项目选择器
  const handleOpenPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);

  // 监听 Ctrl+O 快捷键打开项目选择器
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        setPickerOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 处理选择项目
  const handleSelectProject = useCallback(async (directory: string) => {
    // 添加项目到列表（如果还未添加）
    openProject(directory);

    // 获取当前保存的项目目录
    const currentProjectDir = await tauriSettings.getProjectDirectory();

    // 如果切换到不同目录，更新后端设置并重启服务
    if (currentProjectDir !== directory) {
      try {
        // 更新后端的项目目录设置
        await tauriSettings.setProjectDirectory(directory);
        toast.info(t("titlebar.switchingProject"));

        // 重启服务以应用新的工作目录
        await restartBackend();

        // 刷新 agents 列表（新目录可能有自定义 agent）
        if (refreshAgents) {
          await refreshAgents();
        }

        toast.success(t("titlebar.projectSwitched"));
      } catch (error) {
        console.error("切换项目目录失败:", error);
        toast.error(t("errors.unknownError"));
      }
    }

    // 在该目录下创建新会话
    await createNewSession(directory);
  }, [openProject, createNewSession, restartBackend, refreshAgents, t]);

  // 处理打开目录选择器
  const handleOpenDirectoryPicker = useCallback(async () => {
    const directory = await openDirectoryPicker();
    if (directory) {
      // 使用 handleSelectProject 统一处理项目切换逻辑
      await handleSelectProject(directory);
    }
  }, [openDirectoryPicker, handleSelectProject]);

  return (
    <>
      <header className="flex h-9 shrink-0 select-none items-center border-b border-border bg-surface-1">
        {/* 左侧 - 应用标题 + 项目选择器 */}
        <div
          data-tauri-drag-region
          className="flex h-full items-center gap-2 px-3"
        >
          <AxonLogo size={18} className="text-foreground" />
          
          {/* 项目选择器触发器 (VSCode 风格) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleOpenPicker}
                  className={cn(
                    "group flex items-center gap-1.5 px-3 py-1 rounded-md",
                    "text-xs text-muted-foreground",
                    "hover:bg-accent hover:text-foreground",
                    "focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1",
                    "transition-colors duration-150",
                    "cursor-pointer select-none"
                  )}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span className="max-w-[200px] truncate font-medium">
                    {directoryDisplayName}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs">{currentDirectory || t("titlebar.defaultWorkspace")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("projectPicker.clickToSwitch", "点击切换项目")} (Ctrl+O)
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* 中间 - 拖拽区域 */}
        <div data-tauri-drag-region className="flex-1 h-full" />

        {/* 右侧 - 控制按钮 */}
        <div className="flex h-full items-center">
          {/* 服务状态指示器 */}
          <ServiceStatus />

          <Separator orientation="vertical" className="mx-1 h-4" />

          <div className="flex items-center gap-1 px-2">
            {/* Subagent 面板切换按钮 */}
            {hasSubagentTabs && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={togglePanel}
                      className={cn(
                        "flex items-center justify-center w-7 h-7 rounded-md",
                        "text-muted-foreground hover:text-foreground",
                        "hover:bg-accent transition-colors duration-150",
                        isPanelOpen && "text-foreground bg-accent"
                      )}
                    >
                      <PanelRight className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">
                      {isPanelOpen ? t("titlebar.hideSubagentPanel", "隐藏子任务面板") : t("titlebar.showSubagentPanel", "显示子任务面板")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <ThemeToggle />
          </div>
          <WindowControls />
        </div>
      </header>

      {/* 项目选择器弹窗 */}
      <ProjectPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        projects={projects}
        currentDirectory={currentDirectory}
        onSelectProject={handleSelectProject}
        onOpenDirectoryPicker={handleOpenDirectoryPicker}
      />
    </>
  );
}
