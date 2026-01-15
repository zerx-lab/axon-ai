/**
 * 聊天状态管理 - SSE 事件处理
 * 
 * 处理来自 OpenCode 服务器的 SSE 事件，实现流式消息更新
 */

import { useEffect, useCallback, useRef } from "react";
import type {
  Session as ApiSession,
  Part as ApiPart,
} from "@opencode-ai/sdk/v2";
import type { GlobalEvent } from "@/services/opencode/types";
import type { 
  Message, 
  Session, 
  Part, 
  UserMessageInfo, 
  AssistantMessageInfo,
  PermissionRequest,
  QuestionRequest,
  TodoItem,
} from "@/types/chat";
import { mapApiSession } from "./utils";
import { usePermissionStore, shouldAutoAccept } from "@/stores/permission";
import { useQuestionStore } from "@/stores/question";
import { useTodoStore } from "@/stores/todo";
import { useEditor } from "@/stores/editor";
import { handleSubagentSSEEvent } from "@/stores/subagentMessages";

// ============== 类型定义 ==============

interface SSEHandlerParams {
  isConnected: boolean;
  onEvent: (listener: (event: GlobalEvent) => void) => () => void;
  activeSessionIdRef: React.MutableRefObject<string | null>;
  tRef: React.MutableRefObject<(key: string, options?: Record<string, unknown>) => string>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isGeneratingRef: React.MutableRefObject<boolean>;
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * SSE 事件处理 Hook
 * 
 * 订阅 SSE 事件，处理流式消息更新
 */
export function useSSEHandler({
  isConnected,
  onEvent,
  activeSessionIdRef,
  tRef,
  setMessages,
  setIsLoading,
  isGeneratingRef,
  setSessions,
  setError,
}: SSEHandlerParams) {
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
  }, [setMessages]);
  
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

    const unsubscribe = onEvent((globalEvent: GlobalEvent) => {
      // 从全局事件中提取 directory 和 payload
      const { directory: eventDirectory, payload: event } = globalEvent;
      
      // 只处理与当前会话相关的事件
      const currentSessionId = activeSessionIdRef.current;
      
      // 调试：记录所有事件类型
      if (event.type.startsWith("question")) {
        console.log("[SSE] Question event received:", event.type, event);
      }
      
      // 先检查是否是被追踪的 subagent session 的事件
      // 如果是，交给 subagentMessages store 处理
      if (event.type === "message.part.updated" || event.type === "message.updated") {
        const props = event.properties as Record<string, unknown>;
        const partSessionId = (props?.part as { sessionID?: string } | undefined)?.sessionID;
        const infoSessionId = (props?.info as { sessionID?: string } | undefined)?.sessionID;
        const eventSessionId = partSessionId ?? infoSessionId;
        if (eventSessionId && eventSessionId !== currentSessionId) {
          // 尝试让 subagent 消息 store 处理
          const handled = handleSubagentSSEEvent(event.type, eventSessionId, event.properties);
          if (handled) return;
        }
      }

      // 检查是否是 subagent 的 session.status 事件
      if (event.type === "session.status") {
        const { sessionID } = event.properties;
        if (sessionID && sessionID !== currentSessionId) {
          // 尝试让 subagent 消息 store 处理 session 状态变化
          const handled = handleSubagentSSEEvent(event.type, sessionID, event.properties);
          if (handled) return;
        }
      }

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
          
          if (part.type === "tool") {
            const FILE_EDIT_TOOLS = ["write", "edit", "multiedit", "patch"];
            if (FILE_EDIT_TOOLS.includes(part.tool) && part.state?.status === "completed") {
              const input = part.state.input as { path?: string; file_path?: string; filePath?: string };
              const filePath = input.path || input.file_path || input.filePath;
              if (filePath) {
                setTimeout(() => {
                  useEditor.getState().reloadFileIfOpen(filePath);
                }, 100);
              }
            }
          }
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
          const updatedSession = mapApiSession(info as ApiSession);
          
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== info.id) return s;
              
              // 保留本地会话的 directory（如果已存在）
              // 因为 SSE 事件可能返回服务端的工作目录，而不是创建时传入的目录
              // 只有当本地没有 directory 时才使用 SSE 返回的值
              return {
                ...updatedSession,
                directory: s.directory || updatedSession.directory,
              };
            })
          );
          break;
        }

        case "session.error": {
          // 会话错误
          const { sessionID, error: sessionError } = event.properties;
          if (sessionID !== currentSessionId) return;
          
          // 立即重置加载状态，避免 UI 一直转圈
          setIsLoading(false);
          isGeneratingRef.current = false;
          
          // 移除临时占位消息
          setMessages((prev) => prev.filter((m) => !m.info.id.startsWith("temp-")));
          
          if (sessionError) {
            // 提取错误信息
            // 错误类型结构: { name: string; data: { message: string; ... } }
            // 支持类型: ProviderAuthError, UnknownError, MessageOutputLengthError, MessageAbortedError, ApiError
            const errorName = (sessionError as { name?: string }).name;
            
            // MessageAbortedError 是用户主动取消，不应该在顶部显示错误提示
            // 这是正常的用户操作，不是真正的错误
            if (errorName === "MessageAbortedError") {
              console.log("[SSE] 用户主动取消消息生成");
              break;
            }
            
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
          break;
        }

        case "permission.asked": {
          // 权限请求事件
          // 附带 directory 信息，用于后续权限回复
          const permissionRequest: PermissionRequest = {
            ...(event.properties as Omit<PermissionRequest, "directory">),
            directory: eventDirectory,
          };
          
          // 检查是否应该自动批准
          const isAutoAccepting = usePermissionStore.getState().isAutoAccepting(permissionRequest.sessionID);
          if (isAutoAccepting && shouldAutoAccept(permissionRequest)) {
            // 自动批准 - 立即响应
            console.log("[SSE] 自动批准权限请求:", permissionRequest.id);
            // 实际的自动响应会在 PermissionPrompt 组件中处理
          }
          
          // 添加到待处理列表（包含 directory 信息）
          usePermissionStore.getState().addRequest(permissionRequest);
          break;
        }

        case "permission.replied": {
          // 权限回复事件
          const { sessionID, requestID } = event.properties as { 
            sessionID: string; 
            requestID: string 
          };
          
          // 从待处理列表移除
          usePermissionStore.getState().removeRequest(requestID, sessionID);
          break;
        }

        case "question.asked" as never: {
          const questionRequest: QuestionRequest = {
            ...(event as unknown as {properties: QuestionRequest}).properties,
            directory: eventDirectory,
          };
          useQuestionStore.getState().addRequest(questionRequest);
          break;
        }

        case "question.replied" as never: {
          const { sessionID, requestID } = (event as unknown as {properties: {sessionID: string; requestID: string}}).properties;
          useQuestionStore.getState().removeRequest(requestID, sessionID);
          break;
        }

        case "question.rejected" as never: {
          const { sessionID, requestID } = (event as unknown as {properties: {sessionID: string; requestID: string}}).properties;
          useQuestionStore.getState().removeRequest(requestID, sessionID);
          break;
        }

        case "todo.updated": {
          const { sessionID, todos } = event.properties as {
            sessionID: string;
            todos: TodoItem[];
          };
          useTodoStore.getState().updateTodos(sessionID, todos);
          break;
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isConnected, onEvent, activeSessionIdRef, tRef, setMessages, setIsLoading, isGeneratingRef, setSessions, setError, scheduleFlush]);
}
