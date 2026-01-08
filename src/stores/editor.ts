/**
 * 编辑器面板状态管理
 * 
 * 管理文件预览/编辑面板的状态：
 * - 当前打开的文件列表（Tab）
 * - 活动文件
 * - 面板可见性
 * 
 * 注意：持久化由 layout store 统一处理，与 Rust 后端同步
 */

import { create } from "zustand";
import type { OpenedTab } from "./layout";

// 打开的文件标签
export interface EditorTab {
  // 文件路径（唯一标识）
  path: string;
  // 文件名（用于显示）
  name: string;
  // 文件内容
  content: string;
  // 是否正在加载
  isLoading: boolean;
  // 加载错误信息
  error: string | null;
  // 文件语言类型（用于语法高亮）
  language: string;
}

interface EditorState {
  // 打开的标签页列表
  tabs: EditorTab[];
  // 当前活动的标签页路径
  activeTabPath: string | null;
  // 编辑器面板是否可见
  isVisible: boolean;
}

interface EditorActions {
  // 打开文件（添加或激活标签页）
  openFile: (path: string, name: string) => void;
  // 设置文件内容
  setFileContent: (path: string, content: string) => void;
  // 设置文件加载状态
  setFileLoading: (path: string, isLoading: boolean) => void;
  // 设置文件错误
  setFileError: (path: string, error: string | null) => void;
  // 关闭标签页
  closeTab: (path: string) => void;
  // 关闭所有标签页
  closeAllTabs: () => void;
  // 关闭其他标签页
  closeOtherTabs: (path: string) => void;
  // 激活标签页
  setActiveTab: (path: string) => void;
  // 切换编辑器面板可见性
  toggleVisible: () => void;
  // 设置编辑器面板可见性
  setVisible: (visible: boolean) => void;
  // 从布局恢复状态（用于初始化）
  restoreFromLayout: (tabs: OpenedTab[], activeTabPath: string | null, isVisible: boolean) => void;
  // 获取当前标签页用于持久化
  getTabsForPersistence: () => OpenedTab[];
}

type EditorStore = EditorState & EditorActions;

// 根据文件扩展名获取语言类型
function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    mjs: "javascript",
    cjs: "javascript",
    // Web
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    // Data
    json: "json",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    // Markdown
    md: "markdown",
    mdx: "markdown",
    // Systems
    rs: "rust",
    go: "go",
    py: "python",
    rb: "ruby",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    // Shell
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    ps1: "powershell",
    // Config
    ini: "ini",
    conf: "ini",
    env: "shell",
    // SQL
    sql: "sql",
    // Docker
    dockerfile: "dockerfile",
  };
  return languageMap[ext] || "plaintext";
}

// 从路径获取文件名
function getFileNameFromPath(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

export const useEditor = create<EditorStore>()((set, get) => ({
  // 初始状态
  tabs: [],
  activeTabPath: null,
  isVisible: false,

  // 打开文件
  openFile: (path: string, name: string) => {
    const { tabs } = get();
    const existingTab = tabs.find((t) => t.path === path);

    if (existingTab) {
      // 文件已打开，只激活它
      set({ activeTabPath: path, isVisible: true });
    } else {
      // 创建新标签页
      const newTab: EditorTab = {
        path,
        name: name || getFileNameFromPath(path),
        content: "",
        isLoading: true,
        error: null,
        language: getLanguageFromPath(path),
      };
      set({
        tabs: [...tabs, newTab],
        activeTabPath: path,
        isVisible: true,
      });
    }
  },

  // 设置文件内容
  setFileContent: (path: string, content: string) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.path === path
          ? { ...tab, content, isLoading: false, error: null }
          : tab
      ),
    }));
  },

  // 设置文件加载状态
  setFileLoading: (path: string, isLoading: boolean) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.path === path ? { ...tab, isLoading } : tab
      ),
    }));
  },

  // 设置文件错误
  setFileError: (path: string, error: string | null) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.path === path ? { ...tab, error, isLoading: false } : tab
      ),
    }));
  },

  // 关闭标签页
  closeTab: (path: string) => {
    const { tabs, activeTabPath } = get();
    const newTabs = tabs.filter((t) => t.path !== path);

    // 如果关闭的是当前活动标签，切换到相邻标签
    let newActiveTab = activeTabPath;
    if (activeTabPath === path) {
      const closedIndex = tabs.findIndex((t) => t.path === path);
      if (newTabs.length > 0) {
        // 优先选择右侧标签，否则选择左侧
        newActiveTab =
          newTabs[Math.min(closedIndex, newTabs.length - 1)]?.path || null;
      } else {
        newActiveTab = null;
      }
    }

    set({
      tabs: newTabs,
      activeTabPath: newActiveTab,
      // 如果没有标签了，隐藏面板
      isVisible: newTabs.length > 0,
    });
  },

  // 关闭所有标签页
  closeAllTabs: () => {
    set({
      tabs: [],
      activeTabPath: null,
      isVisible: false,
    });
  },

  // 关闭其他标签页
  closeOtherTabs: (path: string) => {
    const { tabs } = get();
    const keepTab = tabs.find((t) => t.path === path);
    set({
      tabs: keepTab ? [keepTab] : [],
      activeTabPath: keepTab ? path : null,
      isVisible: !!keepTab,
    });
  },

  // 激活标签页
  setActiveTab: (path: string) => {
    set({ activeTabPath: path });
  },

  // 切换可见性
  toggleVisible: () => {
    set((state) => ({ isVisible: !state.isVisible }));
  },

  // 设置可见性
  setVisible: (visible: boolean) => {
    set({ isVisible: visible });
  },

  // 从布局恢复状态（用于初始化）
  restoreFromLayout: (tabs: OpenedTab[], activeTabPath: string | null, isVisible: boolean) => {
    console.log("[Editor] 从布局恢复:", { tabs, activeTabPath, isVisible });
    
    // 将 OpenedTab 转换为 EditorTab（添加运行时字段）
    const restoredTabs: EditorTab[] = tabs.map((t) => ({
      path: t.path,
      name: t.name,
      language: t.language || getLanguageFromPath(t.path),
      content: "",
      isLoading: true,
      error: null,
    }));

    console.log("[Editor] 恢复的标签页:", restoredTabs);

    set({
      tabs: restoredTabs,
      activeTabPath,
      isVisible,
    });
  },

  // 获取当前标签页用于持久化
  getTabsForPersistence: (): OpenedTab[] => {
    const { tabs } = get();
    return tabs.map((t) => ({
      path: t.path,
      name: t.name,
      language: t.language,
    }));
  },
}));
