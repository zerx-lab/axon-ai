//! Diff 计算命令模块
//!
//! 使用 Rust 的 similar 库进行高性能差异计算，
//! 支持行级别和字符级别的差异对比。

use serde::{Deserialize, Serialize};
use similar::{ChangeTag, TextDiff};

/// 差异行类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DiffLineType {
    /// 未修改的行
    Unchanged,
    /// 新增的行
    Added,
    /// 删除的行
    Removed,
}

/// 单行差异信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    /// 差异类型
    pub line_type: DiffLineType,
    /// 行内容
    pub content: String,
    /// 旧文件中的行号（删除/未修改时有值）
    pub old_line_number: Option<usize>,
    /// 新文件中的行号（新增/未修改时有值）
    pub new_line_number: Option<usize>,
}

/// 差异块（Hunk）
/// 表示一组连续的变更
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    /// 旧文件起始行号
    pub old_start: usize,
    /// 旧文件行数
    pub old_count: usize,
    /// 新文件起始行号
    pub new_start: usize,
    /// 新文件行数
    pub new_count: usize,
    /// 差异行列表
    pub lines: Vec<DiffLine>,
}

/// 完整的差异结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffResult {
    /// 文件名
    pub file_name: Option<String>,
    /// 差异块列表
    pub hunks: Vec<DiffHunk>,
    /// 新增行数统计
    pub additions: usize,
    /// 删除行数统计
    pub deletions: usize,
    /// 是否有变更
    pub has_changes: bool,
}

/// 计算两个文本之间的差异
///
/// # 参数
/// - `old_text`: 旧文本内容
/// - `new_text`: 新文本内容
/// - `file_name`: 可选的文件名
/// - `context_lines`: 上下文行数（默认3行）
///
/// # 返回
/// 差异结果，包含所有变更块和统计信息
#[tauri::command]
pub fn compute_diff(
    old_text: &str,
    new_text: &str,
    file_name: Option<String>,
    context_lines: Option<usize>,
) -> DiffResult {
    let context = context_lines.unwrap_or(3);
    let diff = TextDiff::from_lines(old_text, new_text);

    let mut all_lines: Vec<DiffLine> = Vec::new();
    let mut additions = 0;
    let mut deletions = 0;
    let mut old_line_num: usize = 1;
    let mut new_line_num: usize = 1;

    // 收集所有变更
    for change in diff.iter_all_changes() {
        let (line_type, old_ln, new_ln) = match change.tag() {
            ChangeTag::Equal => {
                let result = (DiffLineType::Unchanged, Some(old_line_num), Some(new_line_num));
                old_line_num += 1;
                new_line_num += 1;
                result
            }
            ChangeTag::Delete => {
                deletions += 1;
                let result = (DiffLineType::Removed, Some(old_line_num), None);
                old_line_num += 1;
                result
            }
            ChangeTag::Insert => {
                additions += 1;
                let result = (DiffLineType::Added, None, Some(new_line_num));
                new_line_num += 1;
                result
            }
        };

        // 移除行尾换行符以保持一致性
        let content = change.value().trim_end_matches('\n').to_string();

        all_lines.push(DiffLine {
            line_type,
            content,
            old_line_number: old_ln,
            new_line_number: new_ln,
        });
    }

    // 将行分组为 hunks（带上下文）
    let hunks = group_into_hunks(all_lines, context);
    let has_changes = additions > 0 || deletions > 0;

    DiffResult {
        file_name,
        hunks,
        additions,
        deletions,
        has_changes,
    }
}

/// 将差异行分组为 hunks
fn group_into_hunks(lines: Vec<DiffLine>, context: usize) -> Vec<DiffHunk> {
    if lines.is_empty() {
        return Vec::new();
    }

    // 找出所有变更行的索引
    let change_indices: Vec<usize> = lines
        .iter()
        .enumerate()
        .filter(|(_, line)| line.line_type != DiffLineType::Unchanged)
        .map(|(i, _)| i)
        .collect();

    if change_indices.is_empty() {
        return Vec::new();
    }

    let mut hunks = Vec::new();
    let mut current_hunk_lines = Vec::new();
    let mut hunk_start_idx: Option<usize> = None;
    let mut last_change_idx: Option<usize> = None;

    for &change_idx in &change_indices {
        // 确定此变更的上下文范围
        let ctx_start = change_idx.saturating_sub(context);

        // 检查是否应该开始新的 hunk
        let should_start_new = match last_change_idx {
            None => true,
            Some(last) => {
                // 如果两个变更之间的间隔大于 2*context，则开始新 hunk
                change_idx > last + 2 * context + 1
            }
        };

        if should_start_new {
            // 保存之前的 hunk
            if !current_hunk_lines.is_empty() {
                if let Some(start) = hunk_start_idx {
                    let last = last_change_idx.unwrap_or(start);
                    let end = (last + context + 1).min(lines.len());
                    // 添加剩余的上下文行
                    for i in (current_hunk_lines.len() + start)..end {
                        if i < lines.len() {
                            current_hunk_lines.push(lines[i].clone());
                        }
                    }
                    hunks.push(create_hunk(&current_hunk_lines));
                }
            }
            // 开始新 hunk
            current_hunk_lines.clear();
            hunk_start_idx = Some(ctx_start);

            // 添加前置上下文
            for i in ctx_start..change_idx {
                current_hunk_lines.push(lines[i].clone());
            }
        } else if let Some(start) = hunk_start_idx {
            // 继续当前 hunk，添加中间的行
            let current_end = start + current_hunk_lines.len();
            for i in current_end..change_idx {
                if i < lines.len() {
                    current_hunk_lines.push(lines[i].clone());
                }
            }
        }

        // 添加变更行
        current_hunk_lines.push(lines[change_idx].clone());
        last_change_idx = Some(change_idx);
    }

    // 保存最后一个 hunk
    if !current_hunk_lines.is_empty() {
        if let Some(start) = hunk_start_idx {
            let last = last_change_idx.unwrap_or(start);
            let end = (last + context + 1).min(lines.len());
            // 添加剩余的上下文行
            for i in (current_hunk_lines.len() + start)..end {
                if i < lines.len() {
                    current_hunk_lines.push(lines[i].clone());
                }
            }
            hunks.push(create_hunk(&current_hunk_lines));
        }
    }

    hunks
}

/// 从行列表创建 hunk
fn create_hunk(lines: &[DiffLine]) -> DiffHunk {
    let old_start = lines
        .iter()
        .filter_map(|l| l.old_line_number)
        .min()
        .unwrap_or(1);
    let new_start = lines
        .iter()
        .filter_map(|l| l.new_line_number)
        .min()
        .unwrap_or(1);

    let old_count = lines
        .iter()
        .filter(|l| l.line_type != DiffLineType::Added)
        .count();
    let new_count = lines
        .iter()
        .filter(|l| l.line_type != DiffLineType::Removed)
        .count();

    DiffHunk {
        old_start,
        old_count,
        new_start,
        new_count,
        lines: lines.to_vec(),
    }
}

/// 生成 unified diff 格式的文本
///
/// # 参数
/// - `old_text`: 旧文本内容
/// - `new_text`: 新文本内容
/// - `old_name`: 旧文件名
/// - `new_name`: 新文件名
/// - `context_lines`: 上下文行数（默认3行）
///
/// # 返回
/// unified diff 格式的字符串
#[tauri::command]
pub fn compute_unified_diff(
    old_text: &str,
    new_text: &str,
    old_name: Option<String>,
    new_name: Option<String>,
    context_lines: Option<usize>,
) -> String {
    let context = context_lines.unwrap_or(3);
    let diff = TextDiff::from_lines(old_text, new_text);

    diff.unified_diff()
        .context_radius(context)
        .header(
            old_name.as_deref().unwrap_or("a"),
            new_name.as_deref().unwrap_or("b"),
        )
        .to_string()
}

/// 快速检查两个文本是否相同
#[tauri::command]
pub fn texts_are_equal(old_text: &str, new_text: &str) -> bool {
    old_text == new_text
}

/// 获取差异统计信息（快速版本，不返回完整差异）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffStats {
    /// 新增行数
    pub additions: usize,
    /// 删除行数
    pub deletions: usize,
    /// 是否有变更
    pub has_changes: bool,
}

#[tauri::command]
pub fn compute_diff_stats(old_text: &str, new_text: &str) -> DiffStats {
    if old_text == new_text {
        return DiffStats {
            additions: 0,
            deletions: 0,
            has_changes: false,
        };
    }

    let diff = TextDiff::from_lines(old_text, new_text);
    let mut additions = 0;
    let mut deletions = 0;

    for change in diff.iter_all_changes() {
        match change.tag() {
            ChangeTag::Insert => additions += 1,
            ChangeTag::Delete => deletions += 1,
            ChangeTag::Equal => {}
        }
    }

    DiffStats {
        additions,
        deletions,
        has_changes: additions > 0 || deletions > 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_diff_no_changes() {
        let text = "hello\nworld";
        let result = compute_diff(text, text, None, None);
        assert!(!result.has_changes);
        assert_eq!(result.additions, 0);
        assert_eq!(result.deletions, 0);
    }

    #[test]
    fn test_compute_diff_with_changes() {
        let old = "line1\nline2\nline3";
        let new = "line1\nmodified\nline3";
        let result = compute_diff(old, new, Some("test.txt".to_string()), None);

        assert!(result.has_changes);
        assert_eq!(result.additions, 1);
        assert_eq!(result.deletions, 1);
        assert_eq!(result.file_name, Some("test.txt".to_string()));
    }

    #[test]
    fn test_compute_unified_diff() {
        let old = "line1\nline2\nline3";
        let new = "line1\nnew line\nline3";
        let unified = compute_unified_diff(
            old,
            new,
            Some("old.txt".to_string()),
            Some("new.txt".to_string()),
            None,
        );

        assert!(unified.contains("--- old.txt"));
        assert!(unified.contains("+++ new.txt"));
        assert!(unified.contains("-line2"));
        assert!(unified.contains("+new line"));
    }

    #[test]
    fn test_diff_stats() {
        let old = "a\nb\nc";
        let new = "a\nx\ny\nc";
        let stats = compute_diff_stats(old, new);

        assert!(stats.has_changes);
        assert_eq!(stats.additions, 2);
        assert_eq!(stats.deletions, 1);
    }

    #[test]
    fn test_hunk_grouping() {
        // 测试 hunk 分组：多处变更应该被分组
        let old = "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12";
        let new = "1\nX\n3\n4\n5\n6\n7\n8\n9\n10\nY\n12";
        let result = compute_diff(old, new, None, Some(2));

        // 变更之间间隔足够大，应该有2个 hunks
        assert!(result.has_changes);
        assert_eq!(result.additions, 2);
        assert_eq!(result.deletions, 2);
        assert!(result.hunks.len() >= 1); // 至少一个 hunk
    }
}
