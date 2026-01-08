/**
 * 聊天状态管理 - 工具函数
 * 
 * 包含数据转换、错误处理等辅助函数
 */

import type {
  Session as ApiSession,
  UserMessage as ApiUserMessage,
  AssistantMessage as ApiAssistantMessage,
  Part as ApiPart,
} from "@opencode-ai/sdk/v2";
import type {
  Message,
  Session,
  Part,
  MessageInfo,
  UserMessageInfo,
  AssistantMessageInfo,
} from "@/types/chat";

// ============== API 数据映射 ==============

/** 从 API 会话转换为本地会话 */
export function mapApiSession(apiSession: ApiSession): Session {
  return {
    id: apiSession.id,
    title: apiSession.title || "新对话",
    directory: apiSession.directory || "",
    projectID: apiSession.projectID || "global",
    // API 返回的是毫秒时间戳
    createdAt: apiSession.time.created,
    updatedAt: apiSession.time.updated,
    parentId: apiSession.parentID,
  };
}

/** 从 API 消息转换为本地消息 */
export function mapApiMessage(apiMessage: {
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

// ============== 错误处理 ==============

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
export function extractErrorDetail(e: unknown): string {
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

// ============== 临时消息创建 ==============

/** 创建临时用户消息 */
export function createTempUserMessage(
  sessionId: string,
  content: string,
  selectedModel: { providerId: string; modelId: string }
): Message {
  const timestamp = Date.now();
  return {
    info: {
      id: `temp-user-${timestamp}`,
      sessionID: sessionId,
      role: "user",
      time: { created: timestamp },
      agent: "user",
      model: {
        providerID: selectedModel.providerId,
        modelID: selectedModel.modelId,
      },
    },
    parts: [
      {
        id: `temp-part-${timestamp}`,
        sessionID: sessionId,
        messageID: `temp-user-${timestamp}`,
        type: "text",
        text: content,
      },
    ],
  };
}

/** 创建临时助手消息（加载状态） */
export function createTempAssistantMessage(
  sessionId: string,
  parentMessageId: string,
  selectedModel: { providerId: string; modelId: string }
): Message {
  const timestamp = Date.now();
  return {
    info: {
      id: `temp-assistant-${timestamp}`,
      sessionID: sessionId,
      role: "assistant",
      time: { created: timestamp },
      parentID: parentMessageId,
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
        id: `temp-loading-${timestamp}`,
        sessionID: sessionId,
        messageID: `temp-assistant-${timestamp}`,
        type: "step-start",
      },
    ],
  };
}

/** 移除临时消息 */
export function filterTempMessages(messages: Message[]): Message[] {
  return messages.filter((m) => !m.info.id.startsWith("temp-"));
}
