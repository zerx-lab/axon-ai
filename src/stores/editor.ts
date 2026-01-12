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
  path: string;
  name: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
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
  openFile: (path: string, name: string) => void;
  setFileContent: (path: string, content: string) => void;
  updateContent: (path: string, content: string) => void;
  setFileSaving: (path: string, isSaving: boolean) => void;
  markAsSaved: (path: string, content: string) => void;
  setFileLoading: (path: string, isLoading: boolean) => void;
  setFileError: (path: string, error: string | null) => void;
  reloadFile: (path: string) => void;
  reloadFileIfOpen: (path: string) => void;
  closeTab: (path: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (path: string) => void;
  setActiveTab: (path: string) => void;
  toggleVisible: () => void;
  setVisible: (visible: boolean) => void;
  restoreFromLayout: (tabs: OpenedTab[], activeTabPath: string | null, isVisible: boolean) => void;
  getTabsForPersistence: () => OpenedTab[];
}

type EditorStore = EditorState & EditorActions;

// 根据文件扩展名获取语言类型
function getLanguageFromPath(path: string): string {
  const fileName = path.split(/[/\\]/).pop()?.toLowerCase() || "";
  
  const fileNameMap: Record<string, string> = {
    dockerfile: "dockerfile",
    makefile: "makefile",
    gnumakefile: "makefile",
    cmakelists: "cmake",
    rakefile: "ruby",
    gemfile: "ruby",
    vagrantfile: "ruby",
    guardfile: "ruby",
    podfile: "ruby",
    fastfile: "ruby",
    appfile: "ruby",
    brewfile: "ruby",
    license: "plaintext",
    readme: "markdown",
    changelog: "markdown",
    authors: "plaintext",
    contributors: "plaintext",
    ".gitignore": "ini",
    ".gitattributes": "ini",
    ".editorconfig": "ini",
    ".env": "shell",
    ".env.local": "shell",
    ".env.development": "shell",
    ".env.production": "shell",
    ".eslintrc": "json",
    ".prettierrc": "json",
    ".babelrc": "json",
    ".npmrc": "ini",
    ".yarnrc": "yaml",
    "tsconfig.json": "json",
    "package.json": "json",
    "composer.json": "json",
    "cargo.toml": "toml",
  };
  
  if (fileNameMap[fileName]) {
    return fileNameMap[fileName];
  }
  
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
      set({ activeTabPath: path, isVisible: true });
    } else {
      const newTab: EditorTab = {
        path,
        name: name || getFileNameFromPath(path),
        content: "",
        originalContent: "",
        isDirty: false,
        isSaving: false,
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

  setFileContent: (path: string, content: string) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.path === path
          ? { ...tab, content, originalContent: content, isDirty: false, isLoading: false, error: null }
          : tab
      ),
    }));
  },

  updateContent: (path: string, content: string) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.path === path
          ? { ...tab, content, isDirty: content !== tab.originalContent }
          : tab
      ),
    }));
  },

  setFileSaving: (path: string, isSaving: boolean) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.path === path ? { ...tab, isSaving } : tab
      ),
    }));
  },

  markAsSaved: (path: string, content: string) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.path === path
          ? { ...tab, originalContent: content, isDirty: false, isSaving: false }
          : tab
      ),
    }));
  },

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

  reloadFile: (path: string) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.path === path
          ? { ...tab, isLoading: true, error: null, content: "", originalContent: "" }
          : tab
      ),
    }));
  },

  reloadFileIfOpen: (path: string) => {
    const { tabs } = get();
    const normalizedPath = path.replace(/\\/g, "/");
    const tab = tabs.find((t) => t.path.replace(/\\/g, "/") === normalizedPath);
    if (tab && !tab.isDirty) {
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.path.replace(/\\/g, "/") === normalizedPath
            ? { ...t, isLoading: true, error: null, content: "", originalContent: "" }
            : t
        ),
      }));
    }
  },

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
    
    const restoredTabs: EditorTab[] = tabs.map((t) => ({
      path: t.path,
      name: t.name,
      language: t.language || getLanguageFromPath(t.path),
      content: "",
      originalContent: "",
      isDirty: false,
      isSaving: false,
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
