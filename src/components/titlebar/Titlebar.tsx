/**
 * Custom titlebar component
 * Zed-style minimal design with drag region
 * 自定义标题栏组件 - Zed 风格极简设计
 */

import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Settings, FolderOpen } from "lucide-react";
import { WindowControls } from "./WindowControls";
import { ThemeToggle } from "./ThemeToggle";
import { ServiceStatus } from "./ServiceStatus";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChat } from "@/providers/ChatProvider";
import { useWorkspace } from "@/stores/workspace";

interface TitlebarProps {
  title?: string;
}

export function Titlebar({ title = "Axon" }: TitlebarProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeSession } = useChat();
  const { getDisplayPath, state: workspaceState } = useWorkspace();

  const handleSettingsClick = () => {
    navigate({ to: "/settings" });
  };

  // 获取当前会话的目录显示名称
  const currentDirectory = activeSession?.directory || workspaceState.defaultDirectory;
  const directoryDisplayName = currentDirectory ? getDisplayPath(currentDirectory) : t("titlebar.default");
  
  // 调试日志
  console.log("[Titlebar] activeSession:", activeSession);
  console.log("[Titlebar] activeSession?.directory:", activeSession?.directory);
  console.log("[Titlebar] workspaceState.defaultDirectory:", workspaceState.defaultDirectory);
  console.log("[Titlebar] currentDirectory:", currentDirectory);

  return (
    <header className="flex h-9 shrink-0 select-none items-center border-b border-border bg-surface-1">
      {/* 左侧 - 应用标题 */}
      <div
        data-tauri-drag-region
        className="flex h-full items-center gap-2 px-3"
      >
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>

      {/* 中间 - 当前工作目录 + 可拖拽区域 */}
      <div data-tauri-drag-region className="flex-1 h-full flex items-center justify-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground transition-colors cursor-default">
                <FolderOpen className="h-3.5 w-3.5" />
                <span className="max-w-[200px] truncate">{directoryDisplayName}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{currentDirectory || t("titlebar.defaultWorkspace")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* 右侧 - 控制按钮 */}
      <div className="flex h-full items-center">
        {/* 服务状态指示器 */}
        <ServiceStatus />
        
        <Separator orientation="vertical" className="mx-1 h-4" />
        
        <div className="flex items-center gap-1 px-2">
          <ThemeToggle />
          
          {/* 设置按钮 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleSettingsClick}
                  className="h-7 w-7"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{t("titlebar.settings")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <WindowControls />
      </div>
    </header>
  );
}
