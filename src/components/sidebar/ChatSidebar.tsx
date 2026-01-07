import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Session } from "@/types/chat";
import {
  Plus,
  MessageSquare,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface ChatSidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  collapsed = false,
  onToggleCollapse,
}: ChatSidebarProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
        collapsed ? "w-12" : "w-64"
      )}
    >
      {/* 头部 */}
      <div className="flex h-12 items-center justify-between px-3 border-b border-sidebar-border">
        {!collapsed && (
          <span className="text-sm font-medium text-sidebar-foreground">
            {t("sidebar.newChat").replace("新", "对话")}
          </span>
        )}
        <div className="flex items-center gap-1">
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onNewSession}
              title={t("sidebar.newChat")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
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

      {/* 折叠状态 - 只显示图标 */}
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 py-3">
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
      ) : (
        <>
          {/* 会话列表 */}
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-1 p-2">
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
          </ScrollArea>
        </>
      )}
    </div>
  );
}

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  deleteTitle?: string;
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
  deleteTitle = "Delete chat",
}: SessionItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer transition-colors",
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
  );
}

// Format date for display (reserved for future use)
// function formatDate(timestamp: number): string {
//   const date = new Date(timestamp);
//   const now = new Date();
//   const diff = now.getTime() - date.getTime();
//   const days = Math.floor(diff / (1000 * 60 * 60 * 24));
//   if (days === 0) return "Today";
//   if (days === 1) return "Yesterday";
//   if (days < 7) return `${days} days ago`;
//   return date.toLocaleDateString();
// }
