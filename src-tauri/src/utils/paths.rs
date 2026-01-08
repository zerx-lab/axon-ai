//! 应用路径工具模块
//!
//! 使用 Tauri API 获取应用数据目录，确保路径与 tauri.conf.json 中的 identifier 一致

use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};
use tracing::{debug, info};

/// 全局存储应用数据目录
static APP_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

/// 初始化应用数据目录（必须在 Tauri setup 阶段调用）
///
/// 使用 Tauri 的 `app_data_dir` API，确保路径与 tauri.conf.json 中的 identifier 一致
/// Windows: C:\Users\<user>\AppData\Roaming\com.zero.axon_desktop
/// macOS: ~/Library/Application Support/com.zero.axon_desktop
/// Linux: ~/.local/share/com.zero.axon_desktop
pub fn init_app_data_dir(handle: &AppHandle) -> Result<(), String> {
    let path = handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;

    // 确保目录存在
    if !path.exists() {
        std::fs::create_dir_all(&path)
            .map_err(|e| format!("创建应用数据目录失败: {}", e))?;
    }

    info!("应用数据目录: {:?}", path);
    APP_DATA_DIR
        .set(path)
        .map_err(|_| "APP_DATA_DIR 已初始化".to_string())
}

/// 获取应用数据目录
pub fn get_app_data_dir() -> Option<PathBuf> {
    APP_DATA_DIR.get().cloned()
}

/// 获取二进制文件存储目录
/// 路径: <app_data_dir>/bin
pub fn get_bin_dir() -> Option<PathBuf> {
    get_app_data_dir().map(|p| p.join("bin"))
}

/// 获取 opencode 二进制文件路径
/// Windows: <app_data_dir>/bin/opencode.exe
/// Unix: <app_data_dir>/bin/opencode
pub fn get_opencode_bin_path() -> Option<PathBuf> {
    get_bin_dir().map(|p| {
        if cfg!(windows) {
            p.join("opencode.exe")
        } else {
            p.join("opencode")
        }
    })
}

/// 确保目录存在
pub fn ensure_dir_exists(path: &Path) -> Result<(), std::io::Error> {
    if !path.exists() {
        debug!("创建目录: {:?}", path);
        std::fs::create_dir_all(path)?;
    }
    Ok(())
}
