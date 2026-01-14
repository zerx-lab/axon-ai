/**
 * 终端面板组件
 *
 * VSCode 风格的终端实现：
 * - 顶部标签栏（Tab Bar）
 * - 终端内容区（xterm.js）
 * - 自动跟随应用主题切换
 * - PTY 双向通信
 */

import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useTerminal, useActiveTerminal } from "@/stores/terminal";
import { useTheme } from "@/stores/theme";
import { getTerminalThemeByAppTheme } from "@/types/terminal";
import { TerminalTabs } from "./TerminalTabs";
import { cn } from "@/lib/utils";
import "@xterm/xterm/css/xterm.css";

// 输出缓冲区 - 用于缓存每个终端的输出（在 xterm 还未准备好时）
const outputBuffers = new Map<string, string[]>();

// 获取或创建缓冲区
function getBuffer(terminalId: string): string[] {
  if (!outputBuffers.has(terminalId)) {
    outputBuffers.set(terminalId, []);
  }
  return outputBuffers.get(terminalId)!;
}

// 清空缓冲区
function clearBuffer(terminalId: string) {
  outputBuffers.delete(terminalId);
}

interface TerminalPanelProps {
  className?: string;
}

// 终端输出事件 payload
interface TerminalOutputPayload {
  terminal_id: string;
  data: string;
}

// 终端退出事件 payload
interface TerminalExitPayload {
  terminal_id: string;
  exit_code: number | null;
}

export function TerminalPanel({ className }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // 使用 ref 保存当前 tab，避免闭包问题
  const activeTabRef = useRef<string | null>(null);
  // 防止自动创建终端的锁（使用 ref 而非全局变量，避免组件卸载后状态残留）
  const isAutoCreatingRef = useRef(false);
  // 记录上一个激活的 tab，用于判断是否需要从 buffer 恢复
  const prevTabRef = useRef<string | null>(null);

  const { isVisible, isLoading, error, config, updateTabStatus, tabs, createTab } = useTerminal();
  const { tab } = useActiveTerminal();
  const { isDark } = useTheme();

  // 保存 updateTabStatus 到 ref，避免闭包问题
  const updateTabStatusRef = useRef(updateTabStatus);
  updateTabStatusRef.current = updateTabStatus;

  // 同步 tab.id 到 ref
  useEffect(() => {
    activeTabRef.current = tab?.id ?? null;
  }, [tab?.id]);

  // 获取当前主题对应的终端主题
  const terminalTheme = getTerminalThemeByAppTheme(isDark);

  // 发送数据到后端 PTY（使用 ref 获取最新的 tab id）
  const sendToPty = useCallback((data: string) => {
    const terminalId = activeTabRef.current;
    if (!terminalId) {
      console.warn("[Terminal] 没有活动的终端");
      return;
    }
    invoke("terminal_write", {
      terminalId,
      data,
    }).catch((e) => console.error("[Terminal] 写入失败:", e));
  }, []);

  // 发送终端大小到后端
  const sendResize = useCallback((rows: number, cols: number) => {
    const terminalId = activeTabRef.current;
    if (!terminalId) return;
    invoke("terminal_resize", {
      terminalId,
      rows,
      cols,
    }).catch((e) => console.error("[Terminal] 调整大小失败:", e));
  }, []);

  // 初始化终端
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const terminal = new Terminal({
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
      lineHeight: config.lineHeight,
      letterSpacing: config.letterSpacing,
      cursorBlink: config.cursorBlink,
      cursorStyle: config.cursorStyle,
      theme: terminalTheme,
      scrollback: config.scrollback,
      convertEol: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(terminalRef.current);

    // 延迟执行 fit，确保 DOM 已完全渲染
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // 监听用户输入，发送到 PTY
    const dataDisposable = terminal.onData((data) => {
      sendToPty(data);
    });

    // 监听终端大小变化
    const resizeDisposable = terminal.onResize(({ rows, cols }) => {
      sendResize(rows, cols);
    });

    // 设置 ResizeObserver 监听终端容器尺寸变化
    const container = terminalRef.current;

    const handleResize = () => {
      if (!container || !fitAddon) return;
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        try {
          fitAddon.fit();
        } catch (e) {
          console.warn("[Terminal] fit error:", e);
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(handleResize);
    });

    resizeObserver.observe(container);
    window.addEventListener("resize", handleResize);

    return () => {
      dataDisposable.dispose();
      resizeDisposable.dispose();
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sendToPty, sendResize]);

  // 监听配置变化
  useEffect(() => {
    if (!xtermRef.current) return;

    xtermRef.current.options.fontFamily = config.fontFamily;
    xtermRef.current.options.fontSize = config.fontSize;
    xtermRef.current.options.lineHeight = config.lineHeight;
    xtermRef.current.options.letterSpacing = config.letterSpacing;
    xtermRef.current.options.cursorBlink = config.cursorBlink;
    xtermRef.current.options.cursorStyle = config.cursorStyle;
    xtermRef.current.options.scrollback = config.scrollback;

    fitAddonRef.current?.fit();
  }, [config]);

  // 监听应用主题变化，同步更新终端主题
  useEffect(() => {
    if (!xtermRef.current) return;
    xtermRef.current.options.theme = terminalTheme;
  }, [terminalTheme]);

  // 监听后端终端输出事件 - 只在组件挂载时设置一次
  useEffect(() => {
    let isMounted = true;
    let unlistenOutput: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;

    // 设置终端输出监听
    const setupListeners = async () => {
      console.log("[Terminal] 设置事件监听器...");

      // 监听终端输出
      unlistenOutput = await listen<TerminalOutputPayload>(
        "terminal-output",
        (event) => {
          if (!isMounted) return;

          const { terminal_id, data } = event.payload;
          console.log(
            "[Terminal] 收到输出事件:",
            terminal_id,
            "数据长度:",
            data.length,
            "activeTab:",
            activeTabRef.current
          );

          // 缓存到 buffer（无论是否是当前 tab）
          const buffer = getBuffer(terminal_id);
          buffer.push(data);

          // 如果是当前激活的终端且 xterm 已准备好，写入
          if (terminal_id === activeTabRef.current && xtermRef.current) {
            console.log("[Terminal] 写入 xterm:", data.substring(0, 100));
            xtermRef.current.write(data);
          } else {
            console.log(
              "[Terminal] 输出已缓存, terminal_id:",
              terminal_id,
              "activeTab:",
              activeTabRef.current
            );
          }
        }
      );

      // 监听终端退出
      unlistenExit = await listen<TerminalExitPayload>(
        "terminal-exit",
        (event) => {
          if (!isMounted) return;

          const { terminal_id } = event.payload;
          console.log("[Terminal] 收到退出事件:", terminal_id);
          // 清理缓冲区
          clearBuffer(terminal_id);
          if (terminal_id === activeTabRef.current) {
            updateTabStatusRef.current(terminal_id, "disconnected");
            if (xtermRef.current) {
              xtermRef.current.write("\r\n\x1b[31m[进程已退出]\x1b[0m\r\n");
            }
          }
        }
      );

      console.log("[Terminal] 事件监听器设置完成");
    };

    setupListeners();

    return () => {
      isMounted = false;
      if (unlistenOutput) {
        unlistenOutput();
      }
      if (unlistenExit) {
        unlistenExit();
      }
    };
  }, []); // 空依赖，只在挂载时执行一次

  // 当切换标签时，从缓冲区恢复输出并同步尺寸
  useEffect(() => {
    if (!xtermRef.current || !tab) return;

    const currentTabId = tab.id;
    const prevTabId = prevTabRef.current;

    console.log("[Terminal] Tab 变化:", prevTabId, "->", currentTabId);

    // 更新 prevTabRef
    prevTabRef.current = currentTabId;

    // 如果是同一个 tab（比如初次加载），不需要从 buffer 恢复
    // 因为事件监听器已经在实时写入了
    if (prevTabId === null) {
      // 首次加载，检查 buffer 是否有内容需要恢复
      // （这种情况发生在 activeTabRef 更新前就收到了输出）
      const buffer = getBuffer(currentTabId);
      if (buffer.length > 0) {
        console.log("[Terminal] 首次加载，恢复缓冲区内容:", buffer.length, "条");
        for (const data of buffer) {
          xtermRef.current.write(data);
        }
        // 清空 buffer，避免后续重复
        buffer.length = 0;
      }
    } else if (prevTabId !== currentTabId) {
      // 切换到不同的 tab，需要清空并从 buffer 恢复
      console.log("[Terminal] 切换 tab，从缓冲区恢复");
      xtermRef.current.clear();
      xtermRef.current.reset();

      const buffer = getBuffer(currentTabId);
      if (buffer.length > 0) {
        console.log("[Terminal] 恢复缓冲区内容:", buffer.length, "条");
        for (const data of buffer) {
          xtermRef.current.write(data);
        }
      }
    }

    // 重新 fit 并聚焦，同时发送尺寸到后端
    requestAnimationFrame(() => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        // 发送初始尺寸到后端（fit 之后 rows/cols 已更新）
        const { rows, cols } = xtermRef.current;
        console.log("[Terminal] 发送初始尺寸:", cols, "x", rows);
        invoke("terminal_resize", {
          terminalId: currentTabId,
          rows,
          cols,
        }).catch((e) => console.error("[Terminal] 发送尺寸失败:", e));
      }
      // 确保终端获得焦点
      xtermRef.current?.focus();
    });
  }, [tab?.id]);

  // 当面板可见时聚焦终端
  useEffect(() => {
    if (isVisible && xtermRef.current && tab) {
      requestAnimationFrame(() => {
        xtermRef.current?.focus();
      });
    }
  }, [isVisible, tab]);

  // 当终端面板可见但没有终端时，自动创建一个
  useEffect(() => {
    // 防止重复创建
    if (isAutoCreatingRef.current) return;
    if (isVisible && tabs.length === 0 && !isLoading) {
      isAutoCreatingRef.current = true;
      createTab()
        .catch((e) => {
          console.error("[Terminal] 自动创建终端失败:", e);
        })
        .finally(() => {
          isAutoCreatingRef.current = false;
        });
    }
  }, [isVisible, tabs.length, isLoading, createTab]);

  // 清理已关闭终端的缓冲区，防止内存泄漏
  useEffect(() => {
    const tabIds = new Set(tabs.map((t) => t.id));
    // 遍历缓冲区，删除不存在的终端缓冲区
    for (const bufferId of outputBuffers.keys()) {
      if (!tabIds.has(bufferId)) {
        console.log("[Terminal] 清理已关闭终端的缓冲区:", bufferId);
        clearBuffer(bufferId);
      }
    }
  }, [tabs]);

  // 点击终端区域时聚焦
  const handleTerminalClick = () => {
    xtermRef.current?.focus();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-card border-t border-border/60",
        className
      )}
    >
      <TerminalTabs />

      {/* 终端内容区域 */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <div
          ref={terminalRef}
          className="h-full w-full overflow-hidden terminal-container"
          style={{ backgroundColor: terminalTheme.background }}
          onClick={handleTerminalClick}
        />

        {/* 错误提示 */}
        {error && (
          <div className="absolute bottom-0 left-0 right-0 bg-destructive/90 text-white px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {/* 加载中提示（仅覆盖内容区，不覆盖标签栏） */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">正在启动终端...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
