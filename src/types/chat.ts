/**
 * Chat types for Axon Desktop
 */

export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatState {
  sessions: Session[];
  activeSessionId: string | null;
  isLoading: boolean;
  error: string | null;
}

// Helper to generate unique IDs
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Create a new empty session
export function createSession(title?: string): Session {
  const id = generateId();
  const now = Date.now();
  return {
    id,
    title: title || "New Chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

// Create a new message
export function createMessage(
  role: MessageRole,
  content: string
): Message {
  return {
    id: generateId(),
    role,
    content,
    timestamp: Date.now(),
  };
}
