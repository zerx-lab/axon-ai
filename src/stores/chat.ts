/**
 * 聊天状态管理 - 深度集成 OpenCode SDK
 * 
 * 功能：
 * - 会话管理（创建、列表、删除、选择）
 * - 消息管理（发送、接收、流式响应）
 * - 模型选择（获取providers/models列表）
 * - 与 OpenCode 服务器实时同步
 * - SSE 事件订阅，实现流式消息更新
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useOpencodeContext } from "@/providers/OpencodeProvider";
import type {
  Session as ApiSession,
  UserMessage as ApiUserMessage,
  AssistantMessage as ApiAssistantMessage,
  Part as ApiPart,
  Event as OpencodeEvent,
} from "@opencode-ai/sdk/v2";
import type {
  Message,
  Session,
  Part,
  MessageInfo,
  UserMessageInfo,
  AssistantMessageInfo,
} from "@/types/chat";

// ============== 常量 ==============

/** localStorage 存储键名 - 模型选择 */
const MODEL_STORAGE_KEY = "axon-selected-model";

/** localStorage 存储键名 - 活动会话 ID */
const ACTIVE_SESSION_STORAGE_KEY = "axon-active-session-id";

// ============== 类型定义 ==============

/** 模型信息 */
export interface Model {
  id: string;
  name: string;
  provider: string;
}

/** Provider 信息 */
export interface Provider {
  id: string;
  name: string;
  models: Model[];
}

/** 会话状态 */
export type SessionStatus = "idle" | "running" | "error";

/** Chat Hook 返回值 */
export interface UseChatReturn {
  // 状态
  sessions: Session[];
  activeSession: Session | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  
  // 模型相关
  providers: Provider[];
  models: Model[];
  selectedModel: { providerId: string; modelId: string } | null;
  isLoadingModels: boolean;
  
  // 会话操作
  createNewSession: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  
  // 消息操作
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => Promise<void>;
  
  // 模型操作
  selectModel: (providerId: string, modelId: string) => void;
  refreshProviders: () => Promise<void>;
  
  // 其他
  clearError: () => void;
  refreshSessions: () => Promise<void>;
}

// ============== 辅助函数 ==============

/** 从 API 会话转换为本地会话 */
function mapApiSession(apiSession: ApiSession): Session {
  return {
    id: apiSession.id,
    title: apiSession.title || "新对话",
    // API 返回的是毫秒时间戳
    createdAt: apiSession.time.created,
    updatedAt: apiSession.time.updated,
    parentId: apiSession.parentID,
  };
}

/** 从 API 消息转换为本地消息 */
function mapApiMessage(apiMessage: {
  info: ApiUserMessage | ApiAssistantMessage;
  parts: ApiPart[];
}): Message {
  // 将 API 消息信息映射为本地类型
  const info: MessageInfo = apiMessage.info.role === "user"
    ? {
        id: apiMessage.info.id,
        sessionID: apiMessage.info.sessionID,
        role: "user" as const,
        time: apiMessage.info.time,
        summary: (apiMessage.info as ApiUserMessage).summary,
        agent: (apiMessage.info as ApiUserMessage).agent,
        model: (apiMessage.info as ApiUserMessage).model,
        system: (apiMessage.info as ApiUserMessage).system,
        tools: (apiMessage.info as ApiUserMessage).tools,
        variant: (apiMessage.info as ApiUserMessage).variant,
      } as UserMessageInfo
    : {
        id: apiMessage.info.id,
        sessionID: apiMessage.info.sessionID,
        role: "assistant" as const,
        time: apiMessage.info.time,
        error: (apiMessage.info as ApiAssistantMessage).error,
        parentID: (apiMessage.info as ApiAssistantMessage).parentID,
        modelID: (apiMessage.info as ApiAssistantMessage).modelID,
        providerID: (apiMessage.info as ApiAssistantMessage).providerID,
        mode: (apiMessage.info as ApiAssistantMessage).mode,
        agent: (apiMessage.info as ApiAssistantMessage).agent,
        path: (apiMessage.info as ApiAssistantMessage).path,
        summary: (apiMessage.info as ApiAssistantMessage).summary,
        cost: (apiMessage.info as ApiAssistantMessage).cost,
        tokens: (apiMessage.info as ApiAssistantMessage).tokens,
        finish: (apiMessage.info as ApiAssistantMessage).finish,
      } as AssistantMessageInfo;

  // 将 API parts 直接转换（类型兼容）
  const parts = apiMessage.parts as unknown as Part[];

  return {
    info,
    parts,
  };
}

// ============== 辅助函数：错误提取 ==============

/**
 * 从各种格式的错误对象中提取错误消息
 * 支持格式:
 * - Error 对象
 * - { error: [{ message: string }] } (API 验证错误)
 * - { errors: [{ message: string }] } (SDK BadRequestError 格式)
 * - { data: { error: [...] } }
 * - { message: string }
 * - 字符串
 */
function extractErrorDetail(e: unknown): string {
  if (!e) return "";
  
  // 标准 Error 对象
  if (e instanceof Error) {
    return e.message;
  }
  
  // 字符串
  if (typeof e === "string") {
    return e;
  }
  
  // 对象类型
  if (typeof e === "object") {
    const obj = e as Record<string, unknown>;
    
    // 提取消息数组的辅助函数
    const extractMessagesFromArray = (arr: unknown[]): string[] => {
      return arr
        .map((err: unknown) => {
          if (typeof err === "string") return err;
          if (err && typeof err === "object") {
            const errObj = err as Record<string, unknown>;
            return (errObj.message as string) || "";
          }
          return "";
        })
        .filter(Boolean);
    };
    
    // 检查顶层 error 数组 (API 验证错误格式)
    if (Array.isArray(obj.error)) {
      const messages = extractMessagesFromArray(obj.error);
      if (messages.length > 0) {
        return messages.join("; ");
      }
    }
    
    // 检查顶层 errors 数组 (SDK BadRequestError 格式)
    if (Array.isArray(obj.errors)) {
      const messages = extractMessagesFromArray(obj.errors);
      if (messages.length > 0) {
        return messages.join("; ");
      }
    }
    
    // 检查 data.error 数组
    if (obj.data && typeof obj.data === "object") {
      const dataObj = obj.data as Record<string, unknown>;
      if (Array.isArray(dataObj.error)) {
        const messages = extractMessagesFromArray(dataObj.error);
        if (messages.length > 0) {
          return messages.join("; ");
        }
      }
      // 检查 data.errors 数组
      if (Array.isArray(dataObj.errors)) {
        const messages = extractMessagesFromArray(dataObj.errors);
        if (messages.length > 0) {
          return messages.join("; ");
        }
      }
    }
    
    // 检查顶层 error 字符串或对象
    if (typeof obj.error === "string") {
      return obj.error;
    }
    if (obj.error && typeof obj.error === "object") {
      const errObj = obj.error as Record<string, unknown>;
      if (typeof errObj.message === "string") {
        return errObj.message;
      }
    }
    
    // 检查顶层 message
    if (typeof obj.message === "string") {
      return obj.message;
    }
  }
  
  return "";
}

// ============== Hook ==============

/**
 * 聊天状态管理 Hook
 * 深度集成 OpenCode SDK
 */
export function useChat(): UseChatReturn {
  const { client, isConnected, onEvent } = useOpencodeContext();
  const { t } = useTranslation();
  
  // 会话状态
  const [sessions, setSessions] = useState<Session[]>([]);
  // 从 localStorage 恢复活动会话 ID
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      return saved || null;
    } catch {
      return null;
    }
  });
  const [messages, setMessages] = useState<Message[]>([]);
  
  // 当活动会话 ID 变化时，保存到 localStorage
  useEffect(() => {
    try {
      if (activeSessionId) {
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeSessionId);
      } else {
        localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      }
    } catch (e) {
      console.error("保存活动会话 ID 失败:", e);
    }
  }, [activeSessionId]);
  
  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 模型状态
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedModel, setSelectedModel] = useState<{ providerId: string; modelId: string } | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  
  // 使用 ref 追踪最新的 selectedModel，避免 useCallback 闭包问题
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;
  
  // 用于追踪是否正在生成
  const isGeneratingRef = useRef(false);
  
  // 保存 t 函数的引用（用于事件处理闭包）
  const tRef = useRef(t);
  tRef.current = t;
  
  // 派生状态
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const models = providers.flatMap((p) => p.models);

  // ============== 加载消息 ==============
  
  /** 
   * 检查会话状态并恢复运行状态
   * 用于会话切换或页面恢复时，检测是否有正在运行的会话
   */
  const checkAndRestoreSessionStatus = useCallback(async (sessionId: string) => {
    if (!client) return;
    
    try {
      // 获取所有会话状态
      const response = await client.session.status();
      if (response.data) {
        const statusMap = response.data as Record<string, { type: string; attempt?: number; message?: string }>;
        const status = statusMap[sessionId];
        
        if (status) {
          if (status.type === "busy") {
            // 会话正在运行，恢复 loading 状态
            console.log(`[useChat] 会话 ${sessionId} 正在运行，恢复 loading 状态`);
            setIsLoading(true);
            isGeneratingRef.current = true;
          } else if (status.type === "retry") {
            // 会话正在重试
            console.log(`[useChat] 会话 ${sessionId} 正在重试 (第 ${status.attempt} 次): ${status.message}`);
            setIsLoading(true);
            isGeneratingRef.current = true;
          } else {
            // 会话空闲
            setIsLoading(false);
            isGeneratingRef.current = false;
          }
        }
      }
    } catch (e) {
      console.error("检查会话状态失败:", e);
      // 不设置错误，这是可选的恢复功能
    }
  }, [client]);
  
  /** 加载会话消息 */
  const loadMessages = useCallback(async (sessionId: string) => {
    if (!client) return;
    
    try {
      // SDK 使用 session.messages() 方法，参数是 sessionID
      const response = await client.session.messages({ sessionID: sessionId });
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
  }, [client]);

  // ============== 会话操作 ==============

  /** 创建新会话 */
  const createNewSession = useCallback(async () => {
    if (!client) {
      setError(t("errors.serviceNotConnected"));
      return;
    }
    
    try {
      const response = await client.session.create({});
      if (response.data) {
        const newSession = mapApiSession(response.data as ApiSession);
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setMessages([]);
      }
    } catch (e) {
      console.error("创建会话失败:", e);
      const detail = e instanceof Error ? e.message : "";
      setError(detail ? t("errors.sendMessageFailedWithDetail", { detail }) : t("errors.createSessionFailed"));
    }
  }, [client, t]);

  /** 刷新会话列表 */
  const refreshSessions = useCallback(async () => {
    if (!client) return;
    
    try {
      const response = await client.session.list();
      if (response.data) {
        // response.data 是 Session[] 数组
        const sessionList = response.data as ApiSession[];
        const mappedSessions = sessionList.map(mapApiSession);
        // 按更新时间倒序排列
        mappedSessions.sort((a, b) => b.updatedAt - a.updatedAt);
        setSessions(mappedSessions);
        
        // 处理活动会话选择
        if (activeSessionId) {
          // 验证 activeSessionId 是否存在于会话列表中
          const sessionExists = mappedSessions.some((s) => s.id === activeSessionId);
          
          if (sessionExists) {
            // 会话存在，加载消息并检查状态（用于页面刷新恢复）
            await Promise.all([
              loadMessages(activeSessionId),
              checkAndRestoreSessionStatus(activeSessionId),
            ]);
          } else if (mappedSessions.length > 0) {
            // 保存的会话不存在，回退到第一个会话
            console.log(`[useChat] 保存的会话 ${activeSessionId} 不存在，回退到第一个会话`);
            const firstSessionId = mappedSessions[0].id;
            setActiveSessionId(firstSessionId);
            await Promise.all([
              loadMessages(firstSessionId),
              checkAndRestoreSessionStatus(firstSessionId),
            ]);
          } else {
            // 保存的会话不存在且没有其他会话，创建新的
            console.log(`[useChat] 保存的会话 ${activeSessionId} 不存在，创建新会话`);
            await createNewSession();
          }
        } else if (mappedSessions.length > 0) {
          // 没有活动会话但有会话列表，选择第一个
          const firstSessionId = mappedSessions[0].id;
          setActiveSessionId(firstSessionId);
          await Promise.all([
            loadMessages(firstSessionId),
            checkAndRestoreSessionStatus(firstSessionId),
          ]);
        } else {
          // 没有活动会话也没有会话列表，创建新的
          await createNewSession();
        }
      }
    } catch (e) {
      console.error("刷新会话列表失败:", e);
      const detail = e instanceof Error ? e.message : "";
      setError(detail ? t("errors.sendMessageFailedWithDetail", { detail }) : t("errors.loadSessionsFailed"));
    }
  }, [client, activeSessionId, loadMessages, checkAndRestoreSessionStatus, createNewSession, t]);

  /** 选择会话 */
  const selectSession = useCallback(async (sessionId: string) => {
    if (sessionId === activeSessionId) return;
    
    setActiveSessionId(sessionId);
    
    // 并行加载消息和检查会话状态
    await Promise.all([
      loadMessages(sessionId),
      checkAndRestoreSessionStatus(sessionId),
    ]);
  }, [activeSessionId, loadMessages, checkAndRestoreSessionStatus]);

  /** 删除会话 */
  const deleteSession = useCallback(async (sessionId: string) => {
    if (!client) return;
    
    try {
      // SDK 使用 sessionID 作为参数名
      await client.session.delete({ sessionID: sessionId });
      
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== sessionId);
        
        // 如果删除的是当前会话，选择下一个
        if (sessionId === activeSessionId) {
          if (filtered.length > 0) {
            setActiveSessionId(filtered[0].id);
            loadMessages(filtered[0].id);
          } else {
            // 创建新会话
            createNewSession();
          }
        }
        
        return filtered;
      });
    } catch (e) {
      console.error("删除会话失败:", e);
      const detail = e instanceof Error ? e.message : "";
      setError(detail ? t("errors.sendMessageFailedWithDetail", { detail }) : t("errors.deleteSessionFailed"));
    }
  }, [client, activeSessionId, loadMessages, createNewSession, t]);

  // ============== 初始化 ==============

  // 连接成功后加载数据
  useEffect(() => {
    if (isConnected && client) {
      // 加载会话列表和 providers
      refreshSessions();
      refreshProviders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, client]);

  // ============== SSE 事件处理 ==============

  // 保存当前活动会话 ID 的 ref（用于事件处理闭包）
  const activeSessionIdRef = useRef<string | null>(null);
  activeSessionIdRef.current = activeSessionId;
  
  // 用于批量更新消息的缓冲区（优化性能）
  const messageUpdateBufferRef = useRef<Map<string, { part: ApiPart; delta?: string }>>(new Map());
  const updateFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 批量刷新消息更新（优化：减少重渲染次数）
  const flushMessageUpdates = useCallback(() => {
    if (messageUpdateBufferRef.current.size === 0) return;
    
    const updates = new Map(messageUpdateBufferRef.current);
    messageUpdateBufferRef.current.clear();
    
    setMessages((prevMessages) => {
      let updatedMessages = [...prevMessages];
      
      for (const [, { part, delta }] of updates) {
        // 查找对应的消息
        const messageIndex = updatedMessages.findIndex(
          (m) => m.info.id === part.messageID
        );
        
        if (messageIndex === -1) {
          // 消息不存在，创建新的助手消息
          const newMessage: Message = {
            info: {
              id: part.messageID,
              sessionID: part.sessionID,
              role: "assistant",
              time: { created: Date.now() },
              parentID: "",
              modelID: "",
              providerID: "",
              mode: "chat",
              agent: "coder",
              path: { cwd: "", root: "" },
              cost: 0,
              tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            },
            parts: [part as unknown as Part],
          };
          updatedMessages = [...updatedMessages, newMessage];
          continue;
        }
        
        // 更新现有消息的 part
        const message = { ...updatedMessages[messageIndex] };
        const partIndex = message.parts.findIndex((p) => p.id === part.id);
        
        if (partIndex === -1) {
          // Part 不存在，添加新的 part
          message.parts = [...message.parts, part as unknown as Part];
        } else {
          // 更新现有 part
          const updatedParts = [...message.parts];
          // 如果是文本类型且有 delta，使用增量更新
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
        
        // 移除临时占位消息（step-start）
        message.parts = message.parts.filter(
          (p) => !p.id.startsWith("temp-")
        );
        
        updatedMessages[messageIndex] = message;
      }
      
      return updatedMessages;
    });
  }, []);
  
  // 调度批量更新（使用 requestAnimationFrame 优化性能）
  const scheduleFlush = useCallback(() => {
    if (updateFlushTimerRef.current) return;
    
    // 使用 requestAnimationFrame 批量更新，减少重渲染
    updateFlushTimerRef.current = setTimeout(() => {
      updateFlushTimerRef.current = null;
      flushMessageUpdates();
    }, 16); // 约 60fps
  }, [flushMessageUpdates]);

  // 订阅 SSE 事件，实现流式消息更新
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = onEvent((event: OpencodeEvent) => {
      // 只处理与当前会话相关的事件
      const currentSessionId = activeSessionIdRef.current;
      
      switch (event.type) {
        case "message.part.updated": {
          // 流式内容更新 - 核心事件
          // 优化：使用批量更新缓冲区
          const { part, delta } = event.properties;
          if (part.sessionID !== currentSessionId) return;

          const partKey = `${part.messageID}:${part.id}`;
          const existing = messageUpdateBufferRef.current.get(partKey);
          
          if (existing && part.type === "text" && delta !== undefined) {
            // 合并增量更新
            existing.delta = (existing.delta || "") + delta;
            existing.part = part;
          } else {
            messageUpdateBufferRef.current.set(partKey, { part, delta });
          }
          
          scheduleFlush();
          break;
        }

        case "message.updated": {
          // 消息元数据更新
          const { info } = event.properties;
          if (info.sessionID !== currentSessionId) return;

          setMessages((prevMessages) => {
            const messageIndex = prevMessages.findIndex(
              (m) => m.info.id === info.id
            );
            
            if (messageIndex === -1) {
              // 消息不存在，尝试替换对应的临时消息
              // 根据服务器事件顺序：message.updated 先于 message.part.updated 到达
              // 所以在这里替换临时消息是正确的时机
              
              if (info.role === "user") {
                // 查找临时用户消息
                const tempUserIndex = prevMessages.findIndex(
                  (m) => m.info.id.startsWith("temp-user-")
                );
                
                if (tempUserIndex !== -1) {
                  const updatedMessages = [...prevMessages];
                  const tempMessage = updatedMessages[tempUserIndex];
                  
                  // 用真实的用户消息替换临时消息
                  updatedMessages[tempUserIndex] = {
                    info: info as unknown as UserMessageInfo,
                    parts: tempMessage.parts.filter((p) => !p.id.startsWith("temp-")),
                  };
                  
                  return updatedMessages;
                }
              } else {
                // 查找临时助手消息
                const tempAssistantIndex = prevMessages.findIndex(
                  (m) => m.info.id.startsWith("temp-assistant-")
                );
                
                if (tempAssistantIndex !== -1) {
                  const updatedMessages = [...prevMessages];
                  const tempMessage = updatedMessages[tempAssistantIndex];
                  
                  // 用真实的助手消息替换临时消息（保留 loading 状态的 parts）
                  updatedMessages[tempAssistantIndex] = {
                    info: info as unknown as AssistantMessageInfo,
                    parts: tempMessage.parts, // 保留 step-start 占位
                  };
                  
                  return updatedMessages;
                }
              }
              
              // 没有找到匹配的临时消息，忽略此事件
              return prevMessages;
            }

            const updatedMessages = [...prevMessages];
            const message = { ...updatedMessages[messageIndex] };
            
            // 更新消息信息
            if (info.role === "user") {
              message.info = info as unknown as UserMessageInfo;
            } else {
              message.info = info as unknown as AssistantMessageInfo;
            }
            
            updatedMessages[messageIndex] = message;
            return updatedMessages;
          });
          
          // 检查消息是否有错误或已完成 - 重置加载状态
          // 助手消息有 error 字段或 time.completed 时，表示消息处理结束
          if (info.role === "assistant") {
            const assistantInfo = info as { 
              error?: unknown; 
              time?: { completed?: number } 
            };
            if (assistantInfo.error || assistantInfo.time?.completed) {
              setIsLoading(false);
              isGeneratingRef.current = false;
              // 移除临时占位消息
              setMessages((prev) => prev.filter((m) => !m.info.id.startsWith("temp-")));
            }
          }
          break;
        }

        case "session.status": {
          // 会话状态变化
          const { sessionID, status } = event.properties;
          if (sessionID !== currentSessionId) return;

          if (status.type === "idle") {
            // 会话空闲，停止加载状态
            setIsLoading(false);
            isGeneratingRef.current = false;
          } else if (status.type === "busy") {
            // 会话繁忙，设置加载状态
            setIsLoading(true);
            isGeneratingRef.current = true;
          }
          break;
        }

        case "session.updated": {
          // 会话更新（如标题变更）
          const { info } = event.properties;
          setSessions((prev) =>
            prev.map((s) =>
              s.id === info.id ? mapApiSession(info as ApiSession) : s
            )
          );
          break;
        }

        case "session.error": {
          // 会话错误
          const { sessionID, error: sessionError } = event.properties;
          if (sessionID !== currentSessionId) return;
          
          if (sessionError) {
            // 提取错误消息
            // 错误类型结构: { name: string; data: { message: string; ... } }
            // 支持类型: ProviderAuthError, UnknownError, MessageOutputLengthError, MessageAbortedError, ApiError
            const errorData = (sessionError as { data?: { message?: string } }).data;
            const detail = errorData?.message || "";
            // 使用 tRef.current 获取最新的 t 函数
            const errorMessage = detail 
              ? tRef.current("errors.sessionErrorWithDetail", { detail })
              : tRef.current("errors.sessionError");
            setError(errorMessage);
          } else {
            setError(tRef.current("errors.sessionError"));
          }
          
          // 立即重置加载状态，避免 UI 一直转圈
          setIsLoading(false);
          isGeneratingRef.current = false;
          
          // 移除临时占位消息
          setMessages((prev) => prev.filter((m) => !m.info.id.startsWith("temp-")));
          break;
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isConnected, onEvent]);

  // ============== 消息操作 ==============

  /** 发送消息 */
  const sendMessage = useCallback(async (content: string) => {
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
    const tempUserMessage: Message = {
      info: {
        id: `temp-user-${Date.now()}`,
        sessionID: activeSessionId,
        role: "user",
        time: { created: Date.now() },
        agent: "user",
        model: {
          providerID: selectedModel.providerId,
          modelID: selectedModel.modelId,
        },
      },
      parts: [
        {
          id: `temp-part-${Date.now()}`,
          sessionID: activeSessionId,
          messageID: `temp-user-${Date.now()}`,
          type: "text",
          text: content,
        },
      ],
    };
    
    setMessages((prev) => [...prev, tempUserMessage]);
    
    // 添加一个占位的助手消息（表示正在加载）
    const tempAssistantMessage: Message = {
      info: {
        id: `temp-assistant-${Date.now()}`,
        sessionID: activeSessionId,
        role: "assistant",
        time: { created: Date.now() },
        parentID: tempUserMessage.info.id,
        modelID: selectedModel.modelId,
        providerID: selectedModel.providerId,
        mode: "chat",
        agent: "coder",
        path: { cwd: "", root: "" },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      },
      parts: [
        {
          id: `temp-loading-${Date.now()}`,
          sessionID: activeSessionId,
          messageID: `temp-assistant-${Date.now()}`,
          type: "step-start",
        },
      ],
    };
    
    setMessages((prev) => [...prev, tempAssistantMessage]);
    
    try {
      // 使用 session.promptAsync() 发送消息（异步，响应通过 SSE 事件流式返回）
      // SDK 参数: sessionID, parts, model: { providerID, modelID }
      const response = await client.session.promptAsync({
        sessionID: activeSessionId,
        parts: [{ type: "text", text: content }],
        model: {
          providerID: selectedModel.providerId,
          modelID: selectedModel.modelId,
        },
      });
      
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
        setMessages((prev) => prev.filter((m) => !m.info.id.startsWith("temp-")));
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
      setMessages((prev) => prev.filter((m) => !m.info.id.startsWith("temp-")));
      setIsLoading(false);
      isGeneratingRef.current = false;
    }
    // 注意：不在 finally 中关闭 isLoading，由 SSE 事件控制
  }, [client, activeSessionId, selectedModel, isLoading, sessions, t]);

  /** 停止生成 */
  const stopGeneration = useCallback(async () => {
    if (!client || !activeSessionId) return;
    
    try {
      // SDK 使用 sessionID 参数
      await client.session.abort({ sessionID: activeSessionId });
    } catch (e) {
      console.error("停止生成失败:", e);
    } finally {
      setIsLoading(false);
      isGeneratingRef.current = false;
      
      // 刷新消息
      await loadMessages(activeSessionId);
    }
  }, [client, activeSessionId, loadMessages]);

  // ============== 模型操作 ==============

  /** 刷新 providers 和 models */
  const refreshProviders = useCallback(async () => {
    if (!client) return;
    
    setIsLoadingModels(true);
    
    try {
      // 获取 providers 列表
      const providerResponse = await client.provider.list();
      
      if (providerResponse.data) {
        // response.data 包含 { all, connected, default }
        // SDK 返回的 Provider 类型比我们需要的更复杂，只提取我们需要的字段
        const providerData = providerResponse.data;
        
        const all = providerData.all as Array<{
          id: string;
          name: string;
          models: Record<string, { id: string; name: string }>;
        }>;
        const connected = providerData.connected as string[];
        // default 是一个 map: { [agentName: string]: "provider/modelId" }
        // 例如: { "coder": "anthropic/claude-3-5-sonnet", "task": "openai/gpt-4" }
        const defaultModels = providerData.default as Record<string, string> | undefined;
        
        // 只显示已连接的 providers
        const connectedProviders = all
          .filter((p) => connected.includes(p.id))
          .map((p) => ({
            id: p.id,
            name: p.name,
            models: Object.entries(p.models).map(([modelId, model]) => ({
              id: modelId,
              name: model.name,
              provider: p.id,
            })),
          }));
        
        setProviders(connectedProviders);
        
        // 如果没有选择模型，按优先级选择：
        // 1. 从 localStorage 获取已保存的模型（用户上次的选择）
        // 2. 使用 provider.list() 返回的默认模型
        // 3. 选择第一个可用的模型
        // 使用 ref 获取最新的 selectedModel 值，避免闭包问题
        if (!selectedModelRef.current) {
          let modelSet = false;
          
          // 优先级 1: 从 localStorage 读取已保存的模型
          try {
            const savedModelStr = localStorage.getItem(MODEL_STORAGE_KEY);
            if (savedModelStr) {
              const savedModel = JSON.parse(savedModelStr) as { providerId?: string; modelId?: string };
              if (savedModel.providerId && savedModel.modelId) {
                // 验证模型是否存在于已连接的 providers 中
                const providerExists = connectedProviders.find((p) => p.id === savedModel.providerId);
                const modelExists = providerExists?.models.find((m) => m.id === savedModel.modelId);
                if (providerExists && modelExists) {
                  setSelectedModel({
                    providerId: savedModel.providerId,
                    modelId: savedModel.modelId,
                  });
                  modelSet = true;
                }
              }
            }
          } catch {
            // 忽略 localStorage 读取错误
          }
          
          // 优先级 2: 使用 provider.list() 返回的默认模型
          // defaultModels 格式: { "coder": "provider/modelId", ... }
          // 使用 "coder" agent 的默认模型
          if (!modelSet && defaultModels) {
            const defaultModelStr = defaultModels["coder"] || Object.values(defaultModels)[0];
            if (defaultModelStr && typeof defaultModelStr === "string" && defaultModelStr.includes("/")) {
              const parts = defaultModelStr.split("/");
              if (parts.length >= 2 && parts[0] && parts[1]) {
                const defaultProviderId = parts[0];
                const defaultModelId = parts.slice(1).join("/");
                // 验证默认模型是否存在
                const providerExists = connectedProviders.find((p) => p.id === defaultProviderId);
                const modelExists = providerExists?.models.find((m) => m.id === defaultModelId);
                if (providerExists && modelExists) {
                  setSelectedModel({
                    providerId: defaultProviderId,
                    modelId: defaultModelId,
                  });
                  modelSet = true;
                }
              }
            }
          }
          
          // 优先级 3: 选择第一个可用的模型
          if (!modelSet && connectedProviders.length > 0 && connectedProviders[0].models.length > 0) {
            const firstProvider = connectedProviders[0];
            const firstModel = firstProvider.models[0];
            setSelectedModel({
              providerId: firstProvider.id,
              modelId: firstModel.id,
            });
          }
        }
      }
    } catch (e) {
      console.error("加载 providers 失败:", e);
    } finally {
      setIsLoadingModels(false);
    }
  }, [client]); // 移除 selectedModel 依赖，使用 ref 来获取最新值

  /** 选择模型（保存到本地 localStorage） */
  const selectModel = useCallback((providerId: string, modelId: string) => {
    const model = { providerId, modelId };
    setSelectedModel(model);
    
    // 保存到 localStorage
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(model));
    } catch (e) {
      console.error("保存模型选择失败:", e);
    }
  }, []);

  // ============== 其他 ==============

  /** 清除错误 */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // 状态
    sessions,
    activeSession,
    messages,
    isLoading,
    error,
    isConnected,
    
    // 模型相关
    providers,
    models,
    selectedModel,
    isLoadingModels,
    
    // 会话操作
    createNewSession,
    selectSession,
    deleteSession,
    
    // 消息操作
    sendMessage,
    stopGeneration,
    
    // 模型操作
    selectModel,
    refreshProviders,
    
    // 其他
    clearError,
    refreshSessions,
  };
}
