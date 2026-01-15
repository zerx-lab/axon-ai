/**
 * Subagent Session 数据获取 Hook
 *
 * 用于加载和实时更新 subagent 子会话的消息数据
 * 支持 SSE 事件实时更新
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  UserMessage as ApiUserMessage,
  AssistantMessage as ApiAssistantMessage,
  Part as ApiPart,
} from "@opencode-ai/sdk/v2";
import type { Message } from "@/types/chat";
import { useOpencode } from "./useOpencode";
import { mapApiMessage } from "@/stores/chat/utils";
import { useSubagentMessagesStore } from "@/stores/subagentMessages";

// 稳定的空数组引用，避免每次返回新数组导致无限循环
const EMPTY_MESSAGES: Message[] = [];

// ============== 类型定义 ==============

interface SubagentSessionData {
  /** 消息列表 */
  messages: Message[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 加载错误 */
  error: string | null;
  /** 重新加载 */
  reload: () => Promise<void>;
}

// ============== Hook 实现 ==============

/**
 * 获取 Subagent Session 的消息数据
 *
 * @param sessionId - 子 session ID，为 null 时不加载
 * @param directory - 可选的工作目录
 */
export function useSubagentSession(
  sessionId: string | null,
  directory?: string
): SubagentSessionData {
  const { client, isConnected } = useOpencode();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 订阅 store 中的消息变化
  // 使用稳定的空数组引用避免无限循环
  const storeMessages = useSubagentMessagesStore(
    (state) => sessionId ? state.sessionMessages[sessionId]?.messages : undefined
  );
  const messages = storeMessages ?? EMPTY_MESSAGES;

  // 追踪当前加载的 sessionId，避免竞态条件
  const currentSessionIdRef = useRef<string | null>(null);

  // 保存 directory 的 ref，避免依赖项变化
  const directoryRef = useRef(directory);
  directoryRef.current = directory;

  // 加载消息
  const loadMessages = useCallback(async () => {
    if (!sessionId || !client || !isConnected) {
      return;
    }

    // 直接从 store 获取方法，避免依赖项问题
    const store = useSubagentMessagesStore.getState();

    // 更新当前加载的 sessionId
    currentSessionIdRef.current = sessionId;
    setIsLoading(true);
    setError(null);

    // 开始追踪这个 session 以接收 SSE 更新
    store.trackSession(sessionId);

    try {
      const response = await client.session.messages({
        sessionID: sessionId,
        directory: directoryRef.current,
      });

      // 检查是否仍然是当前请求（避免竞态）
      if (currentSessionIdRef.current !== sessionId) {
        return;
      }

      if (response.data) {
        const messageList = response.data as Array<{
          info: ApiUserMessage | ApiAssistantMessage;
          parts: ApiPart[];
        }>;

        const mappedMessages = messageList.map(mapApiMessage);
        // 按时间正序排列
        mappedMessages.sort((a, b) => a.info.time.created - b.info.time.created);
        // 设置到 store 中
        store.setMessages(sessionId, mappedMessages);
      } else {
        store.setMessages(sessionId, []);
      }
    } catch (e) {
      // 检查是否仍然是当前请求
      if (currentSessionIdRef.current !== sessionId) {
        return;
      }

      console.error("[useSubagentSession] 加载消息失败:", e);
      setError(e instanceof Error ? e.message : "加载失败");
      useSubagentMessagesStore.getState().setMessages(sessionId, []);
    } finally {
      // 检查是否仍然是当前请求
      if (currentSessionIdRef.current === sessionId) {
        setIsLoading(false);
      }
    }
  }, [sessionId, client, isConnected]);

  // sessionId 变化时重新加载
  // 注意：这里不 untrack session，因为面板可能有多个标签共享消息
  // untrack 在面板关闭时由 SubagentPanel 组件统一处理
  useEffect(() => {
    if (sessionId) {
      loadMessages();
    }
  }, [sessionId, loadMessages]);

  // 重新加载方法
  const reload = useCallback(async () => {
    await loadMessages();
  }, [loadMessages]);

  return {
    messages,
    isLoading,
    error,
    reload,
  };
}

// ============== 辅助 Hook ==============

/**
 * 从消息列表中提取统计信息
 */
export function useSubagentStats(messages: Message[]) {
  // 计算统计信息
  const stats = {
    toolCallCount: 0,
    tokens: {
      input: 0,
      output: 0,
    },
    cost: 0,
  };

  for (const message of messages) {
    if (message.info.role === "assistant") {
      const assistantInfo = message.info;
      stats.tokens.input += assistantInfo.tokens?.input ?? 0;
      stats.tokens.output += assistantInfo.tokens?.output ?? 0;
      stats.cost += assistantInfo.cost ?? 0;

      // 计算工具调用数量
      for (const part of message.parts) {
        if (part.type === "tool") {
          stats.toolCallCount++;
        }
      }
    }
  }

  return stats;
}
