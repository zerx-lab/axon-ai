/**
 * Subagent 消息状态管理
 *
 * 管理被追踪的 subagent session 的消息数据
 * 通过 SSE 事件实时更新消息
 */

import { create } from "zustand";
import type { Part as ApiPart } from "@opencode-ai/sdk/v2";
import type {
  Message,
  Part,
  UserMessageInfo,
  AssistantMessageInfo,
} from "@/types/chat";

// ============== 类型定义 ==============

/** 单个 session 的消息数据 */
interface SessionMessages {
  messages: Message[];
  lastUpdated: number;
}

/** Subagent 消息 Store 状态 */
interface SubagentMessagesState {
  /** 被追踪的 session ID 集合 */
  trackedSessions: Set<string>;
  /** 各 session 的消息数据 */
  sessionMessages: Record<string, SessionMessages>;
}

/** Subagent 消息 Store 操作 */
interface SubagentMessagesActions {
  /** 开始追踪一个 session */
  trackSession: (sessionId: string) => void;
  /** 停止追踪一个 session */
  untrackSession: (sessionId: string) => void;
  /** 检查 session 是否被追踪 */
  isTracked: (sessionId: string) => boolean;
  /** 设置 session 的消息（初始加载） */
  setMessages: (sessionId: string, messages: Message[]) => void;
  /** 获取 session 的消息 */
  getMessages: (sessionId: string) => Message[];
  /** 处理 message.part.updated 事件 */
  handlePartUpdated: (
    sessionId: string,
    messageId: string,
    part: ApiPart,
    delta?: string
  ) => void;
  /** 处理 message.updated 事件 */
  handleMessageUpdated: (
    sessionId: string,
    info: UserMessageInfo | AssistantMessageInfo
  ) => void;
  /** 清除所有追踪的 session */
  clearAll: () => void;
}

type SubagentMessagesStore = SubagentMessagesState & SubagentMessagesActions;

// ============== Store 实现 ==============

const initialState: SubagentMessagesState = {
  trackedSessions: new Set(),
  sessionMessages: {},
};

export const useSubagentMessagesStore = create<SubagentMessagesStore>()(
  (set, get) => ({
    ...initialState,

    trackSession: (sessionId) => {
      set((state) => {
        if (state.trackedSessions.has(sessionId)) {
          return state;
        }
        const newTracked = new Set(state.trackedSessions);
        newTracked.add(sessionId);
        return {
          trackedSessions: newTracked,
          sessionMessages: {
            ...state.sessionMessages,
            [sessionId]: { messages: [], lastUpdated: Date.now() },
          },
        };
      });
    },

    untrackSession: (sessionId) => {
      set((state) => {
        const newTracked = new Set(state.trackedSessions);
        newTracked.delete(sessionId);
        const { [sessionId]: _, ...rest } = state.sessionMessages;
        return {
          trackedSessions: newTracked,
          sessionMessages: rest,
        };
      });
    },

    isTracked: (sessionId) => {
      return get().trackedSessions.has(sessionId);
    },

    setMessages: (sessionId, messages) => {
      set((state) => ({
        sessionMessages: {
          ...state.sessionMessages,
          [sessionId]: { messages, lastUpdated: Date.now() },
        },
      }));
    },

    getMessages: (sessionId) => {
      return get().sessionMessages[sessionId]?.messages ?? [];
    },

    handlePartUpdated: (sessionId, messageId, part, delta) => {
      set((state) => {
        if (!state.trackedSessions.has(sessionId)) {
          return state;
        }

        const sessionData = state.sessionMessages[sessionId];
        if (!sessionData) {
          return state;
        }

        let messages = [...sessionData.messages];
        const messageIndex = messages.findIndex((m) => m.info.id === messageId);

        if (messageIndex === -1) {
          // 消息不存在，创建新的助手消息
          const newMessage: Message = {
            info: {
              id: messageId,
              sessionID: sessionId,
              role: "assistant",
              time: { created: Date.now() },
              parentID: "",
              modelID: "",
              providerID: "",
              mode: "chat",
              agent: "coder",
              path: { cwd: "", root: "" },
              cost: 0,
              tokens: {
                input: 0,
                output: 0,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
            },
            parts: [part as unknown as Part],
          };
          messages = [...messages, newMessage];
        } else {
          // 更新现有消息
          const message = { ...messages[messageIndex] };
          const partIndex = message.parts.findIndex((p) => p.id === part.id);

          if (partIndex === -1) {
            // Part 不存在，添加
            message.parts = [...message.parts, part as unknown as Part];
          } else {
            // 更新现有 part
            const updatedParts = [...message.parts];
            if (part.type === "text" && delta !== undefined) {
              const existingPart = updatedParts[partIndex];
              if (existingPart.type === "text") {
                updatedParts[partIndex] = {
                  ...existingPart,
                  text: existingPart.text + delta,
                };
              }
            } else {
              updatedParts[partIndex] = part as unknown as Part;
            }
            message.parts = updatedParts;
          }

          messages[messageIndex] = message;
        }

        return {
          sessionMessages: {
            ...state.sessionMessages,
            [sessionId]: { messages, lastUpdated: Date.now() },
          },
        };
      });
    },

    handleMessageUpdated: (sessionId, info) => {
      set((state) => {
        if (!state.trackedSessions.has(sessionId)) {
          return state;
        }

        const sessionData = state.sessionMessages[sessionId];
        if (!sessionData) {
          return state;
        }

        let messages = [...sessionData.messages];
        const messageIndex = messages.findIndex((m) => m.info.id === info.id);

        if (messageIndex === -1) {
          // 消息不存在，创建新消息
          const newMessage: Message = {
            info: info,
            parts: [],
          };
          messages = [...messages, newMessage];
        } else {
          // 更新消息 info
          messages[messageIndex] = {
            ...messages[messageIndex],
            info: info,
          };
        }

        return {
          sessionMessages: {
            ...state.sessionMessages,
            [sessionId]: { messages, lastUpdated: Date.now() },
          },
        };
      });
    },

    clearAll: () => {
      set(initialState);
    },
  })
);

// ============== SSE 事件处理辅助函数 ==============

/** SSE message.part.updated 事件属性 */
interface PartUpdatedEventProperties {
  part: ApiPart & { messageID: string };
  delta?: string;
}

/** SSE message.updated 事件属性 */
interface MessageUpdatedEventProperties {
  info: UserMessageInfo | AssistantMessageInfo;
}

/** SSE 事件属性联合类型 */
type SSEEventProperties = PartUpdatedEventProperties | MessageUpdatedEventProperties;

/**
 * 处理 SSE 事件，更新 subagent 消息
 * 在主 SSE handler 中调用此函数
 */
export function handleSubagentSSEEvent(
  eventType: string,
  sessionId: string,
  properties: SSEEventProperties
): boolean {
  const store = useSubagentMessagesStore.getState();

  // 如果 session 没有被追踪，返回 false
  if (!store.isTracked(sessionId)) {
    return false;
  }

  switch (eventType) {
    case "message.part.updated": {
      const { part, delta } = properties as PartUpdatedEventProperties;
      store.handlePartUpdated(sessionId, part.messageID, part, delta);
      return true;
    }

    case "message.updated": {
      const { info } = properties as MessageUpdatedEventProperties;
      store.handleMessageUpdated(sessionId, info);
      return true;
    }

    default:
      return false;
  }
}
