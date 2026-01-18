//! Workflow 配置管理命令
//!
//! 提供 Workflow 配置文件的读写功能：
//! - 读取所有 Workflow 配置
//! - 保存单个 Workflow 配置
//! - 删除 Workflow 配置
//! - 获取 Workflow 存储目录

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tracing::{debug, error, info};

/// Workflow 配置目录名称
const WORKFLOWS_DIR: &str = "workflows";

/// Workflow 配置文件扩展名
const WORKFLOW_FILE_EXT: &str = ".json";

/// Workflow 配置摘要（用于列表展示）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowSummary {
    /// 唯一标识
    pub id: String,
    /// 显示名称
    pub name: String,
    /// 描述
    pub description: String,
    /// 图标
    pub icon: Option<String>,
    /// 颜色
    pub color: Option<String>,
    /// 状态
    pub status: String,
    /// 子 Agent 数量
    pub subagent_count: i64,
    /// 更新时间
    pub updated_at: i64,
}

/// 获取 Workflow 配置存储目录
/// 
/// 返回应用数据目录下的 workflows 文件夹路径
#[tauri::command]
pub async fn get_workflows_directory(app: AppHandle) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {}", e))?;
    
    let workflows_dir = app_data_dir.join(WORKFLOWS_DIR);
    
    // 确保目录存在
    if !workflows_dir.exists() {
        std::fs::create_dir_all(&workflows_dir).map_err(|e| {
            error!("创建 workflows 目录失败: {:?}, 错误: {}", workflows_dir, e);
            format!("创建 workflows 目录失败: {}", e)
        })?;
        info!("创建 workflows 目录: {:?}", workflows_dir);
    }
    
    Ok(workflows_dir.to_string_lossy().to_string())
}

/// 列出所有 Workflow 配置摘要
/// 
/// 读取 workflows 目录下的所有 JSON 文件，返回配置摘要列表
#[tauri::command]
pub async fn list_workflows(app: AppHandle) -> Result<Vec<WorkflowSummary>, String> {
    let workflows_dir = get_workflows_dir_path(&app)?;
    
    debug!("列出 workflows 目录: {:?}", workflows_dir);
    
    if !workflows_dir.exists() {
        debug!("workflows 目录不存在，返回空列表");
        return Ok(Vec::new());
    }
    
    let mut workflows = Vec::new();
    
    let entries = std::fs::read_dir(&workflows_dir).map_err(|e| {
        error!("读取 workflows 目录失败: {:?}, 错误: {}", workflows_dir, e);
        format!("读取 workflows 目录失败: {}", e)
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
        
        // 读取并解析 JSON
        match read_workflow_summary(&path) {
            Ok(summary) => {
                workflows.push(summary);
            }
            Err(e) => {
                debug!("跳过无法解析的 workflow 文件 {:?}: {}", path, e);
            }
        }
    }
    
    // 按更新时间降序排序
    workflows.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    
    debug!("找到 {} 个 workflow 配置", workflows.len());
    Ok(workflows)
}

/// 读取单个 Workflow 完整配置
/// 
/// 根据 Workflow ID 读取完整的 JSON 配置
#[tauri::command]
pub async fn read_workflow(app: AppHandle, workflow_id: String) -> Result<String, String> {
    let workflows_dir = get_workflows_dir_path(&app)?;
    let workflow_path = workflows_dir.join(format!("{}{}", workflow_id, WORKFLOW_FILE_EXT));
    
    debug!("读取 workflow 配置: {:?}", workflow_path);
    
    if !workflow_path.exists() {
        error!("Workflow 配置文件不存在: {:?}", workflow_path);
        return Err(format!("Workflow 不存在: {}", workflow_id));
    }
    
    let content = std::fs::read_to_string(&workflow_path).map_err(|e| {
        error!("读取 workflow 文件失败: {:?}, 错误: {}", workflow_path, e);
        format!("读取 Workflow 配置失败: {}", e)
    })?;
    
    Ok(content)
}

/// 保存 Workflow 配置
/// 
/// 将 Workflow 配置保存到文件，文件名为 {workflow_id}.json
#[tauri::command]
pub async fn save_workflow(app: AppHandle, workflow_id: String, config: String) -> Result<(), String> {
    let workflows_dir = get_workflows_dir_path(&app)?;
    
    // 确保目录存在
    if !workflows_dir.exists() {
        std::fs::create_dir_all(&workflows_dir).map_err(|e| {
            error!("创建 workflows 目录失败: {:?}, 错误: {}", workflows_dir, e);
            format!("创建 workflows 目录失败: {}", e)
        })?;
    }
    
    let workflow_path = workflows_dir.join(format!("{}{}", workflow_id, WORKFLOW_FILE_EXT));
    
    debug!("保存 workflow 配置: {:?}", workflow_path);
    
    // 验证 JSON 格式
    let _: serde_json::Value = serde_json::from_str(&config).map_err(|e| {
        error!("无效的 JSON 格式: {}", e);
        format!("无效的 Workflow 配置格式: {}", e)
    })?;
    
    // 格式化 JSON 输出（便于阅读）
    let formatted = format_json(&config)?;
    
    std::fs::write(&workflow_path, formatted).map_err(|e| {
        error!("写入 workflow 文件失败: {:?}, 错误: {}", workflow_path, e);
        format!("保存 Workflow 配置失败: {}", e)
    })?;
    
    info!("Workflow 配置已保存: {}", workflow_id);
    Ok(())
}

/// 删除 Workflow 配置
/// 
/// 删除指定 ID 的 Workflow 配置文件
#[tauri::command]
pub async fn delete_workflow(app: AppHandle, workflow_id: String) -> Result<(), String> {
    let workflows_dir = get_workflows_dir_path(&app)?;
    let workflow_path = workflows_dir.join(format!("{}{}", workflow_id, WORKFLOW_FILE_EXT));
    
    debug!("删除 workflow 配置: {:?}", workflow_path);
    
    if !workflow_path.exists() {
        error!("Workflow 配置文件不存在: {:?}", workflow_path);
        return Err(format!("Workflow 不存在: {}", workflow_id));
    }
    
    std::fs::remove_file(&workflow_path).map_err(|e| {
        error!("删除 workflow 文件失败: {:?}, 错误: {}", workflow_path, e);
        format!("删除 Workflow 配置失败: {}", e)
    })?;
    
    info!("Workflow 配置已删除: {}", workflow_id);
    Ok(())
}

/// 批量保存 Workflow 配置
/// 
/// 一次性保存多个 Workflow 配置
#[tauri::command]
pub async fn save_workflows_batch(
    app: AppHandle, 
    workflows: Vec<(String, String)>
) -> Result<(), String> {
    let workflows_dir = get_workflows_dir_path(&app)?;
    
    // 确保目录存在
    if !workflows_dir.exists() {
        std::fs::create_dir_all(&workflows_dir).map_err(|e| {
            error!("创建 workflows 目录失败: {:?}, 错误: {}", workflows_dir, e);
            format!("创建 workflows 目录失败: {}", e)
        })?;
    }
    
    let mut errors = Vec::new();
    
    for (workflow_id, config) in workflows {
        let workflow_path = workflows_dir.join(format!("{}{}", workflow_id, WORKFLOW_FILE_EXT));
        
        // 验证并格式化 JSON
        match format_json(&config) {
            Ok(formatted) => {
                if let Err(e) = std::fs::write(&workflow_path, formatted) {
                    errors.push(format!("{}: {}", workflow_id, e));
                }
            }
            Err(e) => {
                errors.push(format!("{}: {}", workflow_id, e));
            }
        }
    }
    
    if errors.is_empty() {
        info!("批量保存 workflow 配置成功");
        Ok(())
    } else {
        Err(format!("部分保存失败: {}", errors.join(", ")))
    }
}

// ============================================================================
// 辅助函数
// ============================================================================

/// 获取 workflows 目录路径
fn get_workflows_dir_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {}", e))?;
    
    Ok(app_data_dir.join(WORKFLOWS_DIR))
}

/// 从文件读取 Workflow 摘要
fn read_workflow_summary(path: &Path) -> Result<WorkflowSummary, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("读取文件失败: {}", e))?;
    
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析 JSON 失败: {}", e))?;
    
    // 提取摘要字段
    let id = json.get("id")
        .and_then(|v| v.as_str())
        .ok_or("缺少 id 字段")?
        .to_string();
    
    let name = json.get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();
    
    let description = json.get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    
    let icon = json.get("icon")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    
    let color = json.get("color")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    
    let status = json.get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("draft")
        .to_string();
    
    let subagent_count = json.get("subagents")
        .and_then(|v| v.as_array())
        .map(|arr| arr.len() as i64)
        .unwrap_or(0);
    
    let updated_at = json.get("updatedAt")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    
    Ok(WorkflowSummary {
        id,
        name,
        description,
        icon,
        color,
        status,
        subagent_count,
        updated_at,
    })
}

/// 格式化 JSON 字符串（美化输出）
fn format_json(json_str: &str) -> Result<String, String> {
    let value: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| format!("无效的 JSON: {}", e))?;
    
    serde_json::to_string_pretty(&value)
        .map_err(|e| format!("格式化 JSON 失败: {}", e))
}
