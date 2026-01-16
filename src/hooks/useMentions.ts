/**
 * useMentions hook
 *
 * 管理 @ 提及状态（文件、Agent、MCP 资源）
 * 提供添加、删除、清空和构建 Part 的方法
 */

import { useState, useCallback, useMemo } from "react";

// ============== 类型定义 ==============

/**
 * 文件提及
 */
export interface FileMention {
  type: "file";
  /** 唯一标识 */
  id: string;
  /** 相对路径 */
  path: string;
  /** 绝对路径 */
  absolutePath: string;
  /** 文件内容 */
  content: string;
  /** 显示文本 @filename */
  displayText: string;
}

/**
 * Agent 提及
 */
export interface AgentMention {
  type: "agent";
  /** 唯一标识 */
  id: string;
  /** Agent 名称 */
  name: string;
  /** 显示文本 @agentname */
  displayText: string;
}

/**
 * MCP 资源提及
 */
export interface ResourceMention {
  type: "resource";
  /** 唯一标识 */
  id: string;
  /** 资源 URI */
  uri: string;
  /** MCP 客户端名称 */
  clientName: string;
  /** 资源名称 */
  name: string;
  /** 显示文本 @resourcename */
  displayText: string;
}

/**
 * 提及联合类型
 */
export type Mention = FileMention | AgentMention | ResourceMention;

// ============== Part 类型（用于 SDK） ==============

/**
 * 文件 Part（发送给 SDK）
 */
export interface FilePartForSdk {
  type: "file";
  mime: string;
  url: string;
  filename: string;
  source: {
    type: "file";
    path: string;
    text: {
      value: string;
      start: number;
      end: number;
    };
  };
}

/**
 * Agent Part（发送给 SDK）
 */
export interface AgentPartForSdk {
  type: "agent";
  name: string;
  source: {
    value: string;
    start: number;
    end: number;
  };
}

/**
 * Resource Part（发送给 SDK，使用 file 类型）
 */
export interface ResourcePartForSdk {
  type: "file";
  mime: string;
  url: string;
  source: {
    type: "resource";
    uri: string;
    clientName: string;
    text: {
      value: string;
      start: number;
      end: number;
    };
  };
}

/**
 * 所有 Mention Part 类型
 */
export type MentionPart = FilePartForSdk | AgentPartForSdk | ResourcePartForSdk;

// ============== 辅助函数 ==============

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `mention_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 从路径中提取文件名
 */
function getFilename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

// ============== Hook ==============

export interface UseMentionsReturn {
  /** 当前提及列表 */
  mentions: Mention[];
  /** 是否有提及 */
  hasMentions: boolean;
  /** 添加文件提及 */
  addFileMention: (params: Omit<FileMention, "type" | "id">) => void;
  /** 添加 Agent 提及 */
  addAgentMention: (params: Omit<AgentMention, "type" | "id">) => void;
  /** 添加 MCP 资源提及 */
  addResourceMention: (params: Omit<ResourceMention, "type" | "id">) => void;
  /** 移除提及 */
  removeMention: (id: string) => void;
  /** 清空所有提及 */
  clearMentions: () => void;
  /** 构建 SDK Part 数组 */
  buildParts: () => MentionPart[];
}

/**
 * useMentions hook
 *
 * 管理 @ 提及的状态和操作
 */
export function useMentions(): UseMentionsReturn {
  const [mentions, setMentions] = useState<Mention[]>([]);

  // 添加文件提及
  const addFileMention = useCallback(
    (params: Omit<FileMention, "type" | "id">) => {
      const mention: FileMention = {
        type: "file",
        id: generateId(),
        ...params,
      };
      setMentions((prev) => [...prev, mention]);
    },
    []
  );

  // 添加 Agent 提及
  const addAgentMention = useCallback(
    (params: Omit<AgentMention, "type" | "id">) => {
      const mention: AgentMention = {
        type: "agent",
        id: generateId(),
        ...params,
      };
      setMentions((prev) => [...prev, mention]);
    },
    []
  );

  // 添加 MCP 资源提及
  const addResourceMention = useCallback(
    (params: Omit<ResourceMention, "type" | "id">) => {
      const mention: ResourceMention = {
        type: "resource",
        id: generateId(),
        ...params,
      };
      setMentions((prev) => [...prev, mention]);
    },
    []
  );

  // 移除提及
  const removeMention = useCallback((id: string) => {
    setMentions((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // 清空所有提及
  const clearMentions = useCallback(() => {
    setMentions([]);
  }, []);

  // 构建 SDK Part 数组
  const buildParts = useCallback((): MentionPart[] => {
    return mentions.map((mention): MentionPart => {
      switch (mention.type) {
        case "file":
          return {
            type: "file",
            mime: "text/plain",
            url: `file://${mention.absolutePath}`,
            filename: getFilename(mention.path),
            source: {
              type: "file",
              path: mention.absolutePath,
              text: {
                value: mention.content,
                start: 0,
                end: mention.content.length,
              },
            },
          };

        case "agent":
          return {
            type: "agent",
            name: mention.name,
            source: {
              value: mention.displayText,
              start: 0,
              end: mention.displayText.length,
            },
          };

        case "resource":
          return {
            type: "file",
            mime: "text/plain",
            url: mention.uri,
            source: {
              type: "resource",
              uri: mention.uri,
              clientName: mention.clientName,
              text: {
                value: "",
                start: 0,
                end: 0,
              },
            },
          };
      }
    });
  }, [mentions]);

  // 计算是否有提及
  const hasMentions = useMemo(() => mentions.length > 0, [mentions.length]);

  return {
    mentions,
    hasMentions,
    addFileMention,
    addAgentMention,
    addResourceMention,
    removeMention,
    clearMentions,
    buildParts,
  };
}
