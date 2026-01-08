/**
 * Diff API - 调用 Rust 后端进行差异计算
 */

import { invoke } from "@tauri-apps/api/core";
import type { DiffResult, DiffStats } from "./types";

/**
 * 计算两个文本之间的差异
 *
 * @param oldText - 旧文本内容
 * @param newText - 新文本内容
 * @param fileName - 可选的文件名
 * @param contextLines - 上下文行数（默认3行）
 * @returns 差异结果
 */
export async function computeDiff(
  oldText: string,
  newText: string,
  fileName?: string,
  contextLines?: number
): Promise<DiffResult> {
  return invoke<DiffResult>("compute_diff", {
    oldText,
    newText,
    fileName: fileName ?? null,
    contextLines: contextLines ?? null,
  });
}

/**
 * 生成 unified diff 格式的文本
 *
 * @param oldText - 旧文本内容
 * @param newText - 新文本内容
 * @param oldName - 旧文件名
 * @param newName - 新文件名
 * @param contextLines - 上下文行数（默认3行）
 * @returns unified diff 格式的字符串
 */
export async function computeUnifiedDiff(
  oldText: string,
  newText: string,
  oldName?: string,
  newName?: string,
  contextLines?: number
): Promise<string> {
  return invoke<string>("compute_unified_diff", {
    oldText,
    newText,
    oldName: oldName ?? null,
    newName: newName ?? null,
    contextLines: contextLines ?? null,
  });
}

/**
 * 获取差异统计信息（快速版本）
 *
 * @param oldText - 旧文本内容
 * @param newText - 新文本内容
 * @returns 差异统计
 */
export async function computeDiffStats(
  oldText: string,
  newText: string
): Promise<DiffStats> {
  return invoke<DiffStats>("compute_diff_stats", {
    oldText,
    newText,
  });
}

/**
 * 快速检查两个文本是否相同
 *
 * @param oldText - 旧文本内容
 * @param newText - 新文本内容
 * @returns 是否相同
 */
export async function textsAreEqual(
  oldText: string,
  newText: string
): Promise<boolean> {
  return invoke<boolean>("texts_are_equal", {
    oldText,
    newText,
  });
}
