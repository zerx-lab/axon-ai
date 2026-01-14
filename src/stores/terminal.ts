/**
 * 终端状态管理
 *
 * 管理终端实例、多标签页、配置和 PTY 通信
 * 遵循 Zustand 最佳实践，支持持久化
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import type {
  TerminalTab,
  TerminalConfig,
  TerminalStatus,
  TerminalTabType,
  QuickCommand,
} from "@/types/terminal";
import {
  DEFAULT_QUICK_COMMANDS,
  DEFAULT_TERMINAL_CONFIG,
  generateTerminalId,
  getDefaultShell,
} from "@/types/terminal";

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
  ptyConnected: boolean;
}

// 终端操作
interface TerminalActions {
  setVisible: (visible: boolean) => void;
  toggleVisible: () => void;
  createTab: (type?: TerminalTabType, cwd?: string) => Promise<string>;
  closeTab: (id: string) => Promise<void>;
  selectTab: (id: string) => void;
  updateTabStatus: (id: string, status: TerminalStatus) => void;
  updateTabPid: (id: string, pid: number) => void;
  renameTab: (id: string, name: string) => void;
  updateConfig: (config: Partial<TerminalConfig>) => void;
  resetConfig: () => void;
  addQuickCommand: (command: Omit<QuickCommand, "id">) => void;
  removeQuickCommand: (id: string) => void;
  updateQuickCommand: (id: string, command: Partial<QuickCommand>) => void;
  resetQuickCommands: () => void;
  sendCommand: (terminalId: string, command: string) => Promise<void>;
  resize: (terminalId: string, rows: number, cols: number) => Promise<void>;
  clearError: () => void;
  initialize: () => void;
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
      ptyConnected: false,

      setVisible: (visible: boolean) => set({ isVisible: visible }),
      toggleVisible: () => set((state) => ({ isVisible: !state.isVisible })),

      createTab: async (type?: TerminalTabType, cwd?: string): Promise<string> => {
        const shellType = type || getDefaultShell();
        const terminalId = generateTerminalId();

        set({ isLoading: true, error: null });

        try {
          const result = await invoke<{ pid: number; name: string }>(
            "create_terminal",
            {
              terminalId,
              shell: shellType,
              cwd: cwd || ".",
            }
          );

          const newTab: TerminalTab = {
            id: terminalId,
            name: result.name || `${shellType}`,
            type: shellType,
            status: "connected",
            cwd: cwd || ".",
            pid: result.pid,
            createdAt: Date.now(),
          };

          set((state) => ({
            tabs: [...state.tabs, newTab],
            activeTabId: terminalId,
            isLoading: false,
            isVisible: true,
          }));

          return terminalId;
        } catch (e) {
          const error = e instanceof Error ? e.message : "创建终端失败";
          set({ error, isLoading: false });
          throw e;
        }
      },

      closeTab: async (id: string) => {
        const { tabs, activeTabId } = get();

        try {
          await invoke("close_terminal", { terminalId: id });
        } catch (e) {
          console.warn("[Terminal] 关闭终端失败:", e);
        }

        const newTabs = tabs.filter((tab) => tab.id !== id);
        let newActiveId = activeTabId;

        if (activeTabId === id) {
          newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
        }

        set({ tabs: newTabs, activeTabId: newActiveId });

        if (newTabs.length === 0) {
          set({ isVisible: false });
        }
      },

      selectTab: (id: string) => set({ activeTabId: id }),

      updateTabStatus: (id: string, status: TerminalStatus) =>
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === id ? { ...tab, status } : tab
          ),
        })),

      updateTabPid: (id: string, pid: number) =>
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === id ? { ...tab, pid } : tab
          ),
        })),

      renameTab: (id: string, name: string) =>
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === id ? { ...tab, name } : tab
          ),
        })),

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

      sendCommand: async (terminalId: string, command: string) => {
        try {
          await invoke("terminal_write", {
            terminalId,
            data: command + "\n",
          });
        } catch (e) {
          const error = e instanceof Error ? e.message : "发送命令失败";
          set({ error });
          throw e;
        }
      },

      resize: async (terminalId: string, rows: number, cols: number) => {
        try {
          await invoke("terminal_resize", {
            terminalId,
            rows,
            cols,
          });
        } catch (e) {
          console.warn("[Terminal] 调整大小失败:", e);
        }
      },

      clearError: () => set({ error: null }),

      initialize: () => {
        set({ ptyConnected: true });
      },
    }),
    terminalStorage
  )
);

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
