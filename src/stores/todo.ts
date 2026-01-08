/**
 * Todo 任务列表状态管理
 * 
 * 管理会话的任务列表，用于显示 Agent 的工作计划
 * 参考: opencode/packages/opencode/src/session/todo.ts
 */

import { create } from "zustand";
import type { TodoItem } from "@/types/chat";

// ============== 类型定义 ==============

/** Todo Store 状态 */
interface TodoState {
  /** 按会话 ID 分组的任务列表 */
  todos: Record<string, TodoItem[]>;
}

/** Todo Store 操作 */
interface TodoActions {
  /** 更新会话的任务列表 */
  updateTodos: (sessionId: string, todos: TodoItem[]) => void;
  /** 获取会话的任务列表 */
  getTodos: (sessionId: string) => TodoItem[];
  /** 清除会话的任务列表 */
  clearTodos: (sessionId: string) => void;
  /** 获取已完成任务数量 */
  getCompletedCount: (sessionId: string) => number;
  /** 获取进行中任务 */
  getInProgressTodos: (sessionId: string) => TodoItem[];
  /** 获取待处理任务数量 */
  getPendingCount: (sessionId: string) => number;
  /** 重置状态 */
  reset: () => void;
}

type TodoStore = TodoState & TodoActions;

// ============== 辅助函数 ==============

/** 按状态优先级排序任务 */
function sortTodos(todos: TodoItem[]): TodoItem[] {
  const priority: Record<TodoItem["status"], number> = {
    in_progress: 0, // 进行中优先
    pending: 1,     // 然后是待处理
    completed: 2,   // 已完成排后
    cancelled: 3,   // 取消的最后
  };

  return [...todos].sort((a, b) => {
    const statusDiff = priority[a.status] - priority[b.status];
    if (statusDiff !== 0) return statusDiff;
    // 同状态按优先级排序
    const priorityOrder: Record<TodoItem["priority"], number> = {
      high: 0,
      medium: 1,
      low: 2,
    };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// ============== Store 实现 ==============

const initialState: TodoState = {
  todos: {},
};

export const useTodoStore = create<TodoStore>()((set, get) => ({
  ...initialState,

  updateTodos: (sessionId, todos) => {
    set((state) => ({
      todos: {
        ...state.todos,
        [sessionId]: sortTodos(todos),
      },
    }));
  },

  getTodos: (sessionId) => {
    return get().todos[sessionId] || [];
  },

  clearTodos: (sessionId) => {
    set((state) => {
      const { [sessionId]: _, ...rest } = state.todos;
      return { todos: rest };
    });
  },

  getCompletedCount: (sessionId) => {
    const todos = get().todos[sessionId] || [];
    return todos.filter((t) => t.status === "completed").length;
  },

  getInProgressTodos: (sessionId) => {
    const todos = get().todos[sessionId] || [];
    return todos.filter((t) => t.status === "in_progress");
  },

  getPendingCount: (sessionId) => {
    const todos = get().todos[sessionId] || [];
    return todos.filter((t) => t.status === "pending").length;
  },

  reset: () => {
    set(initialState);
  },
}));

// ============== 导出工具函数 ==============

export { sortTodos };
