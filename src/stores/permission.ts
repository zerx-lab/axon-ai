/**
 * 权限请求状态管理
 * 
 * 管理权限请求的待处理列表，自动批准功能和回复处理
 * 参考: opencode/packages/app/src/context/permission.tsx
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PermissionRequest, PermissionReply } from "@/types/chat";

// ============== 类型定义 ==============

/** 权限回复回调函数 */
type PermissionRespondFn = (input: {
  sessionID: string;
  permissionID: string;
  response: PermissionReply;
  message?: string;
}) => Promise<void>;

/** 权限 Store 状态 */
interface PermissionState {
  /** 待处理的权限请求（按会话 ID 分组） */
  pendingRequests: Record<string, PermissionRequest[]>;
  /** 自动批准编辑权限的会话列表 */
  autoAcceptEdits: Record<string, boolean>;
  /** 已响应的请求 ID 集合（防止重复响应） */
  respondedIds: Set<string>;
}

/** 权限 Store 操作 */
interface PermissionActions {
  /** 添加权限请求 */
  addRequest: (request: PermissionRequest) => void;
  /** 移除权限请求 */
  removeRequest: (requestId: string, sessionId: string) => void;
  /** 清除会话的所有权限请求 */
  clearSessionRequests: (sessionId: string) => void;
  /** 获取会话的待处理权限请求 */
  getSessionRequests: (sessionId: string) => PermissionRequest[];
  /** 获取当前会话的第一个待处理请求 */
  getFirstPending: (sessionId: string) => PermissionRequest | undefined;
  /** 切换自动批准编辑权限 */
  toggleAutoAccept: (sessionId: string) => void;
  /** 启用自动批准 */
  enableAutoAccept: (sessionId: string) => void;
  /** 禁用自动批准 */
  disableAutoAccept: (sessionId: string) => void;
  /** 检查是否自动批准 */
  isAutoAccepting: (sessionId: string) => boolean;
  /** 标记请求已响应 */
  markResponded: (requestId: string) => void;
  /** 检查请求是否已响应 */
  hasResponded: (requestId: string) => boolean;
  /** 重置状态（用于测试） */
  reset: () => void;
}

type PermissionStore = PermissionState & PermissionActions;

// ============== 辅助函数 ==============

/** 
 * 检查权限请求是否应该自动批准
 * 编辑类权限（edit, write）在自动批准模式下会自动通过
 */
function shouldAutoAccept(request: PermissionRequest): boolean {
  return request.permission === "edit" || request.permission === "write";
}

// ============== Store 实现 ==============

const initialState: PermissionState = {
  pendingRequests: {},
  autoAcceptEdits: {},
  respondedIds: new Set(),
};

export const usePermissionStore = create<PermissionStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addRequest: (request) => {
        set((state) => {
          const sessionRequests = state.pendingRequests[request.sessionID] || [];
          // 检查是否已存在相同的请求
          if (sessionRequests.some((r) => r.id === request.id)) {
            return state;
          }
          return {
            pendingRequests: {
              ...state.pendingRequests,
              [request.sessionID]: [...sessionRequests, request],
            },
          };
        });
      },

      removeRequest: (requestId, sessionId) => {
        set((state) => {
          const sessionRequests = state.pendingRequests[sessionId] || [];
          return {
            pendingRequests: {
              ...state.pendingRequests,
              [sessionId]: sessionRequests.filter((r) => r.id !== requestId),
            },
          };
        });
      },

      clearSessionRequests: (sessionId) => {
        set((state) => {
          const { [sessionId]: _, ...rest } = state.pendingRequests;
          return { pendingRequests: rest };
        });
      },

      getSessionRequests: (sessionId) => {
        return get().pendingRequests[sessionId] || [];
      },

      getFirstPending: (sessionId) => {
        const requests = get().pendingRequests[sessionId] || [];
        return requests[0];
      },

      toggleAutoAccept: (sessionId) => {
        set((state) => ({
          autoAcceptEdits: {
            ...state.autoAcceptEdits,
            [sessionId]: !state.autoAcceptEdits[sessionId],
          },
        }));
      },

      enableAutoAccept: (sessionId) => {
        set((state) => ({
          autoAcceptEdits: {
            ...state.autoAcceptEdits,
            [sessionId]: true,
          },
        }));
      },

      disableAutoAccept: (sessionId) => {
        set((state) => {
          const { [sessionId]: _, ...rest } = state.autoAcceptEdits;
          return { autoAcceptEdits: rest };
        });
      },

      isAutoAccepting: (sessionId) => {
        return get().autoAcceptEdits[sessionId] ?? false;
      },

      markResponded: (requestId) => {
        set((state) => ({
          respondedIds: new Set([...state.respondedIds, requestId]),
        }));
      },

      hasResponded: (requestId) => {
        return get().respondedIds.has(requestId);
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: "axon-permission",
      partialize: (state) => ({
        // 只持久化自动批准设置
        autoAcceptEdits: state.autoAcceptEdits,
      }),
    }
  )
);

// ============== 导出工具函数 ==============

export { shouldAutoAccept };
export type { PermissionRespondFn };
