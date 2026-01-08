/**
 * 聊天状态管理 - 会话操作
 * 
 * 包含会话的创建、删除、选择、列表刷新等操作
 */

import { useCallback } from "react";
import type { Session as ApiSession } from "@opencode-ai/sdk/v2";
import type { OpencodeClient } from "@/services/opencode/types";
import type { Session, Message } from "@/types/chat";
import { mapApiSession } from "./utils";

// ============== 类型定义 ==============

/** 会话操作基础依赖项 */
export interface SessionOperationsBaseDeps {
  client: OpencodeClient | null;
  t: (key: string, options?: Record<string, unknown>) => string;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

/** 会话创建依赖项 */
export interface CreateSessionDeps extends SessionOperationsBaseDeps {
  /** 默认工作目录（用于新会话没有指定目录时） */
  defaultDirectory: string;
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

/** 会话刷新依赖项 */
export interface RefreshSessionsDeps extends SessionOperationsBaseDeps {
  activeSessionId: string | null;
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  loadMessages: (sessionId: string, directory?: string) => Promise<void>;
}

/** 会话删除依赖项 */
export interface DeleteSessionDeps extends SessionOperationsBaseDeps {
  activeSessionId: string | null;
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  loadMessages: (sessionId: string, directory?: string) => Promise<void>;
}

// ============== 会话状态恢复 ==============

/**
 * 检查会话状态并恢复运行状态
 * 用于会话切换或页面恢复时，检测是否有正在运行的会话
 */
export function useCheckAndRestoreSessionStatus(
  client: OpencodeClient | null,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  isGeneratingRef: React.MutableRefObject<boolean>
) {
  return useCallback(async (sessionId: string) => {
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
  }, [client, setIsLoading, isGeneratingRef]);
}

// ============== 创建会话 ==============

/**
 * 创建新会话 Hook
 */
export function useCreateNewSession(deps: CreateSessionDeps) {
  const { client, t, defaultDirectory, setSessions, setActiveSessionId, setMessages, setError } = deps;
  
  return useCallback(async (directory?: string) => {
    if (!client) {
      setError(t("errors.serviceNotConnected"));
      return;
    }
    
    // 确保 directory 是字符串类型（防止 React 事件对象被传入）
    // 如果没有传入有效目录，使用默认工作目录
    const validDirectory = typeof directory === "string" && directory.trim() 
      ? directory 
      : defaultDirectory;
    
    try {
      // SDK v2 使用扁平化参数结构: { directory?, parentID?, title?, permission? }
      console.log("[createNewSession] 调用 session.create, directory:", validDirectory, "(默认目录:", defaultDirectory, ")");
      const response = await client.session.create({ directory: validDirectory });
      console.log("[createNewSession] API 响应:", JSON.stringify(response.data, null, 2));
      if (response.data) {
        const newSession = mapApiSession(response.data as ApiSession);
        console.log("[createNewSession] 映射后的会话:", newSession);
        console.log("[createNewSession] 设置 activeSessionId 为:", newSession.id);
        setSessions((prev) => {
          console.log("[createNewSession] 添加会话到列表，当前列表长度:", prev.length);
          return [newSession, ...prev];
        });
        setActiveSessionId(newSession.id);
        setMessages([]);
        console.log("[createNewSession] 完成，新会话 ID:", newSession.id);
      }
    } catch (e) {
      console.error("创建会话失败:", e);
      const detail = e instanceof Error ? e.message : "";
      setError(detail ? t("errors.sendMessageFailedWithDetail", { detail }) : t("errors.createSessionFailed"));
    }
  }, [client, t, defaultDirectory, setSessions, setActiveSessionId, setMessages, setError]);
}

// ============== 刷新会话列表 ==============

/**
 * 刷新会话列表 Hook
 */
export function useRefreshSessions(
  deps: RefreshSessionsDeps,
  checkAndRestoreSessionStatus: (sessionId: string) => Promise<void>,
  createNewSession: (directory?: string) => Promise<void>
) {
  const { client, t, activeSessionId, setSessions, setActiveSessionId, setError, loadMessages } = deps;
  
  return useCallback(async () => {
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
            const sessionDir = mappedSessions.find((s) => s.id === activeSessionId)?.directory;
            await Promise.all([
              loadMessages(activeSessionId, sessionDir),
              checkAndRestoreSessionStatus(activeSessionId),
            ]);
          } else if (mappedSessions.length > 0) {
            // 保存的会话不存在，回退到第一个会话
            console.log(`[useChat] 保存的会话 ${activeSessionId} 不存在，回退到第一个会话`);
            const firstSessionId = mappedSessions[0].id;
            const firstSessionDir = mappedSessions[0].directory;
            setActiveSessionId(firstSessionId);
            await Promise.all([
              loadMessages(firstSessionId, firstSessionDir),
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
          const firstSessionDir = mappedSessions[0].directory;
          setActiveSessionId(firstSessionId);
          await Promise.all([
            loadMessages(firstSessionId, firstSessionDir),
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
  }, [client, activeSessionId, setSessions, setActiveSessionId, setError, loadMessages, checkAndRestoreSessionStatus, createNewSession, t]);
}

// ============== 选择会话 ==============

/**
 * 选择会话 Hook
 */
export function useSelectSession(
  activeSessionId: string | null,
  sessions: Session[],
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>,
  loadMessages: (sessionId: string, directory?: string) => Promise<void>,
  checkAndRestoreSessionStatus: (sessionId: string) => Promise<void>
) {
  return useCallback(async (sessionId: string) => {
    if (sessionId === activeSessionId) return;
    
    // 获取要选择的会话信息
    const sessionToSelect = sessions.find((s) => s.id === sessionId);
    
    setActiveSessionId(sessionId);
    
    // 并行加载消息和检查会话状态
    await Promise.all([
      loadMessages(sessionId, sessionToSelect?.directory),
      checkAndRestoreSessionStatus(sessionId),
    ]);
  }, [activeSessionId, sessions, setActiveSessionId, loadMessages, checkAndRestoreSessionStatus]);
}

// ============== 删除会话 ==============

/**
 * 删除会话 Hook
 */
export function useDeleteSession(
  deps: DeleteSessionDeps,
  createNewSession: (directory?: string) => Promise<void>
) {
  const { client, t, activeSessionId, setSessions, setActiveSessionId, setError, loadMessages } = deps;
  
  return useCallback(async (sessionId: string) => {
    if (!client) return;
    
    // 使用对象来存储删除后需要执行的操作信息
    // 避免在 setState 回调中执行异步操作，同时解决 TypeScript 闭包推断问题
    const deleteContext: {
      nextSession: { id: string; directory?: string } | null;
      shouldCreateNew: boolean;
      sessionDirectory?: string;
    } = {
      nextSession: null,
      shouldCreateNew: false,
      sessionDirectory: undefined,
    };
    
    // 先通过函数式更新获取要删除会话的 directory，同时计算删除后的状态
    setSessions((prevSessions) => {
      const sessionToDelete = prevSessions.find((s) => s.id === sessionId);
      deleteContext.sessionDirectory = sessionToDelete?.directory;
      
      const filteredSessions = prevSessions.filter((s) => s.id !== sessionId);
      
      // 如果删除的是当前活动会话，计算下一个要选择的会话
      if (sessionId === activeSessionId) {
        if (filteredSessions.length > 0) {
          deleteContext.nextSession = {
            id: filteredSessions[0].id,
            directory: filteredSessions[0].directory,
          };
        } else {
          deleteContext.shouldCreateNew = true;
        }
      }
      
      return filteredSessions;
    });
    
    try {
      // SDK v2 使用扁平化参数结构: { sessionID, directory? }
      await client.session.delete({ sessionID: sessionId, directory: deleteContext.sessionDirectory });
      
      // 如果删除的是当前会话，选择下一个
      if (sessionId === activeSessionId) {
        if (deleteContext.nextSession) {
          setActiveSessionId(deleteContext.nextSession.id);
          // 异步加载消息
          await loadMessages(deleteContext.nextSession.id, deleteContext.nextSession.directory);
        } else if (deleteContext.shouldCreateNew) {
          // 创建新会话
          await createNewSession();
        }
      }
    } catch (e) {
      console.error("删除会话失败:", e);
      const detail = e instanceof Error ? e.message : "";
      setError(detail ? t("errors.sendMessageFailedWithDetail", { detail }) : t("errors.deleteSessionFailed"));
    }
  }, [client, activeSessionId, setSessions, setActiveSessionId, setError, loadMessages, createNewSession, t]);
}
