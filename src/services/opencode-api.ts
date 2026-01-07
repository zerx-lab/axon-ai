/**
 * OpenCode API Client
 * Interfaces with the opencode serve HTTP server
 * 
 * API Documentation: https://opencode.ai/docs/server
 */

import { opencode as tauriOpencode } from "./tauri";

// Default server configuration
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4096;

// Types based on OpenCode API spec
export interface Project {
  id: string;
  path: string;
  name: string;
}

export interface Session {
  id: string;
  parentID?: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  share?: {
    id: string;
    url: string;
  };
}

export interface Message {
  id: string;
  sessionID: string;
  role: "user" | "assistant" | "system";
  createdAt: string;
}

export interface Part {
  type: string;
  content?: string;
  // Tool call parts
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  // File parts
  file?: string;
  // Image parts
  image?: string;
  mimeType?: string;
}

export interface MessageWithParts {
  info: Message;
  parts: Part[];
}

export interface Provider {
  id: string;
  name: string;
  models: Model[];
}

export interface Model {
  id: string;
  name: string;
  provider: string;
}

export interface Config {
  model?: string;
  provider?: string;
  agents?: Record<string, unknown>;
}

export interface SessionStatus {
  status: "idle" | "running" | "error";
  error?: string;
}

export interface HealthResponse {
  healthy: boolean;
  version: string;
}

// Event types for SSE
export type ServerEvent = 
  | { type: "server.connected" }
  | { type: "session.created"; data: Session }
  | { type: "session.updated"; data: Session }
  | { type: "session.deleted"; data: { id: string } }
  | { type: "message.created"; data: MessageWithParts }
  | { type: "message.updated"; data: MessageWithParts }
  | { type: "part.updated"; data: { sessionID: string; messageID: string; part: Part } }
  | { type: "unknown"; raw: string };

/**
 * OpenCode API Client class
 */
export class OpenCodeClient {
  private baseUrl: string;
  private eventSource: EventSource | null = null;
  private eventListeners: Map<string, Set<(event: ServerEvent) => void>> = new Map();

  constructor(host: string = DEFAULT_HOST, port: number = DEFAULT_PORT) {
    this.baseUrl = `http://${host}:${port}`;
  }

  /**
   * Update the base URL
   */
  setEndpoint(host: string, port: number): void {
    this.baseUrl = `http://${host}:${port}`;
  }

  /**
   * Get the base URL from Tauri backend if available
   */
  async getEndpointFromTauri(): Promise<string | null> {
    try {
      return await tauriOpencode.getEndpoint();
    } catch {
      return null;
    }
  }

  // ============== Health ==============

  async health(): Promise<HealthResponse> {
    const res = await fetch(`${this.baseUrl}/global/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
  }

  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.health();
      return health.healthy;
    } catch {
      return false;
    }
  }

  // ============== Project ==============

  async listProjects(): Promise<Project[]> {
    const res = await fetch(`${this.baseUrl}/project`);
    if (!res.ok) throw new Error(`Failed to list projects: ${res.status}`);
    return res.json();
  }

  async getCurrentProject(): Promise<Project> {
    const res = await fetch(`${this.baseUrl}/project/current`);
    if (!res.ok) throw new Error(`Failed to get current project: ${res.status}`);
    return res.json();
  }

  // ============== Config ==============

  async getConfig(): Promise<Config> {
    const res = await fetch(`${this.baseUrl}/config`);
    if (!res.ok) throw new Error(`Failed to get config: ${res.status}`);
    return res.json();
  }

  async updateConfig(config: Partial<Config>): Promise<Config> {
    const res = await fetch(`${this.baseUrl}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error(`Failed to update config: ${res.status}`);
    return res.json();
  }

  // ============== Providers ==============

  async listProviders(): Promise<{
    all: Provider[];
    default: Record<string, string>;
    connected: string[];
  }> {
    const res = await fetch(`${this.baseUrl}/provider`);
    if (!res.ok) throw new Error(`Failed to list providers: ${res.status}`);
    return res.json();
  }

  // ============== Sessions ==============

  async listSessions(): Promise<Session[]> {
    const res = await fetch(`${this.baseUrl}/session`);
    if (!res.ok) throw new Error(`Failed to list sessions: ${res.status}`);
    return res.json();
  }

  async createSession(options?: { parentID?: string; title?: string }): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options ?? {}),
    });
    if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
    return res.json();
  }

  async getSession(sessionId: string): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/session/${sessionId}`);
    if (!res.ok) throw new Error(`Failed to get session: ${res.status}`);
    return res.json();
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/session/${sessionId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Failed to delete session: ${res.status}`);
    return res.json();
  }

  async updateSession(sessionId: string, updates: { title?: string }): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/session/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update session: ${res.status}`);
    return res.json();
  }

  async abortSession(sessionId: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/session/${sessionId}/abort`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`Failed to abort session: ${res.status}`);
    return res.json();
  }

  async getSessionStatus(): Promise<Record<string, SessionStatus>> {
    const res = await fetch(`${this.baseUrl}/session/status`);
    if (!res.ok) throw new Error(`Failed to get session status: ${res.status}`);
    return res.json();
  }

  // ============== Messages ==============

  async listMessages(sessionId: string, limit?: number): Promise<MessageWithParts[]> {
    const url = new URL(`${this.baseUrl}/session/${sessionId}/message`);
    if (limit) url.searchParams.set("limit", String(limit));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Failed to list messages: ${res.status}`);
    return res.json();
  }

  async getMessage(sessionId: string, messageId: string): Promise<MessageWithParts> {
    const res = await fetch(`${this.baseUrl}/session/${sessionId}/message/${messageId}`);
    if (!res.ok) throw new Error(`Failed to get message: ${res.status}`);
    return res.json();
  }

  /**
   * Send a message and wait for the complete response
   */
  async sendMessage(
    sessionId: string,
    content: string,
    options?: {
      messageID?: string;
      model?: string;
      agent?: string;
      noReply?: boolean;
      system?: string;
    }
  ): Promise<MessageWithParts> {
    const res = await fetch(`${this.baseUrl}/session/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...options,
        parts: [{ type: "text", content }],
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to send message: ${res.status} - ${errorText}`);
    }
    return res.json();
  }

  /**
   * Send a message asynchronously (returns immediately)
   * Use events to receive the response
   */
  async sendMessageAsync(
    sessionId: string,
    content: string,
    options?: {
      messageID?: string;
      model?: string;
      agent?: string;
      system?: string;
    }
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/session/${sessionId}/prompt_async`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...options,
        parts: [{ type: "text", content }],
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to send async message: ${res.status} - ${errorText}`);
    }
  }

  /**
   * Execute a slash command
   */
  async executeCommand(
    sessionId: string,
    command: string,
    args?: string,
    options?: {
      model?: string;
      agent?: string;
    }
  ): Promise<MessageWithParts> {
    const res = await fetch(`${this.baseUrl}/session/${sessionId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...options,
        command,
        arguments: args ?? "",
      }),
    });
    if (!res.ok) throw new Error(`Failed to execute command: ${res.status}`);
    return res.json();
  }

  // ============== Events (SSE) ==============

  /**
   * Connect to the server-sent events stream
   */
  connectEvents(): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    this.eventSource = new EventSource(`${this.baseUrl}/event`);

    this.eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const serverEvent = this.parseEvent(parsed);
        this.emitEvent(serverEvent);
      } catch (e) {
        console.error("Failed to parse SSE event:", e, event.data);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      // The browser will automatically try to reconnect
    };
  }

  /**
   * Disconnect from the events stream
   */
  disconnectEvents(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Subscribe to server events
   */
  onEvent(callback: (event: ServerEvent) => void): () => void {
    if (!this.eventListeners.has("all")) {
      this.eventListeners.set("all", new Set());
    }
    this.eventListeners.get("all")!.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get("all")?.delete(callback);
    };
  }

  /**
   * Subscribe to specific event types
   */
  onEventType(
    type: ServerEvent["type"],
    callback: (event: ServerEvent) => void
  ): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(callback);

    return () => {
      this.eventListeners.get(type)?.delete(callback);
    };
  }

  private parseEvent(data: unknown): ServerEvent {
    if (typeof data !== "object" || data === null) {
      return { type: "unknown", raw: JSON.stringify(data) };
    }

    const obj = data as Record<string, unknown>;
    const type = obj.type as string;

    switch (type) {
      case "server.connected":
        return { type: "server.connected" };
      case "session.created":
        return { type: "session.created", data: obj.properties as Session };
      case "session.updated":
        return { type: "session.updated", data: obj.properties as Session };
      case "session.deleted":
        return { type: "session.deleted", data: obj.properties as { id: string } };
      case "message.created":
        return { type: "message.created", data: obj.properties as MessageWithParts };
      case "message.updated":
        return { type: "message.updated", data: obj.properties as MessageWithParts };
      case "part.updated":
        return {
          type: "part.updated",
          data: obj.properties as { sessionID: string; messageID: string; part: Part },
        };
      default:
        return { type: "unknown", raw: JSON.stringify(data) };
    }
  }

  private emitEvent(event: ServerEvent): void {
    // Emit to "all" listeners
    this.eventListeners.get("all")?.forEach((cb) => cb(event));
    // Emit to type-specific listeners
    this.eventListeners.get(event.type)?.forEach((cb) => cb(event));
  }
}

// Singleton instance
let clientInstance: OpenCodeClient | null = null;

/**
 * Get the OpenCode API client singleton
 */
export function getOpenCodeClient(): OpenCodeClient {
  if (!clientInstance) {
    clientInstance = new OpenCodeClient();
  }
  return clientInstance;
}

/**
 * Initialize the client with a custom endpoint
 */
export function initOpenCodeClient(host: string, port: number): OpenCodeClient {
  clientInstance = new OpenCodeClient(host, port);
  return clientInstance;
}
