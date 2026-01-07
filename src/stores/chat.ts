import { useState, useCallback } from "react";
import {
  type Message,
  type Session,
  createSession,
  createMessage,
} from "@/types/chat";

interface UseChatReturn {
  // State
  sessions: Session[];
  activeSession: Session | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;

  // Actions
  createNewSession: () => void;
  selectSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  clearError: () => void;
}

/**
 * Chat state management hook
 * Manages sessions, messages, and interaction with AI backend
 */
export function useChat(): UseChatReturn {
  const [sessions, setSessions] = useState<Session[]>(() => {
    // Initialize with one session
    return [createSession()];
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    () => sessions[0]?.id ?? null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived state
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const messages = activeSession?.messages ?? [];

  // Create a new session
  const createNewSession = useCallback(() => {
    const newSession = createSession();
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  }, []);

  // Select a session
  const selectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  // Delete a session
  const deleteSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== sessionId);
        // If we deleted the active session, select the first remaining one
        if (sessionId === activeSessionId) {
          if (filtered.length === 0) {
            // Create a new session if all were deleted
            const newSession = createSession();
            setActiveSessionId(newSession.id);
            return [newSession];
          }
          setActiveSessionId(filtered[0].id);
        }
        return filtered;
      });
    },
    [activeSessionId]
  );

  // Send a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeSessionId || isLoading) return;

      // Add user message
      const userMessage = createMessage("user", content);

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== activeSessionId) return session;
          return {
            ...session,
            messages: [...session.messages, userMessage],
            updatedAt: Date.now(),
            // Update title from first message if it's a new chat
            title:
              session.messages.length === 0
                ? content.slice(0, 50) + (content.length > 50 ? "..." : "")
                : session.title,
          };
        })
      );

      setIsLoading(true);
      setError(null);

      try {
        // TODO: Replace with actual OpenCode API call
        // For now, simulate a response
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const assistantMessage = createMessage(
          "assistant",
          "This is a placeholder response. The OpenCode API integration is not yet implemented."
        );

        setSessions((prev) =>
          prev.map((session) => {
            if (session.id !== activeSessionId) return session;
            return {
              ...session,
              messages: [...session.messages, assistantMessage],
              updatedAt: Date.now(),
            };
          })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    },
    [activeSessionId, isLoading]
  );

  // Stop generation
  const stopGeneration = useCallback(() => {
    // TODO: Implement actual cancellation with OpenCode API
    setIsLoading(false);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    sessions,
    activeSession,
    messages,
    isLoading,
    error,
    createNewSession,
    selectSession,
    deleteSession,
    sendMessage,
    stopGeneration,
    clearError,
  };
}
