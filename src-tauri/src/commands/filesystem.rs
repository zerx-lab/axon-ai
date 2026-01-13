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

/// 写入文件内容
/// 将内容写入指定文件路径
#[tauri::command]
pub async fn write_file_content(path: String, content: String) -> Result<(), String> {
    debug!("写入文件内容: {}", path);

    let file_path = Path::new(&path);

    // 确保父目录存在
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| {
                error!("创建父目录失败: {:?}, 错误: {}", parent, e);
                format!("创建父目录失败: {}", e)
            })?;
        }
    }

    // 写入文件
    match std::fs::write(file_path, &content) {
        Ok(()) => {
            debug!("成功写入文件，大小: {} 字节", content.len());
            Ok(())
        }
        Err(e) => {
            error!("写入文件失败: {:?}, 错误: {}", file_path, e);
            
            #[cfg(target_os = "windows")]
            {
                use std::io::ErrorKind;
                if e.kind() == ErrorKind::PermissionDenied {
                    return Err("写入文件失败: 文件可能被其他程序占用，请关闭占用程序后重试".to_string());
                }
            }
            
            Err(format!("写入文件失败: {}", e))
        }
    }
}

/// 删除文件或目录
/// 如果是目录，递归删除所有内容
#[tauri::command]
pub async fn delete_path(path: String) -> Result<(), String> {
    debug!("删除路径: {}", path);

    let target_path = Path::new(&path);

    if !target_path.exists() {
        error!("路径不存在: {:?}", target_path);
        return Err(format!("路径不存在: {}", path));
    }

    if target_path.is_dir() {
        std::fs::remove_dir_all(target_path).map_err(|e| {
            error!("删除目录失败: {:?}, 错误: {}", target_path, e);
            format!("删除目录失败: {}", e)
        })?;
    } else {
        std::fs::remove_file(target_path).map_err(|e| {
            error!("删除文件失败: {:?}, 错误: {}", target_path, e);
            format!("删除文件失败: {}", e)
        })?;
    }

    debug!("删除成功: {:?}", target_path);
    Ok(())
}

/// 重命名文件或目录
#[tauri::command]
pub async fn rename_path(old_path: String, new_name: String) -> Result<String, String> {
    debug!("重命名: {} -> {}", old_path, new_name);

    let source_path = Path::new(&old_path);

    if !source_path.exists() {
        error!("源路径不存在: {:?}", source_path);
        return Err(format!("源路径不存在: {}", old_path));
    }

    // 获取父目录并构建新路径
    let parent = source_path.parent().ok_or_else(|| {
        error!("无法获取父目录: {:?}", source_path);
        "无法获取父目录".to_string()
    })?;

    let new_path = parent.join(&new_name);

    if new_path.exists() {
        error!("目标路径已存在: {:?}", new_path);
        return Err(format!("目标路径已存在: {}", new_name));
    }

    std::fs::rename(source_path, &new_path).map_err(|e| {
        error!("重命名失败: {:?} -> {:?}, 错误: {}", source_path, new_path, e);
        format!("重命名失败: {}", e)
    })?;

    let result = new_path.to_string_lossy().to_string();
    debug!("重命名成功: {:?}", new_path);
    Ok(result)
}

/// 复制文件或目录
/// 返回新路径
#[tauri::command]
pub async fn copy_path(source: String, dest_dir: String) -> Result<String, String> {
    debug!("复制: {} -> {}", source, dest_dir);

    let source_path = Path::new(&source);
    let dest_dir_path = Path::new(&dest_dir);

    if !source_path.exists() {
        error!("源路径不存在: {:?}", source_path);
        return Err(format!("源路径不存在: {}", source));
    }

    if !dest_dir_path.is_dir() {
        error!("目标必须是目录: {:?}", dest_dir_path);
        return Err(format!("目标必须是目录: {}", dest_dir));
    }

    let file_name = source_path.file_name().ok_or_else(|| {
        error!("无法获取文件名: {:?}", source_path);
        "无法获取文件名".to_string()
    })?;

    let dest_path = dest_dir_path.join(file_name);

    // 如果目标已存在，自动添加后缀
    let final_dest = if dest_path.exists() {
        generate_unique_path(&dest_path)
    } else {
        dest_path
    };

    if source_path.is_dir() {
        copy_dir_recursive(source_path, &final_dest)?;
    } else {
        std::fs::copy(source_path, &final_dest).map_err(|e| {
            error!("复制文件失败: {:?} -> {:?}, 错误: {}", source_path, final_dest, e);
            format!("复制文件失败: {}", e)
        })?;
    }

    let result = final_dest.to_string_lossy().to_string();
    debug!("复制成功: {:?}", final_dest);
    Ok(result)
}

/// 移动文件或目录
/// 返回新路径
#[tauri::command]
pub async fn move_path(source: String, dest_dir: String) -> Result<String, String> {
    debug!("移动: {} -> {}", source, dest_dir);

    let source_path = Path::new(&source);
    let dest_dir_path = Path::new(&dest_dir);

    if !source_path.exists() {
        error!("源路径不存在: {:?}", source_path);
        return Err(format!("源路径不存在: {}", source));
    }

    if !dest_dir_path.is_dir() {
        error!("目标必须是目录: {:?}", dest_dir_path);
        return Err(format!("目标必须是目录: {}", dest_dir));
    }

    let file_name = source_path.file_name().ok_or_else(|| {
        error!("无法获取文件名: {:?}", source_path);
        "无法获取文件名".to_string()
    })?;

    let dest_path = dest_dir_path.join(file_name);

    // 如果目标已存在，自动添加后缀
    let final_dest = if dest_path.exists() {
        generate_unique_path(&dest_path)
    } else {
        dest_path
    };

    // 尝试直接 rename（同一文件系统）
    match std::fs::rename(source_path, &final_dest) {
        Ok(()) => {
            let result = final_dest.to_string_lossy().to_string();
            debug!("移动成功（rename）: {:?}", final_dest);
            Ok(result)
        }
        Err(_) => {
            // 跨文件系统移动：先复制再删除
            if source_path.is_dir() {
                copy_dir_recursive(source_path, &final_dest)?;
                std::fs::remove_dir_all(source_path).map_err(|e| {
                    error!("删除源目录失败: {:?}, 错误: {}", source_path, e);
                    format!("移动成功但删除源目录失败: {}", e)
                })?;
            } else {
                std::fs::copy(source_path, &final_dest).map_err(|e| {
                    error!("复制文件失败: {:?}, 错误: {}", source_path, e);
                    format!("复制文件失败: {}", e)
                })?;
                std::fs::remove_file(source_path).map_err(|e| {
                    error!("删除源文件失败: {:?}, 错误: {}", source_path, e);
                    format!("移动成功但删除源文件失败: {}", e)
                })?;
            }
            let result = final_dest.to_string_lossy().to_string();
            debug!("移动成功（copy+delete）: {:?}", final_dest);
            Ok(result)
        }
    }
}

/// 生成唯一路径（当目标已存在时）
fn generate_unique_path(path: &Path) -> std::path::PathBuf {
    let parent = path.parent().unwrap_or(Path::new(""));
    let stem = path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let ext = path.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();

    let mut counter = 1;
    loop {
        let new_name = format!("{} ({}){}", stem, counter, ext);
        let new_path = parent.join(&new_name);
        if !new_path.exists() {
            return new_path;
        }
        counter += 1;
    }
}

/// 递归复制目录
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|e| {
        error!("创建目录失败: {:?}, 错误: {}", dst, e);
        format!("创建目录失败: {}", e)
    })?;

    for entry in std::fs::read_dir(src).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path).map_err(|e| {
                error!("复制文件失败: {:?} -> {:?}, 错误: {}", src_path, dst_path, e);
                format!("复制文件失败: {}", e)
            })?;
        }
    }

    Ok(())
}

/// 读取文件内容为 Base64
/// 用于读取图片等二进制文件
#[tauri::command]
pub async fn read_file_binary(path: String) -> Result<String, String> {
    debug!("读取二进制文件: {}", path);

    let file_path = Path::new(&path);

    if !file_path.exists() {
        error!("文件不存在: {:?}", file_path);
        return Err(format!("文件不存在: {}", path));
    }

    if !file_path.is_file() {
        error!("路径不是文件: {:?}", file_path);
        return Err(format!("路径不是文件: {}", path));
    }

    // 读取文件为字节
    match std::fs::read(file_path) {
        Ok(bytes) => {
            use base64::Engine;
            let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
            debug!("成功读取二进制文件，原始大小: {} 字节", bytes.len());
            Ok(encoded)
        }
        Err(e) => {
            error!("读取文件失败: {:?}, 错误: {}", file_path, e);
            Err(format!("读取文件失败: {}", e))
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
