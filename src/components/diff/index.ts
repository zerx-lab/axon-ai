/**
 * Diff 组件模块
 *
 * 提供高性能的代码差异计算和显示功能。
 * 差异计算由 Rust 后端完成，前端负责展示。
 */

// 组件
export { DiffViewer, DiffStatsDisplay } from "./DiffViewer";

// API
export { computeDiff, computeUnifiedDiff, computeDiffStats, textsAreEqual } from "./api";

// 类型
export type {
  DiffLineType,
  DiffLine,
  DiffHunk,
  DiffResult,
  DiffStats,
} from "./types";
