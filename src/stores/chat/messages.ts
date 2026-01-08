/**
 * 聊天状态管理 - 消息操作
 * 
 * 包含消息加载、发送、停止生成等功能
 */

import { useCallback } from "react";
import type {
  UserMessage as ApiUserMessage,
  AssistantMessage as ApiAssistantMessage,
  Part as ApiPart,
} from "@opencode-ai/sdk/v2";
import type { OpencodeClient } from "@/services/opencode/types";
import type { Message, Session } from "@/types/chat";
import type { SelectedModel } from "./types";
import {
  mapApiMessage,
  extractErrorDetail,
  createTempUserMessage,
  createTempAssistantMessage,
  filterTempMessages,
} from "./utils";

// ============== 类型定义 ==============

/** 消息操作依赖项 */
export interface MessageOperationsDeps {
  client: OpencodeClient | null;
  t: (key: string, options?: Record<string, unknown>) => string;
  activeSessionId: string | null;
  activeSession: Session | null;
  sessions: Session[];
  selectedModel: SelectedModel | null;
  isLoading: boolean;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  isGeneratingRef: React.MutableRefObject<boolean>;
}

// ============== 加载消息 ==============

/**
 * 加载会话消息 Hook
 */
export function useLoadMessages(
  client: OpencodeClient | null,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
) {
  return useCallback(async (sessionId: string, directory?: string) => {
    if (!client) return;
    
    try {
      // SDK 使用 session.messages() 方法，参数是 sessionID 和可选的 directory
      const response = await client.session.messages({ sessionID: sessionId, directory });
      if (response.data) {
        // response.data 是消息数组
        const messageList = response.data as Array<{
          info: ApiUserMessage | ApiAssistantMessage;
          parts: ApiPart[];
        }>;
        const mappedMessages = messageList.map(mapApiMessage);
        // 按时间正序排列
        mappedMessages.sort((a, b) => a.info.time.created - b.info.time.created);
        setMessages(mappedMessages);
      }
    } catch (e) {
      console.error("加载消息失败:", e);
      // 不设置错误，可能是空会话
      setMessages([]);
    }
  }, [client, setMessages]);
}

// ============== 发送消息 ==============

/**
 * 发送消息 Hook
 */
export function useSendMessage(deps: MessageOperationsDeps) {
  const {
    client,
    t,
    activeSessionId,
    activeSession,
    sessions,
    selectedModel,
    isLoading,
    setMessages,
    setSessions,
    setIsLoading,
    setError,
    isGeneratingRef,
  } = deps;
  
  return useCallback(async (content: string) => {
    if (!client || !activeSessionId) {
      setError(t("errors.serviceNotConnected"));
      return;
    }
    
    if (!selectedModel) {
      setError(t("errors.modelRequired"));
      return;
    }
    
    if (isLoading) return;
    
    setIsLoading(true);
    isGeneratingRef.current = true;
    setError(null);
    
    // 先添加用户消息到界面（临时消息）
    const tempUserMessage = createTempUserMessage(activeSessionId, content, selectedModel);
    setMessages((prev) => [...prev, tempUserMessage]);
    
    // 添加一个占位的助手消息（表示正在加载）
    const tempAssistantMessage = createTempAssistantMessage(
      activeSessionId,
      tempUserMessage.info.id,
      selectedModel
    );
    setMessages((prev) => [...prev, tempAssistantMessage]);
    
    try {
      // 使用 session.promptAsync() 发送消息（异步，响应通过 SSE 事件流式返回）
      // SDK v2 使用扁平化参数结构: { sessionID, directory, parts, model, ... }
      const promptParams = {
        sessionID: activeSessionId,
        directory: activeSession?.directory,
        parts: [{ type: "text" as const, text: content }],
        model: {
          providerID: selectedModel.providerId,
          modelID: selectedModel.modelId,
        },
      };
      
      // 调试日志：打印发送的参数
      console.log("[sendMessage] 发送参数:", JSON.stringify(promptParams, null, 2));
      console.log("[sendMessage] activeSession:", activeSession);
      console.log("[sendMessage] selectedModel:", selectedModel);
      
      const response = await client.session.promptAsync(promptParams);
      
      // 检查 API 响应是否成功
      // SDK 返回结构可能是: { data, error, success } 或 { data: { error, success } }
      // 当 success 为 false 时（如 400 错误），需要手动处理
      const responseAny = response as Record<string, unknown>;
      const dataObj = responseAny.data as Record<string, unknown> | undefined;
      
      // 检查是否有错误
      const topLevelError = responseAny.error;
      const dataLevelError = dataObj?.error;
      const topLevelSuccess = responseAny.success;
      const dataLevelSuccess = dataObj?.success;
      
      const hasError = topLevelError || dataLevelError || topLevelSuccess === false || dataLevelSuccess === false;
      
      if (hasError) {
        // 使用辅助函数提取错误详情
        // 调试：打印完整响应结构
        console.log("完整响应结构:", JSON.stringify(response, null, 2));
        
        const detail = extractErrorDetail(response);
        console.log("提取的错误详情:", detail);
        
        // 使用多语言翻译，同时显示详细错误信息
        const errorMessage = detail 
          ? t("errors.sendMessageFailedWithDetail", { detail })
          : t("errors.sendMessageFailed");
        setError(errorMessage);
        
        // 移除临时消息
        setMessages((prev) => filterTempMessages(prev));
        setIsLoading(false);
        isGeneratingRef.current = false;
        return;
      }
      
      // 注意：成功后不再等待完整响应，消息更新通过 SSE 事件处理
      // isLoading 状态会在收到 session.status:idle 事件时自动关闭
      
      // 更新会话标题（如果是第一条消息）
      const currentSession = sessions.find((s) => s.id === activeSessionId);
      if (currentSession && currentSession.title === "新对话") {
        // 用消息内容前30个字符作为标题
        const newTitle = content.slice(0, 30) + (content.length > 30 ? "..." : "");
        try {
          await client.session.update({
            sessionID: activeSessionId,
            directory: currentSession.directory,
            title: newTitle,
          });
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId ? { ...s, title: newTitle } : s
            )
          );
        } catch {
          // 忽略标题更新失败
        }
      }
    } catch (e) {
      console.error("发送消息失败:", e);
      
      // 使用辅助函数提取错误详情
      const detail = extractErrorDetail(e);
      
      const errorMessage = detail 
        ? t("errors.sendMessageFailedWithDetail", { detail })
        : t("errors.sendMessageFailed");
      setError(errorMessage);
      
      // 移除失败的消息
      setMessages((prev) => filterTempMessages(prev));
      setIsLoading(false);
      isGeneratingRef.current = false;
    }
    // 注意：不在 finally 中关闭 isLoading，由 SSE 事件控制
  }, [client, activeSessionId, selectedModel, isLoading, activeSession, sessions, t, setMessages, setSessions, setIsLoading, setError, isGeneratingRef]);
}

// ============== 停止生成 ==============

/**
 * 停止生成 Hook
 */
export function useStopGeneration(
  client: OpencodeClient | null,
  activeSessionId: string | null,
  activeSession: Session | null,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  isGeneratingRef: React.MutableRefObject<boolean>,
  loadMessages: (sessionId: string, directory?: string) => Promise<void>
) {
  return useCallback(async () => {
    if (!client || !activeSessionId) return;
    
    try {
      // SDK v2 使用扁平化参数结构: { sessionID, directory? }
      await client.session.abort({ sessionID: activeSessionId, directory: activeSession?.directory });
    } catch (e) {
      console.error("停止生成失败:", e);
    } finally {
      setIsLoading(false);
      isGeneratingRef.current = false;
      
      // 刷新消息
      await loadMessages(activeSessionId, activeSession?.directory);
    }
  }, [client, activeSessionId, activeSession, setIsLoading, isGeneratingRef, loadMessages]);
}
