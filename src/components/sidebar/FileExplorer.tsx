/**
 * 文件资源管理器组件
 * 
 * 显示项目目录的文件树结构
 * - 支持展开/折叠目录
 * - 支持文件/目录图标区分
 * - 懒加载目录内容
 */

import { useState, useCallback, useEffect, useMemo, createContext, useContext, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  FileCode,
  FileJson,
  FileText,
  Image,
  FileType,
  Package,
  Trash2,
  Copy,
  ClipboardPaste,
  Pencil,
  FilePlus,
} from "lucide-react";

// ============== 类型定义 ==============

interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  is_hidden: boolean;
  size: number | null;
  modified_at: number | null;
}

interface FileTreeNode extends FileEntry {
  children?: FileTreeNode[];
  isLoaded?: boolean;
  isExpanded?: boolean;
  isLoading?: boolean;
}

interface ClipboardState {
  path: string;
  name: string;
  isDirectory: boolean;
}

interface RenameState {
  path: string;
  currentName: string;
}

interface FileExplorerContextValue {
  clipboard: ClipboardState | null;
  setClipboard: (state: ClipboardState | null) => void;
  renaming: RenameState | null;
  onDelete: (path: string, name: string) => void;
  onStartRename: (path: string, name: string) => void;
  onConfirmRename: (newName: string) => void;
  onCancelRename: () => void;
  onCopy: (path: string, name: string, isDirectory: boolean) => void;
  onPaste: (targetDir: string) => void;
  onMove: (sourcePath: string, targetDir: string) => void;
  onNewFile: (parentPath: string) => void;
  getParentDir: (path: string) => string;
  rootPath: string;
}

const FileExplorerContext = createContext<FileExplorerContextValue | null>(null);

function useFileExplorerContext() {
  const context = useContext(FileExplorerContext);
  if (!context) {
    throw new Error("useFileExplorerContext must be used within FileExplorer");
  }
  return context;
}

interface FileExplorerProps {
  /** 根目录路径 */
  rootPath: string;
  /** 根目录显示名称（可选） */
  rootName?: string;
  /** 是否显示隐藏文件 */
  showHidden?: boolean;
  /** 点击文件回调，参数为文件路径和文件名 */
  onFileClick?: (path: string, name: string) => void;
  /** 类名 */
  className?: string;
}

// ============== 辅助函数 ==============

/** 根据文件扩展名获取图标 */
function getFileIcon(fileName: string): React.ReactNode {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const iconClass = "h-4 w-4 shrink-0";

  switch (ext) {
    // 代码文件
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
    // JSON 和配置文件
    case "json":
    case "yaml":
    case "yml":
    case "toml":
      return <FileJson className={cn(iconClass, "text-yellow-400")} />;
    // 文本和文档
    case "md":
    case "txt":
    case "readme":
      return <FileText className={cn(iconClass, "text-muted-foreground")} />;
    // 图片
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "ico":
      return <Image className={cn(iconClass, "text-green-400")} />;
    // 包管理
    case "lock":
      return <Package className={cn(iconClass, "text-orange-400")} />;
    // 类型定义
    case "d":
      if (fileName.endsWith(".d.ts")) {
        return <FileType className={cn(iconClass, "text-blue-300")} />;
      }
      return <File className={cn(iconClass, "text-muted-foreground")} />;
    default:
      return <File className={cn(iconClass, "text-muted-foreground")} />;
  }
}

// ============== 单个文件/目录项组件 ==============

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  onToggle: (path: string) => void;
  onFileClick?: (path: string, name: string) => void;
}

function FileTreeItem({
  node,
  depth,
  onToggle,
  onFileClick,
}: FileTreeItemProps) {
  const { t } = useTranslation();
  const { clipboard, renaming, onDelete, onStartRename, onConfirmRename, onCancelRename, onCopy, onPaste, onMove, onNewFile, getParentDir, rootPath } = useFileExplorerContext();
  const [isDragOver, setIsDragOver] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const paddingLeft = depth * 12 + 8;

  const isRenaming = renaming?.path === node.path;

  useEffect(() => {
    if (isRenaming && renaming) {
      setRenameValue(renaming.currentName);
      // 延迟聚焦：等待 ContextMenu 完全关闭（动画 150ms）后再聚焦输入框
      // 否则 ContextMenu 关闭时会抢夺焦点，导致输入框立即失焦
      const focusTimer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const dotIndex = renaming.currentName.lastIndexOf(".");
          if (dotIndex > 0 && !node.is_directory) {
            inputRef.current.setSelectionRange(0, dotIndex);
          } else {
            inputRef.current.select();
          }
        }
      }, 200);
      return () => clearTimeout(focusTimer);
    }
  }, [isRenaming, renaming, node.is_directory]);

  const handleClick = useCallback(() => {
    if (isRenaming) return;
    if (node.is_directory) {
      onToggle(node.path);
    } else {
      onFileClick?.(node.path, node.name);
    }
  }, [node, onToggle, onFileClick, isRenaming]);

  const handleRenameSubmit = useCallback(() => {
    const trimmedName = renameValue.trim();
    if (trimmedName && trimmedName !== renaming?.currentName) {
      onConfirmRename(trimmedName);
    } else {
      onCancelRename();
    }
  }, [renameValue, renaming?.currentName, onConfirmRename, onCancelRename]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancelRename();
    }
  }, [handleRenameSubmit, onCancelRename]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", node.path);
    e.dataTransfer.effectAllowed = "move";
  }, [node.path]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!node.is_directory) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }, [node.is_directory]);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!node.is_directory) return;
    
    const sourcePath = e.dataTransfer.getData("text/plain");
    if (sourcePath && sourcePath !== node.path) {
      onMove(sourcePath, node.path);
    }
  }, [node.is_directory, node.path, onMove]);

  const handleDropToRoot = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const sourcePath = e.dataTransfer.getData("text/plain");
    if (sourcePath) {
      onMove(sourcePath, rootPath);
    }
  }, [onMove, rootPath]);

  const canPaste = clipboard !== null;
  const pasteTargetDir = node.is_directory ? node.path : getParentDir(node.path);
  const newFileTargetDir = node.is_directory ? node.path : getParentDir(node.path);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild disabled={isRenaming}>
          <div
            className={cn(
              "group flex items-center h-[22px] cursor-pointer",
              "hover:bg-sidebar-accent/60",
              "transition-colors duration-100",
              isDragOver && "bg-accent ring-1 ring-accent-foreground/20",
              isRenaming && "bg-sidebar-accent"
            )}
            style={{ paddingLeft }}
            onClick={handleClick}
            draggable={!isRenaming}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={node.is_directory ? handleDrop : handleDropToRoot}
          >
            {node.is_directory ? (
              <span className="h-4 w-4 flex items-center justify-center shrink-0">
                {node.isLoading ? (
                  <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : node.isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
              </span>
            ) : (
              <span className="w-4 shrink-0" />
            )}

            <span className="mr-1.5 shrink-0">
              {node.is_directory ? (
                node.isExpanded ? (
                  <FolderOpen className="h-4 w-4 text-yellow-500" />
                ) : (
                  <Folder className="h-4 w-4 text-yellow-500" />
                )
              ) : (
                getFileIcon(node.name)
              )}
            </span>

            {isRenaming ? (
              <input
                ref={inputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={handleRenameKeyDown}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "flex-1 min-w-0 h-5 px-1 text-[13px]",
                  "bg-background border border-ring rounded-sm",
                  "outline-none focus:ring-1 focus:ring-ring",
                  "text-sidebar-foreground"
                )}
              />
            ) : (
              <span
                className={cn(
                  "truncate text-[13px]",
                  node.is_hidden ? "text-muted-foreground/70" : "text-sidebar-foreground"
                )}
              >
                {node.name}
              </span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onNewFile(newFileTargetDir)}>
            <FilePlus className="h-4 w-4 mr-2" />
            {t("sidebar.explorerContextMenu.newFile")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onCopy(node.path, node.name, node.is_directory)}>
            <Copy className="h-4 w-4 mr-2" />
            {t("sidebar.explorerContextMenu.copy")}
          </ContextMenuItem>
          {canPaste && (
            <ContextMenuItem onClick={() => onPaste(pasteTargetDir)}>
              <ClipboardPaste className="h-4 w-4 mr-2" />
              {t("sidebar.explorerContextMenu.paste")}
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onStartRename(node.path, node.name)}>
            <Pencil className="h-4 w-4 mr-2" />
            {t("sidebar.explorerContextMenu.rename")}
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={() => onDelete(node.path, node.name)}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("sidebar.explorerContextMenu.delete")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {node.is_directory && node.isExpanded && node.children && (
        <>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onToggle={onToggle}
              onFileClick={onFileClick}
            />
          ))}
        </>
      )}
    </>
  );
}

// ============== 主组件 ==============

export function FileExplorer({
  rootPath,
  rootName,
  showHidden = false,
  onFileClick,
  className,
}: FileExplorerProps) {
  const { t } = useTranslation();
  const [rootNode, setRootNode] = useState<FileTreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadedChildren, setLoadedChildren] = useState<Map<string, FileTreeNode[]>>(new Map());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);

  const loadDirectory = useCallback(
    async (path: string): Promise<FileTreeNode[]> => {
      try {
        const entries = await invoke<FileEntry[]>("read_directory", {
          path,
          showHidden,
        });
        return entries.map((entry) => ({
          ...entry,
          children: undefined,
          isLoaded: false,
          isExpanded: false,
          isLoading: false,
        }));
      } catch (e) {
        console.error("[FileExplorer] 加载目录失败:", path, e);
        throw e;
      }
    },
    [showHidden]
  );

  const loadRoot = useCallback(async () => {
    if (!rootPath) return;

    setIsLoading(true);
    setError(null);

    try {
      const children = await loadDirectory(rootPath);
      const displayName = rootName || rootPath.split(/[/\\]/).pop() || rootPath;

      setRootNode({
        name: displayName,
        path: rootPath,
        is_directory: true,
        is_hidden: false,
        size: null,
        modified_at: null,
        children,
        isLoaded: true,
        isExpanded: true,
        isLoading: false,
      });

      setLoadedChildren(new Map([[rootPath, children]]));
      setExpandedPaths(new Set([rootPath]));
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }, [rootPath, rootName, loadDirectory]);

  const refreshDirectory = useCallback(async (dirPath: string) => {
    try {
      const children = await loadDirectory(dirPath);
      setLoadedChildren((prev) => new Map(prev).set(dirPath, children));
    } catch {
    }
  }, [loadDirectory]);

  const handleToggle = useCallback(
    async (path: string) => {
      const isExpanded = expandedPaths.has(path);

      if (isExpanded) {
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      } else {
        if (!loadedChildren.has(path)) {
          setLoadingPaths((prev) => new Set(prev).add(path));
          try {
            const children = await loadDirectory(path);
            setLoadedChildren((prev) => new Map(prev).set(path, children));
          } catch {
            setLoadingPaths((prev) => {
              const next = new Set(prev);
              next.delete(path);
              return next;
            });
            return;
          }
          setLoadingPaths((prev) => {
            const next = new Set(prev);
            next.delete(path);
            return next;
          });
        }
        setExpandedPaths((prev) => new Set(prev).add(path));
      }
    },
    [expandedPaths, loadedChildren, loadDirectory]
  );

  const getParentDir = useCallback((path: string) => {
    const lastSep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    return lastSep > 0 ? path.substring(0, lastSep) : rootPath;
  }, [rootPath]);

  const handleDelete = useCallback(async (path: string, _name: string) => {
    try {
      await invoke("delete_path", { path });
      const parentDir = getParentDir(path);
      await refreshDirectory(parentDir);
    } catch (e) {
      console.error("[FileExplorer] 删除失败:", e);
    }
  }, [getParentDir, refreshDirectory]);

  const [renaming, setRenaming] = useState<RenameState | null>(null);

  const handleStartRename = useCallback((path: string, name: string) => {
    setRenaming({ path, currentName: name });
  }, []);

  const handleConfirmRename = useCallback(async (newName: string) => {
    if (!renaming) return;
    
    try {
      await invoke("rename_path", { oldPath: renaming.path, newName });
      const parentDir = getParentDir(renaming.path);
      await refreshDirectory(parentDir);
    } catch (e) {
      console.error("[FileExplorer] 重命名失败:", e);
    } finally {
      setRenaming(null);
    }
  }, [renaming, getParentDir, refreshDirectory]);

  const handleCancelRename = useCallback(() => {
    setRenaming(null);
  }, []);

  const handleCopy = useCallback((path: string, name: string, isDirectory: boolean) => {
    setClipboard({ path, name, isDirectory });
  }, []);

  const handlePaste = useCallback(async (targetDir: string) => {
    if (!clipboard) return;
    
    try {
      await invoke("copy_path", { source: clipboard.path, destDir: targetDir });
      await refreshDirectory(targetDir);
      setClipboard(null);
    } catch (e) {
      console.error("[FileExplorer] 粘贴失败:", e);
    }
  }, [clipboard, refreshDirectory]);

  const handleMove = useCallback(async (sourcePath: string, targetDir: string) => {
    try {
      await invoke("move_path", { source: sourcePath, destDir: targetDir });
      const sourceParent = getParentDir(sourcePath);
      await refreshDirectory(sourceParent);
      if (sourceParent !== targetDir) {
        await refreshDirectory(targetDir);
      }
    } catch (e) {
      console.error("[FileExplorer] 移动失败:", e);
    }
  }, [getParentDir, refreshDirectory]);

  const handleNewFile = useCallback(async (parentPath: string) => {
    let newFileName = "untitled";
    let counter = 1;
    const separator = parentPath.includes("/") ? "/" : "\\";
    
    const existingChildren = loadedChildren.get(parentPath) || [];
    const existingNames = new Set(existingChildren.map(c => c.name));
    
    while (existingNames.has(newFileName)) {
      newFileName = `untitled${counter}`;
      counter++;
    }
    const newFilePath = `${parentPath}${separator}${newFileName}`;
    
    try {
      await invoke("write_file_content", { path: newFilePath, content: "" });
      await refreshDirectory(parentPath);
      setRenaming({ path: newFilePath, currentName: newFileName });
    } catch (e) {
      console.error("[FileExplorer] 创建文件失败:", e);
    }
  }, [loadedChildren, refreshDirectory]);

  const contextValue = useMemo<FileExplorerContextValue>(() => ({
    clipboard,
    setClipboard,
    renaming,
    onDelete: handleDelete,
    onStartRename: handleStartRename,
    onConfirmRename: handleConfirmRename,
    onCancelRename: handleCancelRename,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onMove: handleMove,
    onNewFile: handleNewFile,
    getParentDir,
    rootPath,
  }), [clipboard, renaming, handleDelete, handleStartRename, handleConfirmRename, handleCancelRename, handleCopy, handlePaste, handleMove, handleNewFile, getParentDir, rootPath]);

  const buildTree = useCallback(
    (node: FileTreeNode): FileTreeNode => {
      if (!node.is_directory) return node;

      const children = loadedChildren.get(node.path);
      const isExpanded = expandedPaths.has(node.path);
      const isLoading = loadingPaths.has(node.path);

      return {
        ...node,
        isExpanded,
        isLoading,
        isLoaded: children !== undefined,
        children: children?.map(buildTree),
      };
    },
    [loadedChildren, expandedPaths, loadingPaths]
  );

  const displayTree = useMemo(() => {
    if (!rootNode) return null;
    return buildTree(rootNode);
  }, [rootNode, buildTree]);

  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  if (!rootPath) {
    return (
      <div className={cn("flex items-center justify-center h-20 text-xs text-muted-foreground select-none", className)}>
        {t("sidebar.explorerPanel.noProject")}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-20 select-none", className)}>
        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-20 gap-2 select-none", className)}>
        <span className="text-xs text-destructive">{t("sidebar.explorerPanel.loadError")}</span>
        <Button variant="ghost" size="sm" onClick={loadRoot} className="h-6 text-xs">
          <RefreshCw className="h-3 w-3 mr-1" />
          {t("common.retry", "重试")}
        </Button>
      </div>
    );
  }

  const canPasteToRoot = clipboard !== null;
  const isAnyRenaming = renaming !== null;

  return (
    <FileExplorerContext.Provider value={contextValue}>
      <ContextMenu>
        <ContextMenuTrigger asChild disabled={isAnyRenaming}>
          <div className={cn("flex flex-col flex-1 overflow-y-auto overflow-x-hidden select-none min-h-[60px] h-full", className)}>
            {displayTree && displayTree.children && displayTree.children.length > 0 ? (
              <>
                {displayTree.children.map((child) => (
                  <FileTreeItem
                    key={child.path}
                    node={child}
                    depth={0}
                    onToggle={handleToggle}
                    onFileClick={onFileClick}
                  />
                ))}
                {/* 空白区域填充 - 确保右键菜单可在任意位置触发 */}
                <div className="flex-1 min-h-[20px]" />
              </>
            ) : (
              <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                {t("sidebar.explorerPanel.empty")}
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => handleNewFile(rootPath)}>
            <FilePlus className="h-4 w-4 mr-2" />
            {t("sidebar.explorerContextMenu.newFile")}
          </ContextMenuItem>
          {canPasteToRoot && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => handlePaste(rootPath)}>
                <ClipboardPaste className="h-4 w-4 mr-2" />
                {t("sidebar.explorerContextMenu.paste")}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </FileExplorerContext.Provider>
  );
}
