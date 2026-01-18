//! 编排组配置管理命令
//!
//! 提供 OrchestrationGroup 配置文件的读写功能：
//! - 读取所有编排组配置
//! - 保存单个编排组配置
//! - 删除编排组配置
//! - 获取编排组存储目录

use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tracing::{debug, error, info};

/// 编排组配置目录名称
const ORCHESTRATIONS_DIR: &str = "orchestrations";

/// 编排组配置文件扩展名
const ORCHESTRATION_FILE_EXT: &str = ".json";

/// 获取编排组配置存储目录
///
/// 返回应用数据目录下的 orchestrations 文件夹路径
#[tauri::command]
pub async fn get_orchestrations_directory(app: AppHandle) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {}", e))?;

    let orchestrations_dir = app_data_dir.join(ORCHESTRATIONS_DIR);

    // 确保目录存在
    if !orchestrations_dir.exists() {
        std::fs::create_dir_all(&orchestrations_dir).map_err(|e| {
            error!(
                "创建 orchestrations 目录失败: {:?}, 错误: {}",
                orchestrations_dir, e
            );
            format!("创建 orchestrations 目录失败: {}", e)
        })?;
        info!("创建 orchestrations 目录: {:?}", orchestrations_dir);
    }

    Ok(orchestrations_dir.to_string_lossy().to_string())
}

/// 列出所有编排组配置
///
/// 读取 orchestrations 目录下的所有 JSON 文件，返回完整配置列表（JSON 字符串）
#[tauri::command]
pub async fn list_orchestrations(app: AppHandle) -> Result<String, String> {
    let orchestrations_dir = get_orchestrations_dir_path(&app)?;

    debug!("列出 orchestrations 目录: {:?}", orchestrations_dir);

    if !orchestrations_dir.exists() {
        debug!("orchestrations 目录不存在，返回空列表");
        return Ok("[]".to_string());
    }

    let mut groups = Vec::new();

    let entries = std::fs::read_dir(&orchestrations_dir).map_err(|e| {
        error!(
            "读取 orchestrations 目录失败: {:?}, 错误: {}",
            orchestrations_dir, e
        );
        format!("读取 orchestrations 目录失败: {}", e)
    })?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                debug!("跳过无法读取的条目: {}", e);
                continue;
            }
        };

        let path = entry.path();

        // 只处理 .json 文件
        if !path.is_file() || path.extension().map(|e| e != "json").unwrap_or(true) {
            continue;
        }

        // 读取 JSON 内容
        match std::fs::read_to_string(&path) {
            Ok(content) => {
                // 验证是有效的 JSON
                if serde_json::from_str::<serde_json::Value>(&content).is_ok() {
                    groups.push(content);
                } else {
                    debug!("跳过无效的 JSON 文件: {:?}", path);
                }
            }
            Err(e) => {
                debug!("跳过无法读取的文件 {:?}: {}", path, e);
            }
        }
    }

    // 构建 JSON 数组
    let result = format!("[{}]", groups.join(","));

    debug!("找到 {} 个编排组配置", groups.len());
    Ok(result)
}

/// 读取单个编排组完整配置
///
/// 根据编排组 ID 读取完整的 JSON 配置
#[tauri::command]
pub async fn read_orchestration(
    app: AppHandle,
    orchestration_id: String,
) -> Result<String, String> {
    let orchestrations_dir = get_orchestrations_dir_path(&app)?;
    let orchestration_path =
        orchestrations_dir.join(format!("{}{}", orchestration_id, ORCHESTRATION_FILE_EXT));

    debug!("读取编排组配置: {:?}", orchestration_path);

    if !orchestration_path.exists() {
        error!("编排组配置文件不存在: {:?}", orchestration_path);
        return Err(format!("编排组不存在: {}", orchestration_id));
    }

    let content = std::fs::read_to_string(&orchestration_path).map_err(|e| {
        error!(
            "读取编排组文件失败: {:?}, 错误: {}",
            orchestration_path, e
        );
        format!("读取编排组配置失败: {}", e)
    })?;

    Ok(content)
}

/// 保存编排组配置
///
/// 将编排组配置保存到文件，文件名为 {orchestration_id}.json
#[tauri::command]
pub async fn save_orchestration(
    app: AppHandle,
    orchestration_id: String,
    config: String,
) -> Result<(), String> {
    let orchestrations_dir = get_orchestrations_dir_path(&app)?;

    // 确保目录存在
    if !orchestrations_dir.exists() {
        std::fs::create_dir_all(&orchestrations_dir).map_err(|e| {
            error!(
                "创建 orchestrations 目录失败: {:?}, 错误: {}",
                orchestrations_dir, e
            );
            format!("创建 orchestrations 目录失败: {}", e)
        })?;
    }

    let orchestration_path =
        orchestrations_dir.join(format!("{}{}", orchestration_id, ORCHESTRATION_FILE_EXT));

    debug!("保存编排组配置: {:?}", orchestration_path);

    // 验证 JSON 格式
    let _: serde_json::Value = serde_json::from_str(&config).map_err(|e| {
        error!("无效的 JSON 格式: {}", e);
        format!("无效的编排组配置格式: {}", e)
    })?;

    // 格式化 JSON 输出（便于阅读）
    let formatted = format_json(&config)?;

    std::fs::write(&orchestration_path, formatted).map_err(|e| {
        error!(
            "写入编排组文件失败: {:?}, 错误: {}",
            orchestration_path, e
        );
        format!("保存编排组配置失败: {}", e)
    })?;

    info!("编排组配置已保存: {}", orchestration_id);
    Ok(())
}

/// 删除编排组配置
///
/// 删除指定 ID 的编排组配置文件
#[tauri::command]
pub async fn delete_orchestration(
    app: AppHandle,
    orchestration_id: String,
) -> Result<(), String> {
    let orchestrations_dir = get_orchestrations_dir_path(&app)?;
    let orchestration_path =
        orchestrations_dir.join(format!("{}{}", orchestration_id, ORCHESTRATION_FILE_EXT));

    debug!("删除编排组配置: {:?}", orchestration_path);

    if !orchestration_path.exists() {
        error!("编排组配置文件不存在: {:?}", orchestration_path);
        return Err(format!("编排组不存在: {}", orchestration_id));
    }

    std::fs::remove_file(&orchestration_path).map_err(|e| {
        error!(
            "删除编排组文件失败: {:?}, 错误: {}",
            orchestration_path, e
        );
        format!("删除编排组配置失败: {}", e)
    })?;

    info!("编排组配置已删除: {}", orchestration_id);
    Ok(())
}

/// 批量保存编排组配置
///
/// 一次性保存多个编排组配置
#[tauri::command]
pub async fn save_orchestrations_batch(
    app: AppHandle,
    orchestrations: Vec<(String, String)>,
) -> Result<(), String> {
    let orchestrations_dir = get_orchestrations_dir_path(&app)?;

    // 确保目录存在
    if !orchestrations_dir.exists() {
        std::fs::create_dir_all(&orchestrations_dir).map_err(|e| {
            error!(
                "创建 orchestrations 目录失败: {:?}, 错误: {}",
                orchestrations_dir, e
            );
            format!("创建 orchestrations 目录失败: {}", e)
        })?;
    }

    let mut errors = Vec::new();

    for (orchestration_id, config) in orchestrations {
        let orchestration_path =
            orchestrations_dir.join(format!("{}{}", orchestration_id, ORCHESTRATION_FILE_EXT));

        // 验证并格式化 JSON
        match format_json(&config) {
            Ok(formatted) => {
                if let Err(e) = std::fs::write(&orchestration_path, formatted) {
                    errors.push(format!("{}: {}", orchestration_id, e));
                }
            }
            Err(e) => {
                errors.push(format!("{}: {}", orchestration_id, e));
            }
        }
    }

    if errors.is_empty() {
        info!("批量保存编排组配置成功");
        Ok(())
    } else {
        Err(format!("部分保存失败: {}", errors.join(", ")))
    }
}

// ============================================================================
// 辅助函数
// ============================================================================

/// 获取 orchestrations 目录路径
fn get_orchestrations_dir_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {}", e))?;

    Ok(app_data_dir.join(ORCHESTRATIONS_DIR))
}

/// 格式化 JSON 字符串（美化输出）
fn format_json(json_str: &str) -> Result<String, String> {
    let value: serde_json::Value =
        serde_json::from_str(json_str).map_err(|e| format!("无效的 JSON: {}", e))?;

    serde_json::to_string_pretty(&value).map_err(|e| format!("格式化 JSON 失败: {}", e))
}
