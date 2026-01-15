/**
 * 终端标签栏组件
 *
 * VSCode 风格的终端标签栏：
 * - 显示多个终端标签
 * - 活动标签高亮
 * - 关闭按钮
 * - 新建终端按钮
 */

import { useCallback } from "react";
import { X, Plus, Terminal as TerminalIcon } from "lucide-react";
import { useTerminal } from "@/stores/terminal";
import { cn } from "@/lib/utils";

export function TerminalTabs() {
  const {
    tabs,
    activeTabId,
    isLoading,
    createTab,
    closeTab,
    selectTab,
  } = useTerminal();

  const handleCreateTab = useCallback(async () => {
    try {
      await createTab();
    } catch (e) {
      console.error("创建终端失败:", e);
    }
  }, [createTab]);

  const handleCloseTab = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      await closeTab(id);
    },
    [closeTab]
  );

  if (tabs.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-between h-7 border-b border-border/60 bg-background/50 px-2">
        <span className="text-xs text-muted-foreground">暂无终端</span>
        <button
          onClick={handleCreateTab}
          className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
          title="新建终端"
        >
          <Plus className="w-3 h-3" />
          <span>新建</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center h-7 border-b border-border/60 bg-background/50 overflow-x-auto">
      <div className="flex items-center px-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => selectTab(tab.id)}
            className={cn(
              "group flex items-center gap-1.5 px-2 pr-1 h-6 text-xs cursor-pointer transition-colors duration-150",
              "border-r border-border/40",
              activeTabId === tab.id
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <TerminalIcon className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[100px]">{tab.title}</span>
            <button
              onClick={(e) => handleCloseTab(e, tab.id)}
              className={cn(
                "flex items-center justify-center w-4 h-4 ml-1 rounded shrink-0",
                "text-muted-foreground/50 hover:text-foreground hover:bg-muted",
                "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
                // 激活的 tab 始终显示关闭按钮
                activeTabId === tab.id && "opacity-100"
              )}
              title="关闭终端"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={handleCreateTab}
        className="flex items-center justify-center w-6 h-6 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="新建终端"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
