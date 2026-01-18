//! 插件安装模块
//!
//! 负责将打包的插件从应用资源目录安装到 app_data_dir

use crate::utils::paths::{ensure_dir_exists, get_axon_bridge_plugin_dir, get_axon_bridge_plugin_path};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tracing::{debug, info};

const BUNDLED_PLUGIN_PATH: &str = "plugins/opencode/index.js";

fn get_bundled_plugin_path(handle: &AppHandle) -> Option<PathBuf> {
    handle
        .path()
        .resource_dir()
        .ok()
        .map(|dir| dir.join(BUNDLED_PLUGIN_PATH))
}

pub fn install_bundled_plugins(handle: &AppHandle) -> Result<(), String> {
    let bundled_path = match get_bundled_plugin_path(handle) {
        Some(p) => p,
        None => {
            debug!("无法获取资源目录，可能在开发模式下运行");
            return Ok(());
        }
    };

    if !bundled_path.exists() {
        debug!("打包的插件不存在: {:?}，可能在开发模式下", bundled_path);
        return Ok(());
    }

    let target_dir = get_axon_bridge_plugin_dir()
        .ok_or_else(|| "无法获取插件目标目录".to_string())?;
    
    let target_path = get_axon_bridge_plugin_path()
        .ok_or_else(|| "无法获取插件目标路径".to_string())?;

    ensure_dir_exists(&target_dir)
        .map_err(|e| format!("创建插件目录失败: {}", e))?;

    let should_install = if target_path.exists() {
        let bundled_content = std::fs::read(&bundled_path)
            .map_err(|e| format!("读取打包插件失败: {}", e))?;
        let installed_content = std::fs::read(&target_path)
            .map_err(|e| format!("读取已安装插件失败: {}", e))?;
        bundled_content != installed_content
    } else {
        true
    };

    if should_install {
        info!("安装 Axon Bridge 插件: {:?} -> {:?}", bundled_path, target_path);
        std::fs::copy(&bundled_path, &target_path)
            .map_err(|e| format!("复制插件文件失败: {}", e))?;
        info!("Axon Bridge 插件安装完成");
    } else {
        debug!("插件已是最新版本，跳过安装");
    }

    Ok(())
}
