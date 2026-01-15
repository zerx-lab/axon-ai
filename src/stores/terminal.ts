/**
 * 终端状态管理
 *
 * 管理终端实例、多标签页、配置
 * 使用 opencode PTY API（WebSocket 通信）
 * 遵循 Zustand 最佳实践，支持持久化
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { OpencodeClient } from "@/services/opencode";
import type {
  TerminalConfig,
  TerminalStatus,
  QuickCommand,
} from "@/types/terminal";
import {
  DEFAULT_QUICK_COMMANDS,
  DEFAULT_TERMINAL_CONFIG,
} from "@/types/terminal";

// 终端标签页（兼容 opencode PTY）
export interface TerminalTab {
  id: string;                // PTY session ID（来自 opencode）
  title: string;             // 显示标题
  titleNumber: number;       // 标题编号（用于 "Terminal 1", "Terminal 2" 等）
  status: TerminalStatus;
  cwd: string;
  pid?: number;
  createdAt: number;
  // 状态恢复相关
  buffer?: string;           // 序列化的终端内容
  rows?: number;
  cols?: number;
  scrollY?: number;
}

type TerminalStore = TerminalState & TerminalActions;

// 终端状态
interface TerminalState {
  isVisible: boolean;
  tabs: TerminalTab[];
  activeTabId: string | null;
  config: TerminalConfig;
  quickCommands: QuickCommand[];
  isLoading: boolean;
  error: string | null;
  // opencode 集成
  _client: OpencodeClient | null;
  _endpoint: string | null;
  _directory: string;
}

// 终端操作
interface TerminalActions {
  // 设置 opencode client 和 endpoint（由 Provider 调用）
  setOpencodeClient: (client: OpencodeClient | null, endpoint: string | null, directory: string) => void;

  // UI 操作
  setVisible: (visible: boolean) => void;
  toggleVisible: () => void;

  // 标签页管理
  createTab: (cwd?: string) => Promise<string>;
  closeTab: (id: string) => Promise<void>;
  clearAllTabs: () => void;
  selectTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<TerminalTab>) => void;
  renameTab: (id: string, title: string) => void;

  // 配置
  updateConfig: (config: Partial<TerminalConfig>) => void;
  resetConfig: () => void;

  // 快速命令
  addQuickCommand: (command: Omit<QuickCommand, "id">) => void;
  removeQuickCommand: (id: string) => void;
  updateQuickCommand: (id: string, command: Partial<QuickCommand>) => void;
  resetQuickCommands: () => void;

  // 错误处理
  clearError: () => void;
  setError: (error: string | null) => void;
}

// 持久化状态
interface PersistState {
  config: TerminalConfig;
  quickCommands: QuickCommand[];
}

// 持久化配置
const terminalStorage = {
  name: "axon-terminal",
  storage: createJSONStorage(() => localStorage),
  partialize: (state: TerminalStore): PersistState => ({
    config: state.config,
    quickCommands: state.quickCommands,
  }),
};

export const useTerminal = create<TerminalStore>()(
  persist(
    (set, get) => ({
      isVisible: false,
      tabs: [],
      activeTabId: null,
      config: DEFAULT_TERMINAL_CONFIG,
      quickCommands: DEFAULT_QUICK_COMMANDS,
      isLoading: false,
      error: null,
      _client: null,
      _endpoint: null,
      _directory: ".",

      setOpencodeClient: (client, endpoint, directory) => {
        set({ _client: client, _endpoint: endpoint, _directory: directory });
      },

      setVisible: (visible: boolean) => set({ isVisible: visible }),
      toggleVisible: () => set((state) => ({ isVisible: !state.isVisible })),

      createTab: async (cwd?: string): Promise<string> => {
        const { _client, _directory, tabs } = get();

        if (!_client) {
          const error = "OpenCode 服务未连接";
          set({ error });
          throw new Error(error);
        }

        set({ isLoading: true, error: null });

        try {
          // 计算下一个标题编号
          const existingNumbers = new Set(tabs.map(t => t.titleNumber));
          let nextNumber = 1;
          while (existingNumbers.has(nextNumber)) {
            nextNumber++;
          }

          // 调用 opencode PTY API 创建会话
          const response = await _client.pty.create({
            directory: _directory,
            title: `Terminal ${nextNumber}`,
            cwd: cwd || _directory,
          });

          const ptyInfo = response.data;
          if (!ptyInfo?.id) {
            throw new Error("创建 PTY 会话失败：未返回会话 ID");
          }

          const newTab: TerminalTab = {
            id: ptyInfo.id,
            title: ptyInfo.title || `Terminal ${nextNumber}`,
            titleNumber: nextNumber,
            status: "connected",
            cwd: ptyInfo.cwd || cwd || _directory,
            pid: ptyInfo.pid,
            createdAt: Date.now(),
          };

          set((state) => ({
            tabs: [...state.tabs, newTab],
            activeTabId: newTab.id,
            isLoading: false,
            isVisible: true,
          }));

          return newTab.id;
        } catch (e) {
          const error = e instanceof Error ? e.message : "创建终端失败";
          set({ error, isLoading: false });
          throw e;
        }
      },

      closeTab: async (id: string) => {
        const { _client, _directory, tabs, activeTabId } = get();

        // 调用 opencode PTY API 移除会话
        if (_client) {
          try {
            await _client.pty.remove({ ptyID: id, directory: _directory });
          } catch (e) {
            console.warn("[Terminal] 关闭终端失败:", e);
          }
        }

        const newTabs = tabs.filter((tab) => tab.id !== id);
        let newActiveId = activeTabId;

        if (activeTabId === id) {
          // 选择相邻的标签页
          const closedIndex = tabs.findIndex(t => t.id === id);
          const nextTab = newTabs[Math.max(0, closedIndex - 1)];
          newActiveId = nextTab?.id || null;
        }

        set({ tabs: newTabs, activeTabId: newActiveId });

        if (newTabs.length === 0) {
          set({ isVisible: false });
        }
      },

      clearAllTabs: () => {
        console.log("[Terminal] 清理所有终端标签页");
        set({ tabs: [], activeTabId: null, isVisible: false });
      },

      selectTab: (id: string) => set({ activeTabId: id }),

      updateTab: (id: string, updates: Partial<TerminalTab>) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === id ? { ...tab, ...updates } : tab
          ),
        }));
      },

      renameTab: (id: string, title: string) => {
        const { _client, _directory } = get();

        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === id ? { ...tab, title } : tab
          ),
        }));

        // 同步到 opencode
        if (_client) {
          _client.pty.update({
            ptyID: id,
            directory: _directory,
            title,
          }).catch(e => console.warn("[Terminal] 更新标题失败:", e));
        }
      },

      updateConfig: (configUpdate: Partial<TerminalConfig>) =>
        set((state) => ({
          config: { ...state.config, ...configUpdate },
        })),

      resetConfig: () => set({ config: DEFAULT_TERMINAL_CONFIG }),

      addQuickCommand: (command: Omit<QuickCommand, "id">) =>
        set((state) => ({
          quickCommands: [
            ...state.quickCommands,
            { ...command, id: `cmd-${Date.now()}` },
          ],
        })),

      removeQuickCommand: (id: string) =>
        set((state) => ({
          quickCommands: state.quickCommands.filter((cmd) => cmd.id !== id),
        })),

      updateQuickCommand: (id: string, commandUpdate: Partial<QuickCommand>) =>
        set((state) => ({
          quickCommands: state.quickCommands.map((cmd) =>
            cmd.id === id ? { ...cmd, ...commandUpdate } : cmd
          ),
        })),

      resetQuickCommands: () =>
        set({ quickCommands: DEFAULT_QUICK_COMMANDS }),

      clearError: () => set({ error: null }),
      setError: (error: string | null) => set({ error }),
    }),
    terminalStorage
  )
);

// 便捷 hooks
export const useTerminalTabs = () => useTerminal((state) => state.tabs);

export const useActiveTerminal = () => {
  const activeTabId = useTerminal((state) => state.activeTabId);
  const config = useTerminal((state) => state.config);
  const isLoading = useTerminal((state) => state.isLoading);
  const error = useTerminal((state) => state.error);
  const tab = useTerminal((state) => state.tabs.find((t) => t.id === activeTabId));

  return { tab, config, isLoading, error };
};

export const useTerminalConfig = () =>
  useTerminal((state) => state.config);

export const useTerminalVisible = () =>
  useTerminal((state) => state.isVisible);

// 获取 opencode 连接信息
export const useTerminalConnection = () => {
  const endpoint = useTerminal((state) => state._endpoint);
  const directory = useTerminal((state) => state._directory);
  const client = useTerminal((state) => state._client);
  return { endpoint, directory, client };
};
