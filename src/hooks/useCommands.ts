/**
 * useCommands hook
 *
 * 从 OpenCode SDK 加载命令列表，合并内置命令
 * 用于 "/" 斜杠命令补全
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useOpencodeContext } from "@/providers/OpencodeProvider";
import {
  Eraser,
  Sparkles,
  Settings,
  Terminal,
  Plug,
  type LucideIcon,
} from "lucide-react";

/**
 * SDK Command 类型（来自 OpenCode 配置）
 */
export interface SDKCommand {
  name: string;
  description?: string;
  agent?: string;
  model?: string;
  mcp?: boolean;
  template: string;
  subtask?: boolean;
  hints?: string[];
}

/**
 * 统一的 SlashCommand 类型
 */
export interface SlashCommand {
  id: string;
  name: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** action: 直接执行 | prompt: 写入输入框 */
  type: "action" | "prompt";
  /** 来源标识 */
  source: "builtin" | "sdk";
  /** SDK 命令原始数据（仅 source=sdk 时有效） */
  sdkCommand?: SDKCommand;
}

/**
 * 内置命令（前端 action 类型）
 * 这些命令不依赖 SDK，始终可用
 */
export const BUILTIN_COMMANDS: SlashCommand[] = [
  {
    id: "clear",
    name: "clear",
    label: "/clear",
    description: "清空当前会话消息",
    icon: Eraser,
    type: "action",
    source: "builtin",
  },
  {
    id: "new",
    name: "new",
    label: "/new",
    description: "开始新会话",
    icon: Sparkles,
    type: "action",
    source: "builtin",
  },
  {
    id: "settings",
    name: "settings",
    label: "/settings",
    description: "打开设置面板",
    icon: Settings,
    type: "action",
    source: "builtin",
  },
];

export interface UseCommandsOptions {
  /** 项目目录（用于加载项目级命令） */
  directory?: string;
}

export interface UseCommandsReturn {
  /** 所有命令（内置 + SDK） */
  commands: SlashCommand[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 刷新命令列表 */
  refreshCommands: () => Promise<void>;
  /** 根据搜索词过滤命令 */
  filterCommands: (searchText: string) => SlashCommand[];
}

/**
 * useCommands hook
 *
 * 功能：
 * 1. 连接时从 SDK 加载命令
 * 2. 合并内置命令和 SDK 命令
 * 3. 支持按搜索词过滤
 */
export function useCommands(options: UseCommandsOptions = {}): UseCommandsReturn {
  const { directory } = options;
  const { client, isConnected } = useOpencodeContext();
  const [sdkCommands, setSdkCommands] = useState<SDKCommand[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 加载 SDK 命令
  const refreshCommands = useCallback(async () => {
    if (!client || !isConnected) return;

    setIsLoading(true);
    try {
      const response = await client.command.list({ directory });
      if (response.data) {
        setSdkCommands(response.data as SDKCommand[]);
      }
    } catch (e) {
      console.error("[useCommands] 加载命令失败:", e);
    } finally {
      setIsLoading(false);
    }
  }, [client, isConnected, directory]);

  // 连接时自动加载
  useEffect(() => {
    if (isConnected) {
      refreshCommands();
    }
  }, [isConnected, refreshCommands]);

  // 将 SDK 命令转换为 SlashCommand 格式
  const convertedSdkCommands = useMemo((): SlashCommand[] => {
    return sdkCommands.map((cmd) => ({
      id: `sdk-${cmd.name}`,
      name: cmd.name,
      label: `/${cmd.name}${cmd.mcp ? " (MCP)" : ""}`,
      description: cmd.description || cmd.template.slice(0, 50) + "...",
      icon: cmd.mcp ? Plug : Terminal,
      type: "prompt" as const,
      source: "sdk" as const,
      sdkCommand: cmd,
    }));
  }, [sdkCommands]);

  // 合并命令列表（内置在前，SDK 在后）
  const allCommands = useMemo(() => {
    return [...BUILTIN_COMMANDS, ...convertedSdkCommands];
  }, [convertedSdkCommands]);

  // 过滤函数
  const filterCommands = useCallback(
    (searchText: string): SlashCommand[] => {
      if (!searchText) return allCommands;

      const search = searchText.toLowerCase();
      return allCommands.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(search) ||
          cmd.label.toLowerCase().includes(search) ||
          cmd.description.toLowerCase().includes(search)
      );
    },
    [allCommands]
  );

  return {
    commands: allCommands,
    isLoading,
    refreshCommands,
    filterCommands,
  };
}
