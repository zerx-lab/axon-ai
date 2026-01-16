/**
 * 终端实例组件
 *
 * 每个 PTY 对应一个独立的终端实例
 * 基于 opencode desktop 的 terminal.tsx 实现
 */

import { useEffect, useRef, useCallback } from "react";
import type {
  Terminal as GhosttyTerminal,
  FitAddon,
  Ghostty,
} from "ghostty-web";
import { useTerminalConnection } from "@/stores/terminal";
import { useTheme } from "@/stores/theme";
import { SerializeAddon } from "./addons/serialize";
import type { TerminalTab } from "@/stores/terminal";

interface TerminalInstanceProps {
  tab: TerminalTab;
  onCleanup?: (tab: TerminalTab) => void;
}

// 终端颜色配置
interface TerminalColors {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
}

// 默认终端颜色（与 opencode 一致）
const DEFAULT_TERMINAL_COLORS: Record<"light" | "dark", TerminalColors> = {
  light: {
    background: "#fcfcfc",
    foreground: "#211e1e",
    cursor: "#211e1e",
    selectionBackground: "rgba(33, 30, 30, 0.2)",
  },
  dark: {
    background: "#191515",
    foreground: "#d4d4d4",
    cursor: "#d4d4d4",
    selectionBackground: "rgba(212, 212, 212, 0.25)",
  },
};

export function TerminalInstance({ tab, onCleanup }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<GhosttyTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const serializeAddonRef = useRef<SerializeAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const ghosttyRef = useRef<Ghostty | null>(null);

  const { endpoint, directory, client } = useTerminalConnection();
  const { isDark } = useTheme();

  // 根据当前主题计算终端颜色（组件挂载时确定，主题变化时会重新挂载）
  const terminalColors: TerminalColors = isDark
    ? DEFAULT_TERMINAL_COLORS.dark
    : DEFAULT_TERMINAL_COLORS.light;

  // 聚焦终端
  const focusTerminal = useCallback(() => {
    const t = termRef.current;
    if (!t) return;
    t.focus();
    setTimeout(() => t.textarea?.focus(), 0);
  }, []);

  // 点击处理
  const handlePointerDown = useCallback(() => {
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      activeElement !== containerRef.current
    ) {
      activeElement.blur();
    }
    focusTerminal();
  }, [focusTerminal]);

  // 初始化终端和 WebSocket 连接
  useEffect(() => {
    if (!containerRef.current || !endpoint || !directory) return;

    let disposed = false;
    let ws: WebSocket | undefined;
    let term: GhosttyTerminal | undefined;
    let ghostty: Ghostty | undefined;
    let fitAddon: FitAddon | undefined;
    let serializeAddon: SerializeAddon | undefined;
    let handleResize: (() => void) | undefined;
    let handleTextareaFocus: (() => void) | undefined;
    let handleTextareaBlur: (() => void) | undefined;

    const init = async () => {
      try {
        console.log("[TerminalInstance] 初始化:", tab.id);

        // 加载 ghostty-web
        const mod = await import("ghostty-web");
        ghostty = await mod.Ghostty.load();
        ghosttyRef.current = ghostty;

        if (disposed) return;

        // 建立 WebSocket 连接
        const wsUrl = `${endpoint.replace(/^http/, "ws")}/pty/${tab.id}/connect?directory=${encodeURIComponent(directory)}`;
        console.log("[TerminalInstance] 连接 WebSocket:", wsUrl);

        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        // 创建终端
        term = new mod.Terminal({
          cursorBlink: true,
          cursorStyle: "bar",
          fontSize: 14,
          fontFamily: "IBM Plex Mono, monospace",
          allowTransparency: true,
          theme: terminalColors,
          scrollback: 10000,
          ghostty,
        });
        termRef.current = term;

        // 加载插件
        fitAddon = new mod.FitAddon();
        serializeAddon = new SerializeAddon();
        term.loadAddon(serializeAddon);
        term.loadAddon(fitAddon);

        fitAddonRef.current = fitAddon;
        serializeAddonRef.current = serializeAddon;

        // 打开终端
        term.open(containerRef.current!);

        // 复制功能
        term.attachCustomKeyEventHandler((event) => {
          const key = event.key.toLowerCase();

          // Ctrl+Shift+C 复制
          if (
            event.ctrlKey &&
            event.shiftKey &&
            !event.metaKey &&
            key === "c"
          ) {
            const selection = term?.getSelection();
            if (selection) {
              navigator.clipboard.writeText(selection).catch(() => {});
            }
            return true;
          }

          // Cmd+C (macOS) 复制
          if (event.metaKey && !event.ctrlKey && !event.altKey && key === "c") {
            if (!term?.hasSelection()) return true;
            const selection = term?.getSelection();
            if (selection) {
              navigator.clipboard.writeText(selection).catch(() => {});
            }
            return true;
          }

          // Ctrl+` 允许穿透
          if (event.ctrlKey && key === "`") {
            return true;
          }

          return false;
        });

        // 焦点处理
        handleTextareaFocus = () => {
          if (term) term.options.cursorBlink = true;
        };
        handleTextareaBlur = () => {
          if (term) term.options.cursorBlink = false;
        };
        term.textarea?.addEventListener("focus", handleTextareaFocus);
        term.textarea?.addEventListener("blur", handleTextareaBlur);

        // 聚焦
        focusTerminal();

        // 恢复之前的 buffer（如果有）
        if (tab.buffer) {
          if (tab.rows && tab.cols) {
            term.resize(tab.cols, tab.rows);
          }
          term.write(tab.buffer, () => {
            if (tab.scrollY) {
              term?.scrollToLine(tab.scrollY);
            }
            fitAddon?.fit();
          });
        }

        // 自动监听尺寸变化
        fitAddon.observeResize();
        handleResize = () => fitAddon?.fit();
        window.addEventListener("resize", handleResize);

        // 终端尺寸变化时通知后端
        term.onResize(async (size) => {
          if (ws?.readyState === WebSocket.OPEN && client) {
            await client.pty
              .update({
                ptyID: tab.id,
                size: {
                  cols: size.cols,
                  rows: size.rows,
                },
              })
              .catch(() => {});
          }
        });

        // 用户输入发送到 WebSocket
        term.onData((data) => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        });

        // WebSocket 事件
        ws.addEventListener("open", () => {
          console.log("[TerminalInstance] WebSocket 已连接:", tab.id);
          // 发送初始尺寸
          if (client && term) {
            client.pty
              .update({
                ptyID: tab.id,
                size: {
                  cols: term.cols,
                  rows: term.rows,
                },
              })
              .catch(() => {});
          }
        });

        ws.addEventListener("message", (event) => {
          term?.write(event.data);
        });

        ws.addEventListener("error", (err) => {
          console.error("[TerminalInstance] WebSocket 错误:", err);
        });

        ws.addEventListener("close", () => {
          console.log("[TerminalInstance] WebSocket 已断开:", tab.id);
        });

        console.log("[TerminalInstance] 初始化完成:", tab.id);
      } catch (e) {
        console.error("[TerminalInstance] 初始化失败:", e);
      }
    };

    init();

  // 清理
    return () => {
      disposed = true;
      console.log("[TerminalInstance] 清理:", tab.id);

      if (handleResize) {
        window.removeEventListener("resize", handleResize);
      }

      if (term?.textarea && handleTextareaFocus && handleTextareaBlur) {
        term.textarea.removeEventListener("focus", handleTextareaFocus);
        term.textarea.removeEventListener("blur", handleTextareaBlur);
      }

      // 保存状态以便下次恢复
      if (serializeAddon && onCleanup && term) {
        const buffer = serializeAddon.serialize();
        onCleanup({
          ...tab,
          buffer,
          rows: term.rows,
          cols: term.cols,
          scrollY: term.getViewportY(),
        });
      }

      ws?.close();
      term?.dispose();

      termRef.current = null;
      fitAddonRef.current = null;
      serializeAddonRef.current = null;
      wsRef.current = null;
      ghosttyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id, endpoint, directory]);

  // 注意：ghostty-web 不支持运行时主题切换
  // 主题变化时通过 TerminalPanel 中的 key 变化来重新挂载组件

  return (
    <div
      ref={containerRef}
      className="size-full py-2 font-mono select-text"
      style={{ backgroundColor: terminalColors.background }}
      onPointerDown={handlePointerDown}
      data-component="terminal-instance"
      data-pty-id={tab.id}
    />
  );
}
