/**
 * 终端工具栏组件
 *
 * 提供终端操作的快捷按钮：
 * - 快速命令
 * - 设置
 *
 * 注意：清屏和终止命令现在直接通过 WebSocket 发送到终端
 */

import { Settings, Zap, ChevronDown } from "lucide-react";
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
  const { tabs, activeTabId, config, updateConfig } = useTerminal();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleSettings = () => {
    updateConfig({
      fontSize: config.fontSize === 14 ? 16 : config.fontSize === 16 ? 12 : 14,
    });
  };

  return (
    <div className="flex items-center justify-between h-9 px-2 border-b border-border/40 bg-background/30">
      <div className="flex items-center gap-1">
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
