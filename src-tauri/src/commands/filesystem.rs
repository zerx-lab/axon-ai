//! 文件系统相关命令
//!
//! 提供目录操作功能，包括：
//! - 确保目录存在
//! - 打开目录选择对话框
//! - 读取目录内容

use serde::Serialize;
use std::path::Path;
use tauri::AppHandle;
use tracing::{debug, error};

/// 文件/目录条目信息
#[derive(Debug, Clone, Serialize)]
pub struct FileEntry {
    /// 文件/目录名称
    pub name: String,
    /// 完整路径
    pub path: String,
    /// 是否为目录
    pub is_directory: bool,
    /// 是否为隐藏文件（以 . 开头）
    pub is_hidden: bool,
    /// 文件大小（字节），目录为 None
    pub size: Option<u64>,
    /// 修改时间（Unix 时间戳毫秒）
    pub modified_at: Option<u64>,
}

/// 确保目录存在
/// 如果目录不存在，则递归创建
#[tauri::command]
pub async fn ensure_directory_exists(path: String) -> Result<(), String> {
    debug!("确保目录存在: {}", path);
    
    let path = Path::new(&path);
    
    if path.exists() {
        if path.is_dir() {
            debug!("目录已存在: {:?}", path);
            return Ok(());
        } else {
            error!("路径存在但不是目录: {:?}", path);
            return Err(format!("路径存在但不是目录: {:?}", path));
        }
    }
    
    // 递归创建目录
    std::fs::create_dir_all(path).map_err(|e| {
        error!("创建目录失败: {:?}, 错误: {}", path, e);
        format!("创建目录失败: {}", e)
    })?;
    
    debug!("目录创建成功: {:?}", path);
    Ok(())
}

/// 读取目录内容
/// 返回目录下的文件和子目录列表
#[tauri::command]
pub async fn read_directory(path: String, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
    debug!("读取目录内容: {}, 显示隐藏文件: {}", path, show_hidden);

    let dir_path = Path::new(&path);

    if !dir_path.exists() {
        error!("目录不存在: {:?}", dir_path);
        return Err(format!("目录不存在: {}", path));
    }

    if !dir_path.is_dir() {
        error!("路径不是目录: {:?}", dir_path);
        return Err(format!("路径不是目录: {}", path));
    }

    let mut entries = Vec::new();

    match std::fs::read_dir(dir_path) {
        Ok(read_dir) => {
            for entry_result in read_dir {
                match entry_result {
                    Ok(entry) => {
                        let file_name = entry.file_name().to_string_lossy().to_string();
                        let is_hidden = file_name.starts_with('.');

                        // 根据设置决定是否包含隐藏文件
                        if !show_hidden && is_hidden {
                            continue;
                        }

                        let file_path = entry.path();
                        let metadata = entry.metadata().ok();

                        let is_directory = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
                        let size = if is_directory {
                            None
                        } else {
                            metadata.as_ref().map(|m| m.len())
                        };
                        let modified_at = metadata.and_then(|m| {
                            m.modified().ok().and_then(|t| {
                                t.duration_since(std::time::UNIX_EPOCH)
                                    .ok()
                                    .map(|d| d.as_millis() as u64)
                            })
                        });

                        entries.push(FileEntry {
                            name: file_name,
                            path: file_path.to_string_lossy().to_string(),
                            is_directory,
                            is_hidden,
                            size,
                            modified_at,
                        });
                    }
                    Err(e) => {
                        debug!("跳过无法读取的条目: {}", e);
                    }
                }
            }
        }
        Err(e) => {
            error!("读取目录失败: {:?}, 错误: {}", dir_path, e);
            return Err(format!("读取目录失败: {}", e));
        }
    }

    // 排序：目录在前，然后按名称排序（不区分大小写）
    entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    debug!("读取到 {} 个条目", entries.len());
    Ok(entries)
}

/// 读取文件内容
/// 返回文件的文本内容
#[tauri::command]
pub async fn read_file_content(path: String) -> Result<String, String> {
    debug!("读取文件内容: {}", path);

    let file_path = Path::new(&path);

    if !file_path.exists() {
        error!("文件不存在: {:?}", file_path);
        return Err(format!("文件不存在: {}", path));
    }

    if !file_path.is_file() {
        error!("路径不是文件: {:?}", file_path);
        return Err(format!("路径不是文件: {}", path));
    }

    // 读取文件内容
    match std::fs::read_to_string(file_path) {
        Ok(content) => {
            debug!("成功读取文件，大小: {} 字节", content.len());
            Ok(content)
        }
        Err(e) => {
            // 如果是编码错误，尝试读取为二进制并转换
            if e.kind() == std::io::ErrorKind::InvalidData {
                debug!("文件可能不是 UTF-8 编码，尝试读取二进制");
                match std::fs::read(file_path) {
                    Ok(bytes) => {
                        // 尝试使用有损转换
                        let content = String::from_utf8_lossy(&bytes).to_string();
                        Ok(content)
                    }
                    Err(read_err) => {
                        error!("读取文件失败: {:?}, 错误: {}", file_path, read_err);
                        Err(format!("读取文件失败: {}", read_err))
                    }
                }
            } else {
                error!("读取文件失败: {:?}, 错误: {}", file_path, e);
                Err(format!("读取文件失败: {}", e))
            }
        }
    }
}

/// 打开目录选择对话框
/// 返回用户选择的目录路径，如果用户取消则返回 None
#[tauri::command]
pub async fn select_directory(app: AppHandle) -> Result<Option<String>, String> {
    use tauri::Manager;
    use tauri_plugin_dialog::DialogExt;
    
    debug!("打开目录选择对话框");
    
    // 获取主窗口作为对话框的父窗口
    let window = app.get_webview_window("main");
    
    // 创建文件夹选择对话框
    let mut dialog = app.dialog().file();
    
    // 如果有窗口，设置为父窗口
    if let Some(ref win) = window {
        dialog = dialog.set_parent(win);
    }
    
    // 设置标题并打开选择器
    let result = dialog
        .set_title("选择项目目录")
        .blocking_pick_folder();
    
    match result {
        Some(path) => {
            let path_str = path.to_string();
            debug!("用户选择目录: {}", path_str);
            Ok(Some(path_str))
        }
        None => {
            debug!("用户取消选择");
            Ok(None)
        }
    }
}
