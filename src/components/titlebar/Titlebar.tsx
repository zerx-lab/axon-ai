/**
 * Custom titlebar component
 * Zed-style minimal design with drag region
 * 自定义标题栏组件 - Zed 风格极简设计
 */

import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";
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

interface TitlebarProps {
  title?: string;
}

export function Titlebar({ title = "Axon" }: TitlebarProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSettingsClick = () => {
    navigate({ to: "/settings" });
  };

  return (
    <header className="flex h-9 shrink-0 select-none items-center border-b border-border bg-surface-1">
      {/* 左侧 - 应用标题 */}
      <div
        data-tauri-drag-region
        className="flex h-full items-center gap-2 px-3"
      >
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>

      {/* 中间 - 可拖拽区域 */}
      <div data-tauri-drag-region className="flex-1 h-full" />

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
