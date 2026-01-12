/**
 * 文件预览面板组件
 *
 * 支持多标签页的文件预览面板：
 * - Tab 栏显示打开的文件
 * - 文件内容预览（带语法高亮）
 * - 支持关闭单个/全部标签
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useEditor, type EditorTab } from "@/stores/editor";
import {
  X,
  FileCode,
  FileJson,
  FileText,
  File,
  Image,
  Package,
  FileType,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { MonacoViewer } from "./MonacoViewer";

// ============== 文件图标辅助函数 ==============

function getFileIcon(fileName: string, className?: string): React.ReactNode {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const iconClass = cn("h-4 w-4 shrink-0", className);

  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "rs":
    case "py":
    case "go":
    case "java":
    case "c":
    case "cpp":
    case "h":
    case "hpp":
    case "vue":
    case "svelte":
      return <FileCode className={cn(iconClass, "text-blue-400")} />;
    case "json":
    case "yaml":
    case "yml":
    case "toml":
      return <FileJson className={cn(iconClass, "text-yellow-400")} />;
    case "md":
    case "txt":
    case "readme":
      return <FileText className={cn(iconClass, "text-muted-foreground")} />;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "ico":
      return <Image className={cn(iconClass, "text-green-400")} />;
    case "lock":
      return <Package className={cn(iconClass, "text-orange-400")} />;
    case "d":
      if (fileName.endsWith(".d.ts")) {
        return <FileType className={cn(iconClass, "text-blue-300")} />;
      }
      return <File className={cn(iconClass, "text-muted-foreground")} />;
    default:
      return <File className={cn(iconClass, "text-muted-foreground")} />;
  }
}

// ============== 标签页组件 ==============

interface EditorTabItemProps {
  tab: EditorTab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
}

function EditorTabItem({
  tab,
  isActive,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseAll,
}: EditorTabItemProps) {
  const { t } = useTranslation();

  const handleCloseClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group flex items-center gap-1.5 h-[32px] px-3 cursor-pointer",
            "border-r border-border/40",
            "transition-colors duration-100",
            isActive
              ? "bg-background text-foreground"
              : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
          )}
          onClick={onSelect}
        >
          {/* 文件图标 */}
          {getFileIcon(tab.name)}

          {/* 文件名 + 修改指示 */}
          <span className="truncate text-xs max-w-[120px]">
            {tab.name}
            {tab.isDirty && <span className="ml-0.5 text-[8px] text-muted-foreground">●</span>}
          </span>

          {/* 保存中状态 */}
          {tab.isSaving ? (
            <RefreshCw className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-4 w-4 shrink-0 rounded-sm p-0",
                "opacity-0 group-hover:opacity-100",
                "hover:bg-accent hover:text-foreground",
                "transition-opacity duration-100",
                isActive && "opacity-60"
              )}
              onClick={handleCloseClick}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onClose}>
          {t("editor.closeTab", "关闭")}
        </ContextMenuItem>
        <ContextMenuItem onClick={onCloseOthers}>
          {t("editor.closeOthers", "关闭其他")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onCloseAll}>
          {t("editor.closeAll", "关闭全部")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ============== 文件内容查看器 ==============

interface FileContentViewerProps {
  tab: EditorTab;
  onRetry: () => void;
  onContentChange: (content: string) => void;
  onSave: () => void;
}

function FileContentViewer({ tab, onRetry, onContentChange, onSave }: FileContentViewerProps) {
  const { t } = useTranslation();

  // 加载中
  if (tab.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 错误状态
  if (tab.error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertCircle className="h-8 w-8 text-destructive/70" />
        <span className="text-sm">{tab.error}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          {t("common.retry", "重试")}
        </Button>
      </div>
    );
  }

  // 空内容
  if (!tab.content) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        {t("editor.emptyFile", "文件为空")}
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-hidden">
      <MonacoViewer 
        value={tab.content} 
        language={tab.language} 
        onChange={onContentChange}
        onSave={onSave}
      />
    </div>
  );
}

// ============== 主组件 ==============

export function FilePreviewPanel() {
  const { t } = useTranslation();
  const {
    tabs,
    activeTabPath,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    setFileContent,
    setFileError,
    updateContent,
    setFileSaving,
    markAsSaved,
  } = useEditor();

  // 当前活动的标签
  const activeTab = useMemo(
    () => tabs.find((t) => t.path === activeTabPath),
    [tabs, activeTabPath]
  );

  // 追踪正在加载的文件路径，避免重复加载
  const loadingPathsRef = useRef<Set<string>>(new Set());

  // 加载文件内容
  const loadFileContent = useCallback(
    async (path: string) => {
      // 防止重复加载
      if (loadingPathsRef.current.has(path)) {
        return;
      }
      loadingPathsRef.current.add(path);

      try {
        const content = await invoke<string>("read_file_content", { path });
        setFileContent(path, content);
      } catch (error) {
        setFileError(path, String(error));
      } finally {
        loadingPathsRef.current.delete(path);
      }
    },
    [setFileContent, setFileError]
  );

  // 当标签页内容未加载时，自动加载
  // 只在 tabs 变化时检查需要加载的文件
  useEffect(() => {
    const tabsToLoad = tabs.filter(
      (tab) => tab.isLoading && !tab.error && !tab.content && !loadingPathsRef.current.has(tab.path)
    );
    
    tabsToLoad.forEach((tab) => {
      loadFileContent(tab.path);
    });
  }, [tabs, loadFileContent]);

  // 重试加载
  const handleRetry = useCallback(() => {
    if (activeTab) {
      loadFileContent(activeTab.path);
    }
  }, [activeTab, loadFileContent]);

  const saveRetryCountRef = useRef<Map<string, number>>(new Map());
  const MAX_SAVE_RETRIES = 3;

  const saveFile = useCallback(async (path: string, content: string) => {
    const retryCount = saveRetryCountRef.current.get(path) || 0;
    
    if (retryCount >= MAX_SAVE_RETRIES) {
      console.error(`保存文件失败，已达到最大重试次数 (${MAX_SAVE_RETRIES}):`, path);
      const fileName = path.split(/[/\\]/).pop() || path;
      toast.error(t("editor.saveFailedMaxRetries", { name: fileName, count: MAX_SAVE_RETRIES }));
      saveRetryCountRef.current.delete(path);
      return;
    }

    setFileSaving(path, true);
    try {
      await invoke("write_file_content", { path, content });
      markAsSaved(path, content);
      saveRetryCountRef.current.delete(path);
    } catch (error) {
      console.error("保存文件失败:", error);
      setFileSaving(path, false);
      saveRetryCountRef.current.set(path, retryCount + 1);
      
      const fileName = path.split(/[/\\]/).pop() || path;
      toast.error(t("editor.saveFailed", { name: fileName, error: String(error) }));
    }
  }, [setFileSaving, markAsSaved, t]);

  const handleContentChange = useCallback((newContent: string) => {
    if (activeTab) {
      updateContent(activeTab.path, newContent);
    }
  }, [activeTab, updateContent]);

  const handleSave = useCallback(() => {
    if (activeTab && activeTab.isDirty) {
      saveFile(activeTab.path, activeTab.content);
    }
  }, [activeTab, saveFile]);

  const pendingSavesRef = useRef<Map<string, { content: string; timeoutId: ReturnType<typeof setTimeout> }>>(new Map());
  
  useEffect(() => {
    if (activeTab?.isDirty && !activeTab.isSaving) {
      const path = activeTab.path;
      const content = activeTab.content;
      
      const existing = pendingSavesRef.current.get(path);
      if (existing) {
        clearTimeout(existing.timeoutId);
      }
      
      const timeoutId = setTimeout(() => {
        saveFile(path, content);
        pendingSavesRef.current.delete(path);
      }, 1000);
      
      pendingSavesRef.current.set(path, { content, timeoutId });
    }
    
    return () => {
      pendingSavesRef.current.forEach(({ timeoutId }) => {
        clearTimeout(timeoutId);
      });
    };
  }, [activeTab?.isDirty, activeTab?.content, activeTab?.path, activeTab?.isSaving, saveFile]);

  if (tabs.length === 0) {
    return (
      <div className="flex flex-1 h-full flex-col items-center justify-center text-muted-foreground">
        <File className="h-12 w-12 mb-3 opacity-30" />
        <span className="text-sm">{t("editor.noFilesOpen", "未打开文件")}</span>
        <span className="text-xs mt-1 opacity-70">
          {t("editor.clickToOpen", "在资源管理器中点击文件打开")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 h-full flex-col overflow-hidden bg-background">
      {/* Tab 栏 */}
      <div className="flex h-[32px] shrink-0 items-center bg-muted/20 border-b border-border/60 overflow-x-auto overflow-y-hidden scrollbar-none">
        {tabs.map((tab) => (
          <EditorTabItem
            key={tab.path}
            tab={tab}
            isActive={tab.path === activeTabPath}
            onSelect={() => setActiveTab(tab.path)}
            onClose={() => closeTab(tab.path)}
            onCloseOthers={() => closeOtherTabs(tab.path)}
            onCloseAll={closeAllTabs}
          />
        ))}
      </div>

      {/* 文件路径提示 */}
      {activeTab && (
        <div className="flex h-[24px] shrink-0 items-center px-3 bg-muted/10 border-b border-border/40 justify-between">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground truncate flex-1 mr-2">
                {activeTab.path}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-md">
              {activeTab.path}
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={handleRetry}
                disabled={activeTab.isLoading}
              >
                <RefreshCw className={cn(
                  "h-3 w-3",
                  activeTab.isLoading && "animate-spin"
                )} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("editor.refresh", "刷新文件")}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* 文件内容区域 */}
      {activeTab ? (
        <FileContentViewer 
          tab={activeTab} 
          onRetry={handleRetry}
          onContentChange={handleContentChange}
          onSave={handleSave}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
          {t("editor.selectTab", "选择一个标签页")}
        </div>
      )}
    </div>
  );
}
