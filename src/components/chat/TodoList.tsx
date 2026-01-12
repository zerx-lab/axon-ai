/**
 * 任务列表组件
 * 
 * 显示 Agent 的工作计划，位于聊天输入框上方
 * 参考 Cursor 风格的任务列表设计
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader2,
  ListTodo,
  XCircle,
} from "lucide-react";
import { useTodoStore } from "@/stores/todo";
import type { TodoItem, TodoStatus } from "@/types/chat";

// ============== 任务状态图标 ==============

interface TodoStatusIconProps {
  status: TodoStatus;
  className?: string;
}

function TodoStatusIcon({ status, className }: TodoStatusIconProps) {
  switch (status) {
    case "completed":
      return (
        <CheckCircle2 
          className={cn("h-3.5 w-3.5 text-green-500", className)} 
        />
      );
    case "in_progress":
      return (
        <Loader2 
          className={cn("h-3.5 w-3.5 text-blue-500 animate-spin", className)} 
        />
      );
    case "cancelled":
      return (
        <XCircle 
          className={cn("h-3.5 w-3.5 text-muted-foreground/50", className)} 
        />
      );
    case "pending":
    default:
      return (
        <Circle 
          className={cn("h-3.5 w-3.5 text-muted-foreground/60", className)} 
        />
      );
  }
}

// ============== 单个任务项 ==============

interface TodoItemViewProps {
  todo: TodoItem;
}

function TodoItemView({ todo }: TodoItemViewProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 py-1.5 px-2 rounded-md",
        "transition-colors duration-150",
        todo.status === "in_progress" && "bg-blue-500/5",
        todo.status === "completed" && "opacity-60"
      )}
    >
      <TodoStatusIcon status={todo.status} className="mt-0.5 shrink-0" />
      <span
        className={cn(
          "text-xs leading-relaxed",
          todo.status === "completed" && "line-through text-muted-foreground",
          todo.status === "cancelled" && "line-through text-muted-foreground/50",
          todo.status === "in_progress" && "text-foreground font-medium"
        )}
      >
        {todo.content}
      </span>
    </div>
  );
}

// ============== 任务列表组件 ==============

interface TodoListProps {
  sessionId: string;
  className?: string;
  /** 默认是否展开 */
  defaultOpen?: boolean;
  /** 最大显示任务数（折叠时） */
  maxVisibleItems?: number;
}

/**
 * 任务列表组件
 * 显示当前会话的任务计划
 */
export function TodoList({
  sessionId,
  className,
  defaultOpen = false,
  maxVisibleItems = 3,
}: TodoListProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  // 直接选择状态，避免在选择器中调用方法导致无限循环
  const allTodos = useTodoStore((s) => s.todos);
  const todos = useMemo(() => allTodos[sessionId] || [], [allTodos, sessionId]);

  // 计算统计信息
  const stats = useMemo(() => {
    const total = todos.length;
    const pending = todos.filter((t) => t.status === "pending").length;
    const inProgress = todos.filter((t) => t.status === "in_progress").length;
    const completed = todos.filter((t) => t.status === "completed").length;
    return { total, pending, inProgress, completed };
  }, [todos]);

  // 获取显示的任务列表
  const visibleTodos = useMemo(() => {
    if (isOpen) return todos;
    // 折叠时优先显示进行中和待处理的任务
    const active = todos.filter(
      (t) => t.status === "in_progress" || t.status === "pending"
    );
    return active.slice(0, maxVisibleItems);
  }, [todos, isOpen, maxVisibleItems]);

  // 没有任务时不渲染
  if (todos.length === 0) return null;

  // 计算进度百分比
  const progressPercent = stats.total > 0 
    ? Math.round((stats.completed / stats.total) * 100) 
    : 0;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        "rounded-lg border border-border/60 bg-card/50",
        "shadow-sm",
        className
      )}
    >
      {/* 标题栏 */}
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-between h-auto py-2 px-3",
            "hover:bg-accent/50 rounded-lg",
            "focus-visible:ring-0 focus-visible:ring-offset-0"
          )}
        >
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">任务计划</span>
            <span className="text-xs text-muted-foreground">
              {stats.completed}/{stats.total}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 进度条 */}
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  progressPercent === 100 ? "bg-green-500" : "bg-primary"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </Button>
      </CollapsibleTrigger>

      {/* 任务列表 */}
      <CollapsibleContent>
        <div className="px-2 pb-2 space-y-0.5">
          {visibleTodos.map((todo) => (
            <TodoItemView key={todo.id} todo={todo} />
          ))}
        </div>
      </CollapsibleContent>

      {/* 折叠状态下的预览 */}
      {!isOpen && visibleTodos.length > 0 && (
        <div className="px-2 pb-2 space-y-0.5">
          {visibleTodos.map((todo) => (
            <TodoItemView key={todo.id} todo={todo} />
          ))}
          {todos.length > maxVisibleItems && (
            <div className="text-xs text-muted-foreground text-center py-1">
              还有 {todos.length - maxVisibleItems} 个任务...
            </div>
          )}
        </div>
      )}
    </Collapsible>
  );
}

// ============== 紧凑版任务列表（用于输入框上方） ==============

interface TodoListCompactProps {
  sessionId: string;
  className?: string;
}

/**
 * 紧凑版任务列表
 * 显示当前进行中的任务和进度，可展开查看全部任务
 */
export function TodoListCompact({ sessionId, className }: TodoListCompactProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 直接选择状态，避免在选择器中调用方法导致无限循环
  const allTodos = useTodoStore((s) => s.todos);
  
  // 使用 useMemo 计算派生数据
  const todos = useMemo(() => allTodos[sessionId] || [], [allTodos, sessionId]);
  const inProgressTodos = useMemo(
    () => todos.filter((t) => t.status === "in_progress"),
    [todos]
  );
  const completedCount = useMemo(
    () => todos.filter((t) => t.status === "completed").length,
    [todos]
  );
  const pendingCount = useMemo(
    () => todos.filter((t) => t.status === "pending").length,
    [todos]
  );

  // 按状态排序：进行中 > 待处理 > 已完成 > 已取消
  const sortedTodos = useMemo(() => {
    const statusOrder: Record<TodoStatus, number> = {
      in_progress: 0,
      pending: 1,
      completed: 2,
      cancelled: 3,
    };
    return [...todos].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }, [todos]);

  // 没有任务时不渲染
  if (todos.length === 0) return null;
  
  // 所有任务已完成（没有进行中和待处理的任务）时不渲染
  const isAllCompleted = inProgressTodos.length === 0 && pendingCount === 0;
  if (isAllCompleted) return null;

  const currentTask = inProgressTodos[0];
  const progressPercent = Math.round((completedCount / todos.length) * 100);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className={cn(
        "bg-accent/30 rounded-lg border border-border/40",
        "text-xs text-muted-foreground",
        "transition-all duration-200",
        className
      )}
    >
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2",
            "hover:bg-accent/50 rounded-lg",
            "transition-colors duration-150",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          )}
        >
          <div className="flex items-center gap-2 shrink-0">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
            <span className="font-medium">
              {completedCount}/{todos.length}
            </span>
          </div>

          <div className="w-px h-4 bg-border" />

          {currentTask ? (
            <span className="truncate flex-1 text-left">{currentTask.content}</span>
          ) : (
            <span className="truncate flex-1 text-left text-muted-foreground/70">
              等待下一个任务...
            </span>
          )}

          <div className="w-12 h-1 bg-muted rounded-full overflow-hidden shrink-0">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-2 pb-2 pt-1 border-t border-border/30">
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {sortedTodos.map((todo) => (
              <TodoItemView key={todo.id} todo={todo} />
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default TodoList;
