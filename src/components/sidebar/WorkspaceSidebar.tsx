/**
 * 工作区侧边栏组件
 * 
 * VSCode 风格的折叠面板侧边栏，包含：
 * - 会话列表面板：显示当前项目的会话列表
 * - 资源管理器面板：显示当前项目的文件树
 * 
 * 项目切换通过 TitleBar 的 ProjectPicker 进行
 */

import { useState, useCallback, useMemo, useRef } from "react";
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
import { CollapsiblePanel } from "./CollapsiblePanel";
import { FileExplorer } from "./FileExplorer";
import type { Session } from "@/types/chat";
import type { Project } from "@/types/project";
import {
  Plus,
  MessageSquare,
  Trash2,
  RefreshCw,
  Files,
} from "lucide-react";

// ============== 类型定义 ==============

interface WorkspaceSidebarProps {
  /** 当前项目 */
  currentProject: Project | null;
  /** 当前项目的会话列表 */
  sessions: Session[];
  /** 当前活动会话 ID */
  activeSessionId: string | null;
  /** 选择会话回调 */
  onSelectSession: (sessionId: string) => void;
  /** 新建会话 */
  onNewSession: () => void;
  /** 删除会话 */
  onDeleteSession: (sessionId: string) => void;
  /** 刷新会话列表 */
  onRefresh?: () => void;
  /** 是否正在刷新 */
  isRefreshing?: boolean;
  /** 点击文件回调 */
  onFileClick?: (path: string, name: string) => void;
}

// 面板展开状态的 localStorage 键名
const PANEL_STATE_KEY = "axon-sidebar-panels";
const PANEL_RATIO_KEY = "axon-sidebar-panel-ratio";

const DEFAULT_PANEL_STATE = {
  sessions: true,
  explorer: true,
};

const DEFAULT_RATIO = 0.4;
const MIN_RATIO = 0.15;
const MAX_RATIO = 0.85;

// ============== 辅助函数 ==============

function loadPanelState(): typeof DEFAULT_PANEL_STATE {
  try {
    const saved = localStorage.getItem(PANEL_STATE_KEY);
    if (saved) {
      return { ...DEFAULT_PANEL_STATE, ...JSON.parse(saved) };
    }
  } catch {
    // 忽略
  }
  return DEFAULT_PANEL_STATE;
}

function savePanelState(state: typeof DEFAULT_PANEL_STATE) {
  try {
    localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(state));
  } catch {
    // 忽略
  }
}

function loadPanelRatio(): number {
  try {
    const saved = localStorage.getItem(PANEL_RATIO_KEY);
    if (saved) {
      const ratio = parseFloat(saved);
      if (!isNaN(ratio) && ratio >= MIN_RATIO && ratio <= MAX_RATIO) {
        return ratio;
      }
    }
  } catch {
    // 忽略
  }
  return DEFAULT_RATIO;
}

function savePanelRatio(ratio: number) {
  try {
    localStorage.setItem(PANEL_RATIO_KEY, JSON.stringify(ratio));
  } catch {
    // 忽略
  }
}

// ============== 主组件 ==============

export function WorkspaceSidebar({
  currentProject,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRefresh,
  isRefreshing = false,
  onFileClick,
}: WorkspaceSidebarProps) {
  const { t } = useTranslation();
  const [panelState, setPanelState] = useState(loadPanelState);
  const [panelRatio, setPanelRatio] = useState(loadPanelRatio);
  const [explorerKey, setExplorerKey] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const togglePanel = useCallback((panel: keyof typeof DEFAULT_PANEL_STATE) => {
    setPanelState((prev) => {
      const next = { ...prev, [panel]: !prev[panel] };
      savePanelState(next);
      return next;
    });
  }, []);

  const handleRefreshAll = useCallback(() => {
    onRefresh?.();
    setExplorerKey((k) => k + 1);
  }, [onRefresh]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const container = containerRef.current;
    if (!container) return;

    const startY = e.clientY;
    const containerRect = container.getBoundingClientRect();
    const containerHeight = containerRect.height;
    const startRatio = panelRatio;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaRatio = deltaY / containerHeight;
      const newRatio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, startRatio + deltaRatio));
      setPanelRatio(newRatio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      setPanelRatio((currentRatio) => {
        savePanelRatio(currentRatio);
        return currentRatio;
      });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [panelRatio]);

  const panelFlexGrow = useMemo(() => {
    const bothOpen = panelState.sessions && panelState.explorer;
    
    if (!panelState.sessions && !panelState.explorer) {
      return { sessions: 0, explorer: 0 };
    }
    
    if (!bothOpen) {
      return {
        sessions: panelState.sessions ? 1 : 0,
        explorer: panelState.explorer ? 1 : 0,
      };
    }
    
    return {
      sessions: panelRatio,
      explorer: 1 - panelRatio,
    };
  }, [panelState, panelRatio]);

  const showResizeHandle = panelState.sessions && panelState.explorer;

  // 按更新时间排序的会话列表
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [sessions]);

  // 会话面板操作按钮
  const sessionPanelActions = useMemo(() => [
    {
      icon: <Plus className="h-3.5 w-3.5" />,
      tooltip: t("sidebar.newChat", "新对话"),
      onClick: onNewSession,
    },
  ], [t, onNewSession]);

  return (
    <div
      className="flex h-full flex-col border-r border-sidebar-border/60 bg-sidebar"
    >
      {/* 头部 - 简洁设计 */}
      <div className="flex h-10 items-center justify-between px-3 border-b border-sidebar-border/60">
        <span className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/80">
          {currentProject?.name || t("sidebar.workspace", "工作区")}
        </span>
        <div className="flex items-center gap-1">
          {/* 刷新按钮 - 刷新会话和文件列表 */}
          {onRefresh && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded hover:bg-sidebar-accent/80"
                  onClick={handleRefreshAll}
                  disabled={isRefreshing}
                >
                  <RefreshCw
                    className={cn("h-4 w-4", isRefreshing && "animate-spin")}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t("sidebar.refresh", "刷新")}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* 面板列表 */}
      <div ref={containerRef} className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* 会话列表面板 */}
        <CollapsiblePanel
          title={t("sidebar.sessionList", "会话列表")}
          isOpen={panelState.sessions}
          onToggle={() => togglePanel("sessions")}
          count={sessions.length}
          actions={sessionPanelActions}
          flexGrow={panelFlexGrow.sessions}
        >
          <div className="flex flex-col">
            {sortedSessions.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                {t("sidebar.noChats", "暂无对话")}
              </div>
            ) : (
              sortedSessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onSelect={() => onSelectSession(session.id)}
                  onDelete={() => onDeleteSession(session.id)}
                  deleteTitle={t("sidebar.deleteChat", "删除对话")}
                />
              ))
            )}
          </div>
        </CollapsiblePanel>

        {/* 可拖拽分隔条 */}
        {showResizeHandle && (
          <div
            className={cn(
              "h-1 w-full cursor-row-resize shrink-0",
              "bg-sidebar-border/40 hover:bg-primary/30 active:bg-primary/50",
              "transition-colors duration-150",
              isDragging && "bg-primary/50"
            )}
            onMouseDown={handleResizeStart}
          />
        )}

        {/* 资源管理器面板 */}
        <CollapsiblePanel
          title={t("sidebar.explorer", "资源管理器")}
          isOpen={panelState.explorer}
          onToggle={() => togglePanel("explorer")}
          flexGrow={panelFlexGrow.explorer}
        >
          {currentProject ? (
            <FileExplorer
              key={explorerKey}
              rootPath={currentProject.directory}
              rootName={currentProject.name}
              showHidden={false}
              onFileClick={onFileClick}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <Files className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <span className="text-sm text-muted-foreground">
                {t("sidebar.explorerPanel.noProject", "未选择项目")}
              </span>
            </div>
          )}
        </CollapsiblePanel>
      </div>
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
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group flex items-center gap-2 h-[28px] px-2 cursor-pointer",
            "transition-colors duration-100",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "hover:bg-sidebar-accent/60 text-sidebar-foreground"
          )}
          onClick={onSelect}
        >
          <MessageSquare
            className={cn(
              "h-4 w-4 shrink-0",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          />
          <span className="flex-1 truncate text-sm">{session.title}</span>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 shrink-0 rounded opacity-0",
              "group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive",
              "transition-opacity duration-100",
              isActive && "opacity-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title={deleteTitle}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          {deleteTitle}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
