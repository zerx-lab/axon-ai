/**
 * Chat Context Provider
 * 
 * 提供全局的聊天状态管理，确保所有组件共享同一个 chat 状态实例
 */

import { createContext, useContext, type ReactNode } from "react";
import { useChat as useChatHook, type UseChatReturn } from "@/stores/chat";

// 创建 Context
const ChatContext = createContext<UseChatReturn | null>(null);

interface ChatProviderProps {
  children: ReactNode;
}

/**
 * Chat Provider
 * 
 * 包装 useChat hook，使其状态在所有子组件中共享
 */
export function ChatProvider({ children }: ChatProviderProps) {
  // 只在 Provider 层调用一次 useChat
  const chatState = useChatHook();

  return (
    <ChatContext.Provider value={chatState}>
      {children}
    </ChatContext.Provider>
  );
}

/**
 * 使用共享的 Chat 状态
 * 
 * 必须在 ChatProvider 内部使用
 */
export function useChat(): UseChatReturn {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
}
