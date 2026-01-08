/**
 * 会话搜索弹窗组件
 * 参考 Claude Desktop / shadcn 风格的命令面板设计
 * 支持模糊搜索、键盘导航、快速切换会话
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { MessageSquare, Calendar, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Session } from "@/types/chat";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface SessionSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

/**
 * 格式化时间为相对时间显示
 */
function formatRelativeTime(timestamp: number, t: (key: string) => string): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return t("sidebar.today");
  } else if (days === 1) {
    return t("sidebar.yesterday");
  } else if (days <= 7) {
    return t("sidebar.previous7Days");
  } else if (days <= 30) {
    return t("sidebar.previous30Days");
  } else {
    return t("sidebar.older");
  }
}

/**
 * 按时间分组会话
 */
function groupSessionsByTime(
  sessions: Session[],
  t: (key: string) => string
): Map<string, Session[]> {
  const groups = new Map<string, Session[]>();

  // 按更新时间降序排序
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  for (const session of sorted) {
    const group = formatRelativeTime(session.updatedAt, t);
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(session);
  }

  return groups;
}

/**
 * 创建会话搜索过滤函数
 */
function createSessionFilter(sessions: Session[]) {
  // 构建搜索索引
  const searchIndex = new Map<string, string>();

  for (const session of sessions) {
    // 搜索范围包括：标题、目录路径
    const searchText = `${session.title} ${session.directory}`.toLowerCase();
    searchIndex.set(session.id, searchText);
  }

  return (value: string, search: string): number => {
    if (!search) return 1;

    const searchText = searchIndex.get(value);
    if (!searchText) return 0;

    const searchLower = search.toLowerCase().trim();
    const keywords = searchLower.split(/\s+/).filter(Boolean);

    // 所有关键词都必须匹配
    const allMatch = keywords.every((keyword) => searchText.includes(keyword));
    if (!allMatch) return 0;

    // 计算匹配得分
    let score = 1;
    if (searchText.includes(searchLower)) score += 0.5;
    if (searchText.startsWith(searchLower)) score += 0.3;

    return score;
  };
}

export function SessionSearchDialog({
  open,
  onOpenChange,
  sessions,
  activeSessionId,
  onSelectSession,
}: SessionSearchDialogProps) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");

  // 当弹窗打开时重置搜索
  useEffect(() => {
    if (open) {
      setSearchValue("");
    }
  }, [open]);

  // 创建过滤函数
  const filterFn = useMemo(
    () => createSessionFilter(sessions),
    [sessions]
  );

  // 按时间分组会话
  const groupedSessions = useMemo(
    () => groupSessionsByTime(sessions, t),
    [sessions, t]
  );

  // 处理选择会话
  const handleSelect = useCallback(
    (sessionId: string) => {
      onSelectSession(sessionId);
      onOpenChange(false);
    },
    [onSelectSession, onOpenChange]
  );

  // 格式化目录显示（只显示最后两级路径）
  const formatDirectory = (directory: string): string => {
    if (!directory) return "";
    const parts = directory.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length <= 2) return directory;
    return ".../" + parts.slice(-2).join("/");
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* 自定义遮罩层 - 更轻柔的背景 */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />

        {/* 命令面板内容 - 从上方向下滑入 */}
        <DialogPrimitive.Content
          className={cn(
            // 定位 - 水平居中，垂直位置偏上
            "fixed left-[50%] top-[15%] z-50 translate-x-[-50%]",
            // 尺寸
            "w-[90vw] max-w-[520px]",
            // 样式
            "p-0 overflow-hidden",
            "bg-background border border-border/60 rounded-xl",
            "shadow-2xl shadow-black/25",
            // 动画 - 从上方向下滑入
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-98 data-[state=open]:zoom-in-98",
            "data-[state=closed]:slide-out-to-top-4 data-[state=open]:slide-in-from-top-4",
            "duration-200"
          )}
        >
          {/* 无障碍标题 - 隐藏但保持可访问性 */}
          <VisuallyHidden>
            <DialogPrimitive.Title>
              {t("chat.sessionSearch.title")}
            </DialogPrimitive.Title>
          </VisuallyHidden>

          <Command className="rounded-xl" filter={filterFn}>
            {/* 搜索输入框 */}
            <CommandInput
              value={searchValue}
              onValueChange={setSearchValue}
              placeholder={t("chat.sessionSearch.placeholder")}
            />

            {/* 会话列表 */}
            <CommandList className="max-h-[360px] p-1.5">
              <CommandEmpty className="py-8">
                <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                  <MessageSquare className="h-6 w-6 opacity-50" />
                  <span className="text-sm">{t("chat.sessionSearch.noResults")}</span>
                </div>
              </CommandEmpty>

              {/* 按时间分组显示 */}
              {Array.from(groupedSessions.entries()).map(([group, groupSessions]) => (
                <CommandGroup key={group} heading={group}>
                  {groupSessions.map((session) => {
                    const isActive = session.id === activeSessionId;
                    return (
                      <CommandItem
                        key={session.id}
                        value={session.id}
                        onSelect={handleSelect}
                        className={cn(
                          "flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer",
                          "transition-colors duration-100",
                          isActive && "bg-accent"
                        )}
                      >
                        {/* 图标 */}
                        <div
                          className={cn(
                            "flex items-center justify-center h-7 w-7 rounded-md shrink-0",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </div>

                        {/* 会话信息 */}
                        <div className="flex-1 min-w-0">
                          <span
                            className={cn(
                              "text-sm font-medium truncate block",
                              isActive && "text-foreground"
                            )}
                          >
                            {session.title}
                          </span>
                          {session.directory && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <FolderOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground truncate">
                                {formatDirectory(session.directory)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 时间戳 */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {new Date(session.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>

            {/* 底部提示栏 */}
            <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-border bg-muted/30">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
                    ↑↓
                  </kbd>
                  {t("chat.sessionSearch.navigate")}
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
                    Enter
                  </kbd>
                  {t("chat.sessionSearch.select")}
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
                    Esc
                  </kbd>
                  {t("chat.sessionSearch.close")}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {sessions.length} {t("chat.sessionSearch.sessions")}
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
