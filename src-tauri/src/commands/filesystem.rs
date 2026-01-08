//! 文件系统相关命令
//!
//! 提供目录操作功能，包括：
//! - 确保目录存在
//! - 打开目录选择对话框

use std::path::Path;
use tauri::AppHandle;
use tracing::{debug, error};

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
