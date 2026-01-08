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

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useOpencodeContext } from "@/providers/OpencodeProvider";
import { useWorkspace } from "@/stores/workspace";
import type { Message, Session } from "@/types/chat";

// 导入拆分的模块
import {
  ACTIVE_SESSION_STORAGE_KEY,
  type Provider,
  type SelectedModel,
} from "./types";
import { useSSEHandler } from "./sse";
import {
  useCheckAndRestoreSessionStatus,
  useCreateNewSession,
  useRefreshSessions,
  useSelectSession,
  useDeleteSession,
} from "./sessions";
import { useRefreshProviders, useSelectModel } from "./providers";
import { useLoadMessages, useSendMessage, useStopGeneration } from "./messages";

// 重新导出类型
export type { Model, Provider, SessionStatus, SelectedModel, UseChatReturn } from "./types";

/**
 * 聊天状态管理 Hook
 * 深度集成 OpenCode SDK
 */
export function useChat() {
  const { client, isConnected, onEvent } = useOpencodeContext();
  const { t } = useTranslation();
  const { state: workspaceState } = useWorkspace();
  
  // ============== 状态定义 ==============
  
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
    console.log("[useChat] activeSessionId 变化:", activeSessionId);
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
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  
  // ============== Refs ==============
  
  // 使用 ref 追踪最新的 selectedModel，避免 useCallback 闭包问题
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;
  
  // 用于追踪是否正在生成
  const isGeneratingRef = useRef(false);
  
  // 保存 t 函数的引用（用于事件处理闭包）
  const tRef = useRef(t);
  tRef.current = t;
  
  // 保存当前活动会话 ID 的 ref（用于事件处理闭包）
  const activeSessionIdRef = useRef<string | null>(null);
  activeSessionIdRef.current = activeSessionId;
  
  // ============== 派生状态 ==============
  
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const models = providers.flatMap((p) => p.models);
  
  // 调试：追踪派生状态
  console.log("[useChat] 派生状态计算 - activeSessionId:", activeSessionId, "sessions.length:", sessions.length, "activeSession:", activeSession?.id);

  // ============== 消息操作 Hooks ==============
  
  const loadMessages = useLoadMessages(client, setMessages);
  
  // ============== 会话操作 Hooks ==============
  
  const checkAndRestoreSessionStatus = useCheckAndRestoreSessionStatus(
    client,
    setIsLoading,
    isGeneratingRef
  );
  
  const createNewSession = useCreateNewSession({
    client,
    t,
    defaultDirectory: workspaceState.defaultDirectory,
    setSessions,
    setActiveSessionId,
    setMessages,
    setError,
  });
  
  const refreshSessions = useRefreshSessions(
    {
      client,
      t,
      activeSessionId,
      setSessions,
      setActiveSessionId,
      setError,
      loadMessages,
    },
    checkAndRestoreSessionStatus,
    createNewSession
  );
  
  const selectSession = useSelectSession(
    activeSessionId,
    sessions,
    setActiveSessionId,
    loadMessages,
    checkAndRestoreSessionStatus
  );
  
  const deleteSession = useDeleteSession(
    {
      client,
      t,
      activeSessionId,
      setSessions,
      setActiveSessionId,
      setError,
      loadMessages,
    },
    createNewSession
  );

  // ============== Provider/模型操作 Hooks ==============
  
  const refreshProviders = useRefreshProviders(
    client,
    selectedModelRef,
    setProviders,
    setSelectedModel,
    setIsLoadingModels
  );
  
  const selectModel = useSelectModel(setSelectedModel);

  // ============== 消息发送/停止 Hooks ==============
  
  const sendMessage = useSendMessage({
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
  });
  
  const stopGeneration = useStopGeneration(
    client,
    activeSessionId,
    activeSession,
    setIsLoading,
    isGeneratingRef,
    loadMessages
  );

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
  
  useSSEHandler({
    isConnected,
    onEvent,
    activeSessionIdRef,
    tRef,
    setMessages,
    setIsLoading,
    isGeneratingRef,
    setSessions,
    setError,
  });

  // ============== 其他操作 ==============

  /** 清除错误 */
  const clearError = () => {
    setError(null);
  };

  // ============== 返回值 ==============

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
