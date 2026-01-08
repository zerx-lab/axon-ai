/**
 * DiffViewer 组件
 *
 * 高性能的代码差异显示组件，支持：
 * - Unified（统一）和 Split（分栏）两种显示模式
 * - 行号显示
 * - 新增/删除/未修改行的高亮
 * - 差异统计（+N / -M）
 *
 * 使用 Rust 后端进行差异计算以获得最佳性能。
 */

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { computeDiff } from "./api";
import type { DiffResult, DiffLine, DiffHunk } from "./types";
import { Loader2 } from "lucide-react";

// ============== 类型定义 ==============

export interface DiffViewerProps {
  /** 旧文本内容 */
  oldText: string;
  /** 新文本内容 */
  newText: string;
  /** 文件名（用于显示） */
  fileName?: string;
  /** 显示模式：unified（统一）或 split（分栏） */
  mode?: "unified" | "split";
  /** 是否显示行号 */
  showLineNumbers?: boolean;
  /** 上下文行数 */
  contextLines?: number;
  /** 自定义类名 */
  className?: string;
  /** 是否显示文件头 */
  showHeader?: boolean;
}

// ============== 主组件 ==============

export function DiffViewer({
  oldText,
  newText,
  fileName,
  mode = "split",
  showLineNumbers = true,
  contextLines = 3,
  className,
  showHeader = true,
}: DiffViewerProps) {
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 计算差异
  useEffect(() => {
    let cancelled = false;

    async function calculate() {
      setLoading(true);
      setError(null);

      try {
        const result = await computeDiff(oldText, newText, fileName, contextLines);
        if (!cancelled) {
          setDiffResult(result);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "计算差异时发生错误");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    calculate();

    return () => {
      cancelled = true;
    };
  }, [oldText, newText, fileName, contextLines]);

  // 加载状态
  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">计算差异中...</span>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className={cn("text-sm text-destructive p-4", className)}>
        {error}
      </div>
    );
  }

  // 无差异
  if (!diffResult || !diffResult.hasChanges) {
    return (
      <div className={cn("text-sm text-muted-foreground p-4 text-center", className)}>
        文件内容相同，无差异
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border border-border overflow-hidden", className)}>
      {/* 文件头 */}
      {showHeader && (
        <DiffHeader
          fileName={diffResult.fileName}
          additions={diffResult.additions}
          deletions={diffResult.deletions}
        />
      )}

      {/* 差异内容 */}
      <div className="overflow-x-auto">
        {mode === "split" ? (
          <SplitView
            hunks={diffResult.hunks}
            showLineNumbers={showLineNumbers}
          />
        ) : (
          <UnifiedView
            hunks={diffResult.hunks}
            showLineNumbers={showLineNumbers}
          />
        )}
      </div>
    </div>
  );
}

// ============== 文件头组件 ==============

interface DiffHeaderProps {
  fileName: string | null;
  additions: number;
  deletions: number;
}

function DiffHeader({ fileName, additions, deletions }: DiffHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-muted/40 border-b border-border">
      {fileName && (
        <span className="text-sm font-mono text-foreground truncate">
          {fileName}
        </span>
      )}
      <div className="flex items-center gap-2 ml-auto text-xs">
        {additions > 0 && (
          <span className="text-green-600 dark:text-green-400 font-medium">
            +{additions}
          </span>
        )}
        {deletions > 0 && (
          <span className="text-red-600 dark:text-red-400 font-medium">
            -{deletions}
          </span>
        )}
      </div>
    </div>
  );
}

// ============== 分栏视图 ==============

interface SplitViewProps {
  hunks: DiffHunk[];
  showLineNumbers: boolean;
}

function SplitView({ hunks, showLineNumbers }: SplitViewProps) {
  // 将差异行转换为左右两列
  const rows = useMemo(() => {
    const result: Array<{
      left: DiffLine | null;
      right: DiffLine | null;
    }> = [];

    for (const hunk of hunks) {
      // 添加 hunk 分隔符
      result.push({ left: null, right: null });

      let i = 0;
      while (i < hunk.lines.length) {
        const line = hunk.lines[i];

        if (line.lineType === "unchanged") {
          result.push({ left: line, right: line });
          i++;
        } else if (line.lineType === "removed") {
          // 收集连续的删除行
          const removals: DiffLine[] = [];
          while (i < hunk.lines.length && hunk.lines[i].lineType === "removed") {
            removals.push(hunk.lines[i]);
            i++;
          }
          // 收集连续的添加行
          const additions: DiffLine[] = [];
          while (i < hunk.lines.length && hunk.lines[i].lineType === "added") {
            additions.push(hunk.lines[i]);
            i++;
          }
          // 配对显示
          const maxLen = Math.max(removals.length, additions.length);
          for (let j = 0; j < maxLen; j++) {
            result.push({
              left: removals[j] || null,
              right: additions[j] || null,
            });
          }
        } else if (line.lineType === "added") {
          result.push({ left: null, right: line });
          i++;
        } else {
          i++;
        }
      }
    }

    return result;
  }, [hunks]);

  return (
    <div className="font-mono text-xs">
      {rows.map((row, idx) => {
        // Hunk 分隔符
        if (row.left === null && row.right === null) {
          if (idx === 0) return null; // 跳过第一个
          return (
            <div
              key={idx}
              className="flex bg-muted/60 text-muted-foreground text-center py-1 border-y border-border/50"
            >
              <div className="flex-1 px-2">···</div>
              <div className="w-px bg-border" />
              <div className="flex-1 px-2">···</div>
            </div>
          );
        }

        return (
          <div key={idx} className="flex">
            {/* 左侧（旧文件） */}
            <SplitViewCell
              line={row.left}
              side="left"
              showLineNumbers={showLineNumbers}
            />
            {/* 分隔线 */}
            <div className="w-px bg-border" />
            {/* 右侧（新文件） */}
            <SplitViewCell
              line={row.right}
              side="right"
              showLineNumbers={showLineNumbers}
            />
          </div>
        );
      })}
    </div>
  );
}

interface SplitViewCellProps {
  line: DiffLine | null;
  side: "left" | "right";
  showLineNumbers: boolean;
}

function SplitViewCell({ line, side, showLineNumbers }: SplitViewCellProps) {
  const isEmpty = line === null;
  const isRemoved = line?.lineType === "removed";
  const isAdded = line?.lineType === "added";
  const isUnchanged = line?.lineType === "unchanged";

  // 左侧显示删除，右侧显示添加
  const isHighlighted = side === "left" ? isRemoved : isAdded;

  return (
    <div
      className={cn(
        "flex-1 flex min-h-[24px]",
        isEmpty && "bg-muted/20",
        isHighlighted && side === "left" && "bg-red-500/10",
        isHighlighted && side === "right" && "bg-green-500/10",
        isUnchanged && "bg-background"
      )}
    >
      {/* 行号 */}
      {showLineNumbers && (
        <span
          className={cn(
            "w-12 shrink-0 px-2 py-0.5 text-right select-none",
            "text-muted-foreground/60 border-r border-border/50",
            isHighlighted && side === "left" && "bg-red-500/20 text-red-600/80",
            isHighlighted && side === "right" && "bg-green-500/20 text-green-600/80"
          )}
        >
          {line ? (side === "left" ? line.oldLineNumber : line.newLineNumber) : ""}
        </span>
      )}
      {/* 差异指示器 */}
      <span
        className={cn(
          "w-5 shrink-0 text-center py-0.5 select-none",
          isRemoved && side === "left" && "text-red-600 dark:text-red-400",
          isAdded && side === "right" && "text-green-600 dark:text-green-400"
        )}
      >
        {isRemoved && side === "left" && "−"}
        {isAdded && side === "right" && "+"}
      </span>
      {/* 代码内容 */}
      <pre
        className={cn(
          "flex-1 px-2 py-0.5 whitespace-pre-wrap break-all",
          isRemoved && side === "left" && "text-red-700 dark:text-red-300",
          isAdded && side === "right" && "text-green-700 dark:text-green-300"
        )}
      >
        {line?.content ?? ""}
      </pre>
    </div>
  );
}

// ============== 统一视图 ==============

interface UnifiedViewProps {
  hunks: DiffHunk[];
  showLineNumbers: boolean;
}

function UnifiedView({ hunks, showLineNumbers }: UnifiedViewProps) {
  return (
    <div className="font-mono text-xs">
      {hunks.map((hunk, hunkIdx) => (
        <div key={hunkIdx}>
          {/* Hunk 头部 */}
          <div className="bg-muted/60 text-muted-foreground px-3 py-1 border-y border-border/50">
            @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
          </div>
          {/* 差异行 */}
          {hunk.lines.map((line, lineIdx) => (
            <UnifiedViewLine
              key={lineIdx}
              line={line}
              showLineNumbers={showLineNumbers}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface UnifiedViewLineProps {
  line: DiffLine;
  showLineNumbers: boolean;
}

function UnifiedViewLine({ line, showLineNumbers }: UnifiedViewLineProps) {
  const isRemoved = line.lineType === "removed";
  const isAdded = line.lineType === "added";

  return (
    <div
      className={cn(
        "flex min-h-[24px]",
        isRemoved && "bg-red-500/10",
        isAdded && "bg-green-500/10"
      )}
    >
      {/* 旧行号 */}
      {showLineNumbers && (
        <span
          className={cn(
            "w-10 shrink-0 px-1 py-0.5 text-right select-none",
            "text-muted-foreground/60 border-r border-border/50",
            isRemoved && "bg-red-500/20"
          )}
        >
          {line.oldLineNumber ?? ""}
        </span>
      )}
      {/* 新行号 */}
      {showLineNumbers && (
        <span
          className={cn(
            "w-10 shrink-0 px-1 py-0.5 text-right select-none",
            "text-muted-foreground/60 border-r border-border/50",
            isAdded && "bg-green-500/20"
          )}
        >
          {line.newLineNumber ?? ""}
        </span>
      )}
      {/* 差异指示器 */}
      <span
        className={cn(
          "w-5 shrink-0 text-center py-0.5 select-none",
          isRemoved && "text-red-600 dark:text-red-400",
          isAdded && "text-green-600 dark:text-green-400"
        )}
      >
        {isRemoved && "−"}
        {isAdded && "+"}
        {!isRemoved && !isAdded && " "}
      </span>
      {/* 代码内容 */}
      <pre
        className={cn(
          "flex-1 px-2 py-0.5 whitespace-pre-wrap break-all",
          isRemoved && "text-red-700 dark:text-red-300",
          isAdded && "text-green-700 dark:text-green-300"
        )}
      >
        {line.content}
      </pre>
    </div>
  );
}

// ============== 差异统计组件 ==============

export interface DiffStatsDisplayProps {
  additions: number;
  deletions: number;
  className?: string;
}

export function DiffStatsDisplay({ additions, deletions, className }: DiffStatsDisplayProps) {
  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      {additions > 0 && (
        <span className="text-green-600 dark:text-green-400 font-medium">
          +{additions}
        </span>
      )}
      {deletions > 0 && (
        <span className="text-red-600 dark:text-red-400 font-medium">
          -{deletions}
        </span>
      )}
      {additions === 0 && deletions === 0 && (
        <span className="text-muted-foreground">无变更</span>
      )}
    </div>
  );
}
