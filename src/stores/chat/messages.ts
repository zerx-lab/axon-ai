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
import type { Attachment, MentionPart } from "@/hooks";
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
  selectedVariant: string | undefined;
  selectedAgent: string | null;
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
    selectedVariant,
    selectedAgent,
    isLoading,
    setMessages,
    setSessions,
    setIsLoading,
    setError,
    isGeneratingRef,
  } = deps;
  
  return useCallback(async (content: string, attachments?: Attachment[], mentionParts?: MentionPart[]) => {
    if (!client || !activeSessionId) {
      // 服务尚未连接或没有活动会话，静默返回
      // 用户在 UI 上应该看不到发送按钮或输入框处于禁用状态
      console.log("[sendMessage] 服务尚未连接或无活动会话，等待连接...");
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
    
    const tempUserMessage = createTempUserMessage(activeSessionId, content, selectedModel);
    setMessages((prev) => [...prev, tempUserMessage]);
    
    const tempAssistantMessage = createTempAssistantMessage(
      activeSessionId,
      tempUserMessage.info.id,
      selectedModel
    );
    setMessages((prev) => [...prev, tempAssistantMessage]);
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = [];

      // 1. 添加文本内容
      if (content.trim()) {
        parts.push({ type: "text" as const, text: content });
      }

      // 2. 添加 @ 提及的文件、Agent、资源
      if (mentionParts && mentionParts.length > 0) {
        for (const part of mentionParts) {
          parts.push(part);
        }
      }

      // 3. 添加附件（图片/PDF）
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          parts.push({
            type: "file" as const,
            mime: attachment.mime,
            url: attachment.dataUrl,
            filename: attachment.filename,
          });
        }
      }
      
      const promptParams: {
        sessionID: string;
        directory?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parts: any[];
        model: { providerID: string; modelID: string };
        variant?: string;
        agent?: string;
      } = {
        sessionID: activeSessionId,
        directory: activeSession?.directory,
        parts,
        model: {
          providerID: selectedModel.providerId,
          modelID: selectedModel.modelId,
        },
      };
      
      if (selectedVariant) {
        promptParams.variant = selectedVariant;
      }
      
      if (selectedAgent) {
        promptParams.agent = selectedAgent;
      }
      
      console.log("[sendMessage] 发送参数:", JSON.stringify(promptParams, null, 2));
      console.log("[sendMessage] activeSession:", activeSession);
      console.log("[sendMessage] selectedModel:", selectedModel);
      console.log("[sendMessage] selectedVariant:", selectedVariant);
      console.log("[sendMessage] selectedAgent:", selectedAgent);
      
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
  }, [client, activeSessionId, selectedModel, selectedVariant, selectedAgent, isLoading, activeSession, sessions, t, setMessages, setSessions, setIsLoading, setError, isGeneratingRef]);
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

// ============== 发送命令 ==============

/** 发送命令依赖项 */
export interface CommandOperationsDeps {
  client: OpencodeClient | null;
  t: (key: string, options?: Record<string, unknown>) => string;
  activeSessionId: string | null;
  activeSession: Session | null;
  selectedModel: SelectedModel | null;
  isLoading: boolean;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  isGeneratingRef: React.MutableRefObject<boolean>;
}

/**
 * 发送 SDK 命令 Hook
 * 用于处理 /commandName args 格式的命令
 * 通过 session.command() API 发送，template 由后端处理
 */
export function useSendCommand(deps: CommandOperationsDeps) {
  const {
    client,
    t,
    activeSessionId,
    activeSession,
    selectedModel,
    isLoading,
    setMessages,
    setIsLoading,
    setError,
    isGeneratingRef,
  } = deps;

  return useCallback(async (commandName: string, args: string) => {
    if (!client || !activeSessionId) {
      console.log("[sendCommand] 服务尚未连接或无活动会话");
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

    // 创建临时消息显示用户输入
    const displayText = args ? `/${commandName} ${args}` : `/${commandName}`;
    const tempUserMessage = createTempUserMessage(activeSessionId, displayText, selectedModel);
    setMessages((prev) => [...prev, tempUserMessage]);

    const tempAssistantMessage = createTempAssistantMessage(
      activeSessionId,
      tempUserMessage.info.id,
      selectedModel
    );
    setMessages((prev) => [...prev, tempAssistantMessage]);

    try {
      // 使用 SDK session.command() API 发送命令
      // 后端会处理 template 和参数
      // model 格式为 "providerID/modelID" 字符串
      // arguments 是必填字段，没有参数时传空字符串
      const commandParams: {
        sessionID: string;
        directory?: string;
        command: string;
        arguments: string;
        model: string;
      } = {
        sessionID: activeSessionId,
        directory: activeSession?.directory,
        command: commandName,
        arguments: args || "",
        model: `${selectedModel.providerId}/${selectedModel.modelId}`,
      };

      console.log("[sendCommand] 发送命令参数:", JSON.stringify(commandParams, null, 2));

      const response = await client.session.command(commandParams);

      // 检查 API 响应是否成功
      const responseAny = response as Record<string, unknown>;
      const dataObj = responseAny.data as Record<string, unknown> | undefined;
      const topLevelError = responseAny.error;
      const dataLevelError = dataObj?.error;
      const topLevelSuccess = responseAny.success;
      const dataLevelSuccess = dataObj?.success;
      const hasError = topLevelError || dataLevelError || topLevelSuccess === false || dataLevelSuccess === false;

      if (hasError) {
        console.log("命令响应结构:", JSON.stringify(response, null, 2));
        const detail = extractErrorDetail(response);
        console.log("提取的错误详情:", detail);

        const errorMessage = detail
          ? t("errors.sendCommandFailedWithDetail", { detail })
          : t("errors.sendCommandFailed");
        setError(errorMessage);

        // 移除临时消息
        setMessages((prev) => filterTempMessages(prev));
        setIsLoading(false);
        isGeneratingRef.current = false;
        return;
      }

      // 成功后由 SSE 事件处理消息更新
    } catch (e) {
      console.error("发送命令失败:", e);
      const detail = extractErrorDetail(e);
      const errorMessage = detail
        ? t("errors.sendCommandFailedWithDetail", { detail })
        : t("errors.sendCommandFailed");
      setError(errorMessage);

      // 移除失败的消息
      setMessages((prev) => filterTempMessages(prev));
      setIsLoading(false);
      isGeneratingRef.current = false;
    }
    // 注意：不在 finally 中关闭 isLoading，由 SSE 事件控制
  }, [client, activeSessionId, selectedModel, isLoading, activeSession, t, setMessages, setIsLoading, setError, isGeneratingRef]);
}
