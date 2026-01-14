/**
 * 终端工具栏组件
 *
 * 提供终端操作的快捷按钮：
 * - 清屏
 * - 杀死当前进程
 * - 快速命令
 * - 设置
 */

import { Trash2, Crosshair, Settings, Zap, ChevronDown } from "lucide-react";
import { useTerminal } from "@/stores/terminal";
import { cn } from "@/lib/utils";

interface TerminalToolbarProps {
  onToggleQuickCommands: () => void;
  showQuickCommands: boolean;
}

export function TerminalToolbar({
  onToggleQuickCommands,
  showQuickCommands,
}: TerminalToolbarProps) {
  const { tabs, activeTabId, sendCommand, config, updateConfig } = useTerminal();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleClear = async () => {
    if (!activeTab) return;
    await sendCommand(activeTab.id, "clear");
  };

  const handleKill = async () => {
    if (!activeTab) return;
    await sendCommand(activeTab.id, "\x03");
  };

  const handleSettings = () => {
    updateConfig({
      fontSize: config.fontSize === 14 ? 16 : config.fontSize === 16 ? 12 : 14,
    });
  };

  return (
    <div className="flex items-center justify-between h-9 px-2 border-b border-border/40 bg-background/30">
      <div className="flex items-center gap-1">
        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
          title="清屏 (Ctrl+L)"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>清屏</span>
        </button>

        <button
          onClick={handleKill}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
          title="终止当前进程 (Ctrl+C)"
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>终止</span>
        </button>

        <div className="w-px h-4 bg-border/60 mx-1" />

        <button
          onClick={onToggleQuickCommands}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors",
            showQuickCommands
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
          title="快速命令"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>快速命令</span>
          <ChevronDown className={cn(
            "w-3 h-3 transition-transform",
            showQuickCommands && "rotate-180"
          )} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground px-2">
          {activeTab?.cwd || "~"}
        </span>

        <button
          onClick={handleSettings}
          className="flex items-center justify-center w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
          title="终端设置"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
