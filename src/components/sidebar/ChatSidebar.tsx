import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Session } from "@/types/chat";
import {
  Plus,
  MessageSquare,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

interface ChatSidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRefresh,
  isRefreshing = false,
  collapsed = false,
  onToggleCollapse,
}: ChatSidebarProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar",
        // 启用 CSS 容器查询
        "@container"
      )}
      // 使用内联样式设置容器类型
      style={{ containerType: "inline-size" }}
    >
      {/* 头部 - 使用容器查询自动切换布局 */}
      <div className="flex h-12 items-center justify-between px-3 border-b border-sidebar-border">
        {/* 展开时显示标题 - 宽度 >= 100px 时显示 */}
        <span 
          className={cn(
            "text-sm font-medium text-sidebar-foreground whitespace-nowrap",
            "hidden @[100px]:block"
          )}
        >
          {t("sidebar.newChat")}
        </span>
        <div className="flex items-center gap-1">
          {/* 刷新按钮 */}
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hidden @[100px]:flex"
              onClick={onRefresh}
              disabled={isRefreshing}
              title={t("sidebar.refresh")}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          )}
          {/* 展开时显示新建按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hidden @[100px]:flex"
            onClick={onNewSession}
            title={t("sidebar.newChat")}
          >
            <Plus className="h-4 w-4" />
          </Button>
          {/* 折叠/展开切换按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onToggleCollapse}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* 折叠视图 - 宽度 < 100px 时显示 */}
      <div className="flex flex-col items-center gap-2 py-3 @[100px]:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onNewSession}
          title={t("sidebar.newChat")}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Separator className="w-6" />
        {sessions.slice(0, 5).map((session) => (
          <Button
            key={session.id}
            variant={session.id === activeSessionId ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => onSelectSession(session.id)}
            title={session.title}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        ))}
      </div>

      {/* 展开视图 - 宽度 >= 100px 时显示 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden hidden @[100px]:block sidebar-scroll-area">
        <div className="flex flex-col gap-1 p-2 pr-3">
          {sessions.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
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
      </div>
    </div>
  );
}

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
            "group flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer transition-colors overflow-hidden",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
          )}
          onClick={onSelect}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-sm">{session.title}</span>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 shrink-0 opacity-0 transition-opacity",
              "group-hover:opacity-100",
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
