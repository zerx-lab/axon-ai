/**
 * 项目侧边栏组件
 * 
 * 以项目为分组展示会话列表
 * - 默认项目始终显示在顶部，不可删除
 * - 其他项目可以删除和展开/折叠
 * - 每个项目右侧有 + 按钮用于新建会话
 */

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Session } from "@/types/chat";
import type { Project } from "@/types/project";
import {
  Plus,
  MessageSquare,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Folder,
  X,
} from "lucide-react";

// ============== 类型定义 ==============

interface ProjectSidebarProps {
  /** 项目列表（带会话） */
  projectsWithSessions: Array<{
    project: Project;
    sessions: Session[];
  }>;
  /** 当前活动会话 ID */
  activeSessionId: string | null;
  /** 选择会话回调 */
  onSelectSession: (sessionId: string) => void;
  /** 在指定项目下新建会话 */
  onNewSession: (directory: string) => void;
  /** 删除会话 */
  onDeleteSession: (sessionId: string) => void;
  /** 关闭项目（从列表移除） */
  onCloseProject?: (projectId: string) => void;
  /** 切换项目展开/折叠 */
  onToggleProjectExpanded?: (projectId: string) => void;
  /** 刷新会话列表 */
  onRefresh?: () => void;
  /** 是否正在刷新 */
  isRefreshing?: boolean;
  /** 是否折叠侧边栏 */
  collapsed?: boolean;
  /** 切换侧边栏折叠 */
  onToggleCollapse?: () => void;
}

// ============== 主组件 ==============

export function ProjectSidebar({
  projectsWithSessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onCloseProject,
  onToggleProjectExpanded,
  onRefresh,
  isRefreshing = false,
  collapsed = false,
  onToggleCollapse,
}: ProjectSidebarProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border/60 bg-sidebar",
        "@container"
      )}
      style={{ containerType: "inline-size" }}
    >
      {/* 头部 - 精致设计 */}
      <div className="flex h-12 items-center justify-between px-3 border-b border-sidebar-border/60">
        <span 
          className={cn(
            "text-sm font-medium text-sidebar-foreground tracking-tight whitespace-nowrap",
            "hidden @[100px]:block"
          )}
        >
          {t("sidebar.projects", "项目")}
        </span>
        <div className="flex items-center gap-0.5">
          {/* 刷新按钮 */}
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg hidden @[100px]:flex hover:bg-sidebar-accent/80"
              onClick={onRefresh}
              disabled={isRefreshing}
              title={t("sidebar.refresh")}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            </Button>
          )}
          {/* 折叠/展开切换按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg hover:bg-sidebar-accent/80"
            onClick={onToggleCollapse}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* 折叠视图 */}
      <div className="flex flex-col items-center gap-2 py-3 @[100px]:hidden">
        {/* 折叠状态下显示项目图标 */}
        {projectsWithSessions.slice(0, 5).map(({ project }) => (
          <Button
            key={project.id}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onNewSession(project.directory)}
            title={project.name}
          >
            <Folder className="h-4 w-4" />
          </Button>
        ))}
      </div>

      {/* 展开视图 - 项目列表 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden hidden @[100px]:block sidebar-scroll-area">
        <div className="flex flex-col gap-1 p-2 pr-3">
          {projectsWithSessions.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              {t("sidebar.noProjects", "暂无项目")}
            </div>
          ) : (
            projectsWithSessions.map(({ project, sessions }) => (
              <ProjectItem
                key={project.id}
                project={project}
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={onSelectSession}
                onNewSession={() => onNewSession(project.directory)}
                onDeleteSession={onDeleteSession}
                onCloseProject={
                  !project.isDefault && onCloseProject
                    ? () => onCloseProject(project.id)
                    : undefined
                }
                onToggleExpanded={
                  onToggleProjectExpanded
                    ? () => onToggleProjectExpanded(project.id)
                    : undefined
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ============== 项目项组件 ==============

interface ProjectItemProps {
  project: Project;
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onCloseProject?: () => void;
  onToggleExpanded?: () => void;
}

function ProjectItem({
  project,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onCloseProject,
  onToggleExpanded,
}: ProjectItemProps) {
  const { t } = useTranslation();

  // 项目头部内容 - 精致设计
  const projectHeader = (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer transition-all duration-150",
        "hover:bg-sidebar-accent/60 text-sidebar-foreground"
      )}
      onClick={onToggleExpanded}
    >
      {/* 展开/折叠图标 */}
      <div className="h-4 w-4 flex items-center justify-center text-muted-foreground">
        {project.expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </div>
      
      {/* 项目图标 */}
      <Folder className={cn(
        "h-4 w-4 shrink-0",
        project.isDefault ? "text-primary" : "text-muted-foreground"
      )} />
      
      {/* 项目名称 */}
      <span className="flex-1 truncate text-sm font-medium">
        {project.name}
      </span>
      
      {/* 会话数量 - 精致徽章 */}
      <span className="text-xs text-muted-foreground/80 bg-sidebar-accent/50 px-1.5 py-0.5 rounded">
        {sessions.length}
      </span>
      
      {/* 新建会话按钮 - 悬浮显示 */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-6 w-6 shrink-0 rounded-md opacity-0 transition-all duration-150",
          "group-hover:opacity-100 hover:bg-sidebar-accent"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onNewSession();
        }}
        title={t("sidebar.newChat")}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col">
      {/* 项目头部 - 非默认项目支持右键菜单关闭 */}
      {onCloseProject ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            {projectHeader}
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              variant="destructive"
              onClick={onCloseProject}
            >
              <X className="h-3.5 w-3.5" />
              {t("sidebar.removeProject", "移除项目")}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ) : (
        projectHeader
      )}

      {/* 会话列表（展开时显示） */}
      {project.expanded && (
        <div className="flex flex-col gap-0.5 pl-6 mt-0.5">
          {sessions.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              {t("sidebar.noChats")}
            </div>
          ) : (
            sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onSelect={() => onSelectSession(session.id)}
                onDelete={() => onDeleteSession(session.id)}
                deleteTitle={t("sidebar.deleteChat")}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============== 会话项组件 ==============

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  deleteTitle: string;
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
  deleteTitle,
}: SessionItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-all duration-150 overflow-hidden",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
              : "hover:bg-sidebar-accent/60 text-sidebar-foreground"
          )}
          onClick={onSelect}
        >
          <MessageSquare className={cn(
            "h-3.5 w-3.5 shrink-0",
            isActive ? "text-primary" : "text-muted-foreground"
          )} />
          <span className="flex-1 truncate text-sm">{session.title}</span>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-5 w-5 shrink-0 rounded opacity-0 transition-all duration-150",
              "group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive",
              isActive && "opacity-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title={deleteTitle}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {session.title}
      </TooltipContent>
    </Tooltip>
  );
}
