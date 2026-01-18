//! Agent 配置管理命令
//!
//! 提供 Agent 配置文件的读写功能：
//! - 读取所有 Agent 配置
//! - 保存单个 Agent 配置
//! - 删除 Agent 配置
//! - 获取 Agent 存储目录

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tracing::{debug, error, info};

/// Agent 配置目录名称
const AGENTS_DIR: &str = "agents";

/// Agent 配置文件扩展名
const AGENT_FILE_EXT: &str = ".json";

/// Agent 配置摘要（用于列表展示）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSummary {
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
    /// 模型 ID
    pub model_id: String,
    /// 是否为内置 Agent
    pub builtin: Option<bool>,
    /// 更新时间
    pub updated_at: i64,
}

/// 获取 Agent 配置存储目录
/// 
/// 返回应用数据目录下的 agents 文件夹路径
#[tauri::command]
pub async fn get_agents_directory(app: AppHandle) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {}", e))?;
    
    let agents_dir = app_data_dir.join(AGENTS_DIR);
    
    // 确保目录存在
    if !agents_dir.exists() {
        std::fs::create_dir_all(&agents_dir).map_err(|e| {
            error!("创建 agents 目录失败: {:?}, 错误: {}", agents_dir, e);
            format!("创建 agents 目录失败: {}", e)
        })?;
        info!("创建 agents 目录: {:?}", agents_dir);
    }
    
    Ok(agents_dir.to_string_lossy().to_string())
}

/// 列出所有 Agent 配置摘要
/// 
/// 读取 agents 目录下的所有 JSON 文件，返回配置摘要列表
#[tauri::command]
pub async fn list_agents(app: AppHandle) -> Result<Vec<AgentSummary>, String> {
    let agents_dir = get_agents_dir_path(&app)?;
    
    debug!("列出 agents 目录: {:?}", agents_dir);
    
    if !agents_dir.exists() {
        debug!("agents 目录不存在，返回空列表");
        return Ok(Vec::new());
    }
    
    let mut agents = Vec::new();
    
    let entries = std::fs::read_dir(&agents_dir).map_err(|e| {
        error!("读取 agents 目录失败: {:?}, 错误: {}", agents_dir, e);
        format!("读取 agents 目录失败: {}", e)
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
        match read_agent_summary(&path) {
            Ok(summary) => {
                agents.push(summary);
            }
            Err(e) => {
                debug!("跳过无法解析的 agent 文件 {:?}: {}", path, e);
            }
        }
    }
    
    // 按更新时间降序排序
    agents.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    
    debug!("找到 {} 个 agent 配置", agents.len());
    Ok(agents)
}

/// 读取单个 Agent 完整配置
/// 
/// 根据 Agent ID 读取完整的 JSON 配置
#[tauri::command]
pub async fn read_agent(app: AppHandle, agent_id: String) -> Result<String, String> {
    let agents_dir = get_agents_dir_path(&app)?;
    let agent_path = agents_dir.join(format!("{}{}", agent_id, AGENT_FILE_EXT));
    
    debug!("读取 agent 配置: {:?}", agent_path);
    
    if !agent_path.exists() {
        error!("Agent 配置文件不存在: {:?}", agent_path);
        return Err(format!("Agent 不存在: {}", agent_id));
    }
    
    let content = std::fs::read_to_string(&agent_path).map_err(|e| {
        error!("读取 agent 文件失败: {:?}, 错误: {}", agent_path, e);
        format!("读取 Agent 配置失败: {}", e)
    })?;
    
    Ok(content)
}

/// 保存 Agent 配置
/// 
/// 将 Agent 配置保存到文件，文件名为 {agent_id}.json
#[tauri::command]
pub async fn save_agent(app: AppHandle, agent_id: String, config: String) -> Result<(), String> {
    let agents_dir = get_agents_dir_path(&app)?;
    
    // 确保目录存在
    if !agents_dir.exists() {
        std::fs::create_dir_all(&agents_dir).map_err(|e| {
            error!("创建 agents 目录失败: {:?}, 错误: {}", agents_dir, e);
            format!("创建 agents 目录失败: {}", e)
        })?;
    }
    
    let agent_path = agents_dir.join(format!("{}{}", agent_id, AGENT_FILE_EXT));
    
    debug!("保存 agent 配置: {:?}", agent_path);
    
    // 验证 JSON 格式
    let _: serde_json::Value = serde_json::from_str(&config).map_err(|e| {
        error!("无效的 JSON 格式: {}", e);
        format!("无效的 Agent 配置格式: {}", e)
    })?;
    
    // 格式化 JSON 输出（便于阅读）
    let formatted = format_json(&config)?;
    
    std::fs::write(&agent_path, formatted).map_err(|e| {
        error!("写入 agent 文件失败: {:?}, 错误: {}", agent_path, e);
        format!("保存 Agent 配置失败: {}", e)
    })?;
    
    info!("Agent 配置已保存: {}", agent_id);
    Ok(())
}

/// 删除 Agent 配置
/// 
/// 删除指定 ID 的 Agent 配置文件
#[tauri::command]
pub async fn delete_agent(app: AppHandle, agent_id: String) -> Result<(), String> {
    let agents_dir = get_agents_dir_path(&app)?;
    let agent_path = agents_dir.join(format!("{}{}", agent_id, AGENT_FILE_EXT));
    
    debug!("删除 agent 配置: {:?}", agent_path);
    
    if !agent_path.exists() {
        error!("Agent 配置文件不存在: {:?}", agent_path);
        return Err(format!("Agent 不存在: {}", agent_id));
    }
    
    std::fs::remove_file(&agent_path).map_err(|e| {
        error!("删除 agent 文件失败: {:?}, 错误: {}", agent_path, e);
        format!("删除 Agent 配置失败: {}", e)
    })?;
    
    info!("Agent 配置已删除: {}", agent_id);
    Ok(())
}

/// 批量保存 Agent 配置
/// 
/// 一次性保存多个 Agent 配置
#[tauri::command]
pub async fn save_agents_batch(
    app: AppHandle, 
    agents: Vec<(String, String)>
) -> Result<(), String> {
    let agents_dir = get_agents_dir_path(&app)?;
    
    // 确保目录存在
    if !agents_dir.exists() {
        std::fs::create_dir_all(&agents_dir).map_err(|e| {
            error!("创建 agents 目录失败: {:?}, 错误: {}", agents_dir, e);
            format!("创建 agents 目录失败: {}", e)
        })?;
    }
    
    let mut errors = Vec::new();
    
    for (agent_id, config) in agents {
        let agent_path = agents_dir.join(format!("{}{}", agent_id, AGENT_FILE_EXT));
        
        // 验证并格式化 JSON
        match format_json(&config) {
            Ok(formatted) => {
                if let Err(e) = std::fs::write(&agent_path, formatted) {
                    errors.push(format!("{}: {}", agent_id, e));
                }
            }
            Err(e) => {
                errors.push(format!("{}: {}", agent_id, e));
            }
        }
    }
    
    if errors.is_empty() {
        info!("批量保存 agent 配置成功");
        Ok(())
    } else {
        Err(format!("部分保存失败: {}", errors.join(", ")))
    }
}

// ============================================================================
// 辅助函数
// ============================================================================

/// 获取 agents 目录路径
fn get_agents_dir_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {}", e))?;
    
    Ok(app_data_dir.join(AGENTS_DIR))
}

/// 从文件读取 Agent 摘要
fn read_agent_summary(path: &Path) -> Result<AgentSummary, String> {
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
    
    let model_id = json.get("model")
        .and_then(|v| v.get("modelId"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    
    let builtin = json.get("builtin")
        .and_then(|v| v.as_bool());
    
    let updated_at = json.get("updatedAt")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    
    Ok(AgentSummary {
        id,
        name,
        description,
        icon,
        color,
        model_id,
        builtin,
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
