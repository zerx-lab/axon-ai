import type { ReactNode } from "react";
import { useCallback, useRef } from "react";
import type { PanelSize } from "react-resizable-panels";
import { Titlebar } from "@/components/titlebar";
import { StatusBar } from "@/components/statusbar";
import { TerminalPanel } from "@/components/terminal/TerminalPanel";
import { useTerminalVisible } from "@/stores/terminal";
import { useLayout } from "@/stores/layout";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

interface RootLayoutProps {
  children: ReactNode;
}

// 终端面板配置（像素值）
const TERMINAL_PANEL_CONFIG = {
  defaultSize: 200,
  minSize: 100,
  maxSize: 400,
};

// 主内容区域最小高度
const MAIN_CONTENT_MIN_SIZE = 200;

// StatusBar 高度（与 StatusBar 组件中的 h-6 对应）
const STATUS_BAR_HEIGHT = 24;

/**
 * Root layout component - Zed-style application shell
 * Provides the main application structure with:
 * - Custom title bar (draggable for Tauri)
 * - Main content area
 * - Terminal panel (resizable, above status bar)
 * - Global status bar (bottom)
 */
export function RootLayout({ children }: RootLayoutProps) {
  const terminalVisible = useTerminalVisible();
  const { layout, updateTerminalPanelHeight } = useLayout();
  const terminalSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 获取持久化的终端面板高度，若无则使用默认值
  const terminalHeight = layout?.terminal_panel_height ?? TERMINAL_PANEL_CONFIG.defaultSize;

  // 处理终端面板大小变化（防抖保存）
  const handleTerminalResize = useCallback((size: PanelSize) => {
    // 清除之前的定时器
    if (terminalSaveTimerRef.current) {
      clearTimeout(terminalSaveTimerRef.current);
    }
    // 防抖 500ms 后保存，使用 Math.round 避免浮点数精度问题
    terminalSaveTimerRef.current = setTimeout(() => {
      updateTerminalPanelHeight(Math.round(size.inPixels));
    }, 500);
  }, [updateTerminalPanelHeight]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <Titlebar />
      
      {/* 主内容区域 + 终端面板（垂直分割）- 需要减去 StatusBar 高度 */}
      <div 
        className="flex-1 overflow-hidden"
        style={{ height: `calc(100% - ${STATUS_BAR_HEIGHT}px)` }}
      >
        <ResizablePanelGroup
          orientation="vertical"
          className="h-full"
        >
          {/* 主内容区域 */}
          <ResizablePanel id="main-content" minSize={MAIN_CONTENT_MIN_SIZE}>
            <main className="flex flex-1 h-full overflow-hidden">{children}</main>
          </ResizablePanel>

          {/* 终端面板 - 从底部向上展开 */}
          {terminalVisible && (
            <>
              <ResizableHandle withHandle orientation="vertical" />
              <ResizablePanel
                id="terminal-global"
                defaultSize={terminalHeight}
                minSize={TERMINAL_PANEL_CONFIG.minSize}
                maxSize={TERMINAL_PANEL_CONFIG.maxSize}
                onResize={handleTerminalResize}
              >
                <TerminalPanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      <StatusBar />
    </div>
  );
}
