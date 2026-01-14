/**
 * 终端类型定义
 *
 * 基于 VSCode 终端设计模式：
 * - 多标签页支持
 * - PTY 进程通信
 * - 终端样式定制
 * - 字体和主题配置
 */

// 终端实例状态
export type TerminalStatus = "connected" | "connecting" | "disconnected" | "error";

// 终端标签页类型
export type TerminalTabType = "bash" | "powershell" | "cmd" | "zsh" | "fish" | "custom";

// 终端配置
export interface TerminalConfig {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  cursorBlink: boolean;
  cursorStyle: "block" | "underline" | "bar";
  theme: TerminalTheme;
  scrollback: number;
  fastScrollModifier: "alt" | "ctrl" | "shift" | "none";
}

// 终端主题
export interface TerminalTheme {
  foreground: string;
  background: string;
  cursor: string;
  cursorAccent: string;
  selection: string;
  selectionForeground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

// 终端 Dark 主题 (VSCode Dark+ 风格)
export const TERMINAL_THEME_DARK: TerminalTheme = {
  foreground: "#cccccc",
  background: "#1c1c1f",
  cursor: "#cccccc",
  cursorAccent: "#1c1c1f",
  selection: "#264f78",
  selectionForeground: "#ffffff",
  black: "#3c3c3c",
  red: "#f14c4c",
  green: "#23d18b",
  yellow: "#f5e543",
  blue: "#4096ff",
  magenta: "#d16969",
  cyan: "#17a2b8",
  white: "#e5e5e5",
  brightBlack: "#666666",
  brightRed: "#ff7878",
  brightGreen: "#3ff23f",
  brightYellow: "#f1fa8c",
  brightBlue: "#4096ff",
  brightMagenta: "#ff92ce",
  brightCyan: "#8be9fd",
  brightWhite: "#ffffff",
};

// 终端 Light 主题 (清爽的 Light 风格)
export const TERMINAL_THEME_LIGHT: TerminalTheme = {
  foreground: "#383a42",
  background: "#f8f9fa",
  cursor: "#383a42",
  cursorAccent: "#f8f9fa",
  selection: "#bfceff",
  selectionForeground: "#383a42",
  black: "#383a42",
  red: "#e45649",
  green: "#50a14f",
  yellow: "#c18401",
  blue: "#1677ff",
  magenta: "#a626a4",
  cyan: "#0184bc",
  white: "#fafafa",
  brightBlack: "#6b7280",
  brightRed: "#e06c75",
  brightGreen: "#98c379",
  brightYellow: "#e5c07b",
  brightBlue: "#4096ff",
  brightMagenta: "#c678dd",
  brightCyan: "#56b6c2",
  brightWhite: "#ffffff",
};

// 默认终端主题 (使用 Dark)
export const DEFAULT_TERMINAL_THEME: TerminalTheme = TERMINAL_THEME_DARK;

// 根据应用主题获取终端主题
export function getTerminalThemeByAppTheme(isDark: boolean): TerminalTheme {
  return isDark ? TERMINAL_THEME_DARK : TERMINAL_THEME_LIGHT;
}

// 默认终端配置
export const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  fontFamily: "'Cascadia Code', 'Fira Code', 'Menlo', 'Monaco', 'Consolas', monospace",
  fontSize: 14,
  lineHeight: 1.2,
  letterSpacing: 0,
  cursorBlink: true,
  cursorStyle: "bar",
  theme: DEFAULT_TERMINAL_THEME,
  scrollback: 1000,
  fastScrollModifier: "alt",
};

// 终端标签页
export interface TerminalTab {
  id: string;
  name: string;
  type: TerminalTabType;
  status: TerminalStatus;
  cwd: string;
  pid?: number;
  createdAt: number;
}

// 终端标签页配置
export interface TerminalTabConfig {
  id: string;
  name: string;
  type: TerminalTabType;
  cwd?: string;
  env?: Record<string, string>;
}

// PTY 进程信息
export interface PtyProcess {
  pid: number;
  cwd: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

// 终端消息类型
export type TerminalMessageType = "data" | "resize" | "status" | "exit" | "error";

// 终端消息
export interface TerminalMessage {
  type: TerminalMessageType;
  terminalId: string;
  data?: string;
  rows?: number;
  cols?: number;
  status?: TerminalStatus;
  exitCode?: number;
  error?: string;
}

// 终端历史记录项
export interface TerminalHistoryItem {
  id: string;
  command: string;
  output: string;
  timestamp: number;
  duration: number;
  success: boolean;
}

// 快速命令项
export interface QuickCommand {
  id: string;
  label: string;
  command: string;
  description?: string;
  icon?: string;
  cwd?: string;
}

// 默认快速命令
export const DEFAULT_QUICK_COMMANDS: QuickCommand[] = [
  {
    id: "clear",
    label: "清屏",
    command: "clear",
    description: "清除终端输出",
  },
  {
    id: "ls",
    label: "列出文件",
    command: "ls -la",
    description: "列出当前目录文件",
  },
  {
    id: "git-status",
    label: "Git 状态",
    command: "git status",
    description: "查看 Git 仓库状态",
  },
  {
    id: "git-log",
    label: "Git 日志",
    command: "git log --oneline -10",
    description: "查看最近提交",
  },
  {
    id: "npm-install",
    label: "安装依赖",
    command: "bun install",
    description: "安装项目依赖",
  },
  {
    id: "npm-run",
    label: "运行脚本",
    command: "bun run",
    description: "运行 npm 脚本",
  },
];

// 生成唯一终端 ID
export function generateTerminalId(): string {
  return `term-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// 根据操作系统获取默认 Shell
export function getDefaultShell(): TerminalTabType {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("win")) {
    return "powershell";
  }
  if (platform.includes("mac")) {
    return "zsh";
  }
  return "bash";
}

// 根据终端类型获取显示名称
export function getTerminalTypeName(type: TerminalTabType): string {
  const names: Record<TerminalTabType, string> = {
    bash: "Bash",
    powershell: "PowerShell",
    cmd: "CMD",
    zsh: "Zsh",
    fish: "Fish",
    custom: "Custom",
  };
  return names[type] || "Terminal";
}

// 根据终端类型获取默认命令
export function getDefaultCommand(type: TerminalTabType): string {
  const commands: Record<TerminalTabType, string> = {
    bash: "bash",
    powershell: "powershell.exe",
    cmd: "cmd.exe",
    zsh: "zsh",
    fish: "fish",
    custom: "sh",
  };
  return commands[type] || "sh";
}
