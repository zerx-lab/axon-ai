/**
 * 可折叠面板组件
 * 
 * VSCode 风格的可折叠区域，用于侧边栏中的各个功能区块
 * - 支持展开/折叠
 * - 标题栏带有操作按钮
 */

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

// ============== 类型定义 ==============

export interface PanelAction {
  /** 操作图标 */
  icon: ReactNode;
  /** 操作提示 */
  tooltip: string;
  /** 点击回调 */
  onClick: () => void;
  /** 是否禁用 */
  disabled?: boolean;
}

export interface ContextMenuAction {
  /** 菜单项标签 */
  label: string;
  /** 菜单项图标 */
  icon?: ReactNode;
  /** 点击回调 */
  onClick: () => void;
  /** 是否为破坏性操作 */
  destructive?: boolean;
}

export interface CollapsiblePanelProps {
  /** 面板标题 */
  title: string;
  /** 是否展开 */
  isOpen: boolean;
  /** 展开/折叠切换回调 */
  onToggle: () => void;
  /** 面板内容 */
  children: ReactNode;
  /** 标题栏操作按钮（悬浮时显示） */
  actions?: PanelAction[];
  /** 右键菜单操作 */
  contextMenuActions?: ContextMenuAction[];
  /** 内容区域类名 */
  contentClassName?: string;
  /** 是否显示项目数量徽章 */
  count?: number;
  /** 
   * 面板的 flex 占比
   * - 0: 不占空间（折叠状态）
   * - 1: 均匀分配空间
   * - 其他值: 相对占比
   */
  flexGrow?: number;
}

// ============== 主组件 ==============

export function CollapsiblePanel({
  title,
  isOpen,
  onToggle,
  children,
  actions,
  contextMenuActions,
  contentClassName,
  count,
  flexGrow = 0,
}: CollapsiblePanelProps) {
  // 面板头部内容
  const panelHeader = (
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
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </span>

        {/* 标题 */}
        <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/90 truncate">
          {title}
        </span>

        {/* 数量徽章 */}
        {count !== undefined && count > 0 && (
          <span className="text-xs text-muted-foreground/70 mr-1">
            {count}
          </span>
        )}

        {/* 操作按钮组 - 悬浮显示 */}
        {actions && actions.length > 0 && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {actions.map((action, index) => (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 p-0 hover:bg-sidebar-accent"
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick();
                    }}
                    disabled={action.disabled}
                  >
                    {action.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  <span className="text-xs">{action.tooltip}</span>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </CollapsibleTrigger>
  );

  return (
    <Collapsible 
      open={isOpen} 
      onOpenChange={onToggle} 
      className="flex flex-col min-h-0"
      style={{ 
        flexGrow: isOpen ? flexGrow : 0,
        flexShrink: isOpen ? 1 : 0,
        flexBasis: 'auto',
      }}
    >
      {/* 带右键菜单的头部 */}
      {contextMenuActions && contextMenuActions.length > 0 ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>{panelHeader}</ContextMenuTrigger>
          <ContextMenuContent>
            {contextMenuActions.map((action, index) => (
              <ContextMenuItem
                key={index}
                onClick={action.onClick}
                className={cn(
                  "text-xs",
                  action.destructive && "text-destructive"
                )}
              >
                {action.icon && <span className="mr-2">{action.icon}</span>}
                {action.label}
              </ContextMenuItem>
            ))}
          </ContextMenuContent>
        </ContextMenu>
      ) : (
        panelHeader
      )}

      {/* 内容区域 */}
      <CollapsibleContent className="flex-1 min-h-0 overflow-hidden">
        <div className={cn("h-full overflow-y-auto overflow-x-hidden sidebar-scroll-area", contentClassName)}>
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
