/**
 * Diff 相关类型定义
 * 与 Rust 后端 src-tauri/src/commands/diff.rs 保持一致
 */

/** 差异行类型 */
export type DiffLineType = "unchanged" | "added" | "removed";

/** 单行差异信息 */
export interface DiffLine {
  /** 差异类型 */
  lineType: DiffLineType;
  /** 行内容 */
  content: string;
  /** 旧文件中的行号（删除/未修改时有值） */
  oldLineNumber: number | null;
  /** 新文件中的行号（新增/未修改时有值） */
  newLineNumber: number | null;
}

/** 差异块（Hunk） */
export interface DiffHunk {
  /** 旧文件起始行号 */
  oldStart: number;
  /** 旧文件行数 */
  oldCount: number;
  /** 新文件起始行号 */
  newStart: number;
  /** 新文件行数 */
  newCount: number;
  /** 差异行列表 */
  lines: DiffLine[];
}

/** 完整的差异结果 */
export interface DiffResult {
  /** 文件名 */
  fileName: string | null;
  /** 差异块列表 */
  hunks: DiffHunk[];
  /** 新增行数统计 */
  additions: number;
  /** 删除行数统计 */
  deletions: number;
  /** 是否有变更 */
  hasChanges: boolean;
}

/** 差异统计信息 */
export interface DiffStats {
  /** 新增行数 */
  additions: number;
  /** 删除行数 */
  deletions: number;
  /** 是否有变更 */
  hasChanges: boolean;
}
