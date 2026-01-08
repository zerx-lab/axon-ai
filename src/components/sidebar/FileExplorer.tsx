/**
 * 文件资源管理器组件
 * 
 * 显示项目目录的文件树结构
 * - 支持展开/折叠目录
 * - 支持文件/目录图标区分
 * - 懒加载目录内容
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

// ============== 类型定义 ==============

/** 后端返回的文件条目 */
interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  is_hidden: boolean;
  size: number | null;
  modified_at: number | null;
}

/** 前端使用的文件树节点 */
interface FileTreeNode extends FileEntry {
  /** 子节点（仅目录有） */
  children?: FileTreeNode[];
  /** 是否已加载子节点 */
  isLoaded?: boolean;
  /** 是否展开 */
  isExpanded?: boolean;
  /** 加载状态 */
  isLoading?: boolean;
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
  // 缩进计算：根级别 8px，每层增加 12px
  const paddingLeft = depth * 12 + 8;

  const handleClick = useCallback(() => {
    if (node.is_directory) {
      onToggle(node.path);
    } else {
      onFileClick?.(node.path, node.name);
    }
  }, [node, onToggle, onFileClick]);

  return (
    <>
      <div
        className={cn(
          "group flex items-center h-[22px] cursor-pointer",
          "hover:bg-sidebar-accent/60",
          "transition-colors duration-100"
        )}
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        {/* 展开/折叠图标（仅目录显示） */}
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

        {/* 文件/目录图标 */}
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

        {/* 文件名 */}
        <span
          className={cn(
            "truncate text-[13px]",
            node.is_hidden ? "text-muted-foreground/70" : "text-sidebar-foreground"
          )}
        >
          {node.name}
        </span>
      </div>

      {/* 子节点（展开时渲染） */}
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

  // 存储所有节点的展开状态和子节点
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadedChildren, setLoadedChildren] = useState<Map<string, FileTreeNode[]>>(new Map());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  // 加载目录内容
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

  // 加载根目录
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

      // 初始化已加载的子节点
      setLoadedChildren(new Map([[rootPath, children]]));
      setExpandedPaths(new Set([rootPath]));
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }, [rootPath, rootName, loadDirectory]);

  // 切换目录展开/折叠
  const handleToggle = useCallback(
    async (path: string) => {
      const isExpanded = expandedPaths.has(path);

      if (isExpanded) {
        // 折叠
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      } else {
        // 展开 - 如果没有加载过，先加载
        if (!loadedChildren.has(path)) {
          setLoadingPaths((prev) => new Set(prev).add(path));
          try {
            const children = await loadDirectory(path);
            setLoadedChildren((prev) => new Map(prev).set(path, children));
          } catch {
            // 错误已在 loadDirectory 中处理
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

  // 构建完整的树结构
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

  // 构建用于渲染的树
  const displayTree = useMemo(() => {
    if (!rootNode) return null;
    return buildTree(rootNode);
  }, [rootNode, buildTree]);

  // 初始加载
  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  // 空状态
  if (!rootPath) {
    return (
      <div className={cn("flex items-center justify-center h-20 text-xs text-muted-foreground", className)}>
        {t("sidebar.explorer.noProject", "未选择项目")}
      </div>
    );
  }

  // 加载中
  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-20", className)}>
        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-20 gap-2", className)}>
        <span className="text-xs text-destructive">{t("sidebar.explorer.loadError", "加载失败")}</span>
        <Button variant="ghost" size="sm" onClick={loadRoot} className="h-6 text-xs">
          <RefreshCw className="h-3 w-3 mr-1" />
          {t("common.retry", "重试")}
        </Button>
      </div>
    );
  }

  // 正常渲染
  return (
    <div className={cn("flex flex-col overflow-y-auto overflow-x-hidden", className)}>
      {displayTree && displayTree.children && displayTree.children.length > 0 ? (
        displayTree.children.map((child) => (
          <FileTreeItem
            key={child.path}
            node={child}
            depth={0}
            onToggle={handleToggle}
            onFileClick={onFileClick}
          />
        ))
      ) : (
        <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
          {t("sidebar.explorer.empty", "目录为空")}
        </div>
      )}
    </div>
  );
}
