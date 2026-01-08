/**
 * 活动栏组件
 * 
 * 设计哲学：
 * - 极简主义：只保留必要元素，去除视觉噪音
 * - 优雅克制：使用微妙的视觉反馈，不喧宾夺主
 * - 功能导向：图标即功能，无需多余装饰
 */

import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MessageSquare, Settings, PanelLeftClose, PanelLeft } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { useActivityBar, type ActivityId } from "@/stores/activityBar";

// 活动项配置
interface ActivityItem {
  id: ActivityId;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
}

// 活动项列表
const ACTIVITY_ITEMS: ActivityItem[] = [
  {
    id: "chat",
    icon: MessageSquare,
    labelKey: "activityBar.chat",
  },
];

export function ActivityBar() {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const { t } = useTranslation();
  const {
    position,
    activeActivity,
    sidebarVisible,
    togglePosition,
    handleActivityClick,
    toggleSidebarVisible,
  } = useActivityBar();

  // 判断是否在设置页面
  const isSettingsPage = routerState.location.pathname === "/settings";

  // 处理设置按钮点击
  const handleSettingsClick = () => {
    navigate({ to: "/settings" });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "activity-bar flex flex-col items-center h-full",
            "bg-sidebar",
            // 根据位置添加边框 - 使用更细的边框
            position === "left" ? "border-r border-sidebar-border/50" : "border-l border-sidebar-border/50"
          )}
        >
          {/* 顶部活动项区域 */}
          <div className="flex flex-col items-center w-full pt-1">
            {ACTIVITY_ITEMS.map((item) => (
              <ActivityButton
                key={item.id}
                item={item}
                isActive={activeActivity === item.id && sidebarVisible && !isSettingsPage}
                position={position}
                onClick={() => handleActivityClick(item.id)}
              />
            ))}
          </div>

          {/* 底部工具区域 */}
          <div className="mt-auto flex flex-col items-center w-full pb-1">
            {/* 侧边栏切换按钮 */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleSidebarVisible}
                    className={cn(
                      "activity-btn group relative flex items-center justify-center",
                      "w-9 h-9 my-0.5",
                      "text-muted-foreground/70",
                      "hover:text-foreground",
                      "transition-colors duration-150"
                    )}
                  >
                    {sidebarVisible ? (
                      <PanelLeftClose className="w-[18px] h-[18px]" />
                    ) : (
                      <PanelLeft className="w-[18px] h-[18px]" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent 
                  side={position === "left" ? "right" : "left"} 
                  sideOffset={8}
                  className="text-xs"
                >
                  {sidebarVisible 
                    ? t("activityBar.hideSidebar", "隐藏侧边栏") 
                    : t("activityBar.showSidebar", "显示侧边栏")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* 设置按钮 */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleSettingsClick}
                    className={cn(
                      "activity-btn group relative flex items-center justify-center",
                      "w-9 h-9 my-0.5",
                      "text-muted-foreground/70",
                      "hover:text-foreground",
                      "transition-colors duration-150",
                      // 设置页面激活状态
                      isSettingsPage && "text-foreground"
                    )}
                  >
                    <Settings className={cn(
                      "w-[18px] h-[18px]",
                      "transition-transform duration-300 ease-out",
                      "group-hover:rotate-45"
                    )} />
                    {/* 激活指示器 */}
                    {isSettingsPage && (
                      <span
                        className={cn(
                          "absolute w-0.5 rounded-full bg-primary",
                          "top-1.5 bottom-1.5",
                          position === "left" ? "left-0" : "right-0"
                        )}
                      />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent 
                  side={position === "left" ? "right" : "left"} 
                  sideOffset={8}
                  className="text-xs"
                >
                  {t("titlebar.settings")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </ContextMenuTrigger>

      {/* 右键菜单 */}
      <ContextMenuContent>
        <ContextMenuItem onClick={toggleSidebarVisible}>
          {sidebarVisible ? (
            <>
              <PanelLeftClose className="h-3.5 w-3.5" />
              {t("activityBar.hideSidebar", "隐藏侧边栏")}
            </>
          ) : (
            <>
              <PanelLeft className="h-3.5 w-3.5" />
              {t("activityBar.showSidebar", "显示侧边栏")}
            </>
          )}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={togglePosition}>
          {position === "left"
            ? t("activityBar.moveToRight", "移动到右侧")
            : t("activityBar.moveToLeft", "移动到左侧")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// 活动按钮组件
interface ActivityButtonProps {
  item: ActivityItem;
  isActive: boolean;
  position: "left" | "right";
  onClick: () => void;
}

function ActivityButton({
  item,
  isActive,
  position,
  onClick,
}: ActivityButtonProps) {
  const { t } = useTranslation();
  const Icon = item.icon;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "activity-btn group relative flex items-center justify-center",
              "w-9 h-9 my-0.5",
              "transition-colors duration-150",
              // 默认状态 - 柔和的灰色
              "text-muted-foreground/70",
              "hover:text-foreground",
              // 激活状态 - 更强的对比度
              isActive && "text-foreground"
            )}
          >
            <Icon className="w-[18px] h-[18px]" />
            
            {/* 激活指示器 - 优雅的竖线 */}
            {isActive && (
              <span
                className={cn(
                  "absolute w-0.5 rounded-full bg-primary",
                  "top-1.5 bottom-1.5",
                  position === "left" ? "left-0" : "right-0"
                )}
              />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side={position === "left" ? "right" : "left"} 
          sideOffset={8}
          className="text-xs"
        >
          {t(item.labelKey, item.id)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
