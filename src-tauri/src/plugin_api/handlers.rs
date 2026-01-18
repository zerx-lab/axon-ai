//! Plugin API HTTP 处理函数

use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;
use std::collections::HashMap;
use std::path::PathBuf;
use tracing::{debug, info, warn};

use super::{
    types::*,
    PluginApiState,
};
use crate::utils::paths::get_app_data_dir;

/// 健康检查
pub async fn health_check() -> Json<ApiResponse<&'static str>> {
    Json(ApiResponse::success("ok"))
}

/// 获取配置（包含从文件系统和编排组加载的 agents）
pub async fn get_config(
    State(state): State<PluginApiState>,
) -> Json<PluginConfigResponse> {
    let mut agents = state.get_agents();
    
    if let Some(file_agents) = load_agents_from_filesystem() {
        for (name, config) in file_agents {
            agents.entry(name).or_insert(config);
        }
    }
    
    if let Some(orch_agents) = load_agents_from_orchestrations() {
        for (name, config) in orch_agents {
            agents.entry(name).or_insert(config);
        }
    }
    
    let disabled_agents = state.get_disabled_agents();
    let workflows: Vec<OrchestrationWorkflow> = state.get_workflows().into_values().collect();

    Json(PluginConfigResponse {
        port: state.get_port(),
        dev_mode: cfg!(debug_assertions),
        agents,
        disabled_agents,
        workflows,
    })
}

/// 获取所有 Agent 配置
/// 
/// 从三个来源合并 Agent 配置：
/// 1. 内存状态中的 agents（通过 API 动态添加的）
/// 2. 文件系统中的 agents（{app_data}/agents/*.json）
/// 3. 编排组中的主 Agent（{app_data}/orchestrations/*.json 的 primaryAgent）
pub async fn get_agents(
    State(state): State<PluginApiState>,
) -> Json<HashMap<String, AgentConfig>> {
    let mut agents = state.get_agents();
    
    if let Some(file_agents) = load_agents_from_filesystem() {
        for (name, config) in file_agents {
            agents.entry(name).or_insert(config);
        }
    }
    
    if let Some(orch_agents) = load_agents_from_orchestrations() {
        for (name, config) in orch_agents {
            agents.entry(name).or_insert(config);
        }
    }
    
    Json(agents)
}

/// 获取应用数据目录（带 fallback）
/// 
/// 优先从 OnceLock 获取，如果未初始化则使用 dirs crate 计算
fn get_app_data_dir_with_fallback() -> Option<PathBuf> {
    // 首先尝试从 OnceLock 获取（正常路径）
    if let Some(path) = get_app_data_dir() {
        return Some(path);
    }
    
    // Fallback: 使用 dirs crate 手动计算（与 Tauri identifier 一致）
    // Windows: C:\Users\<user>\AppData\Roaming\com.zero.axon-desktop
    // macOS: ~/Library/Application Support/com.zero.axon-desktop  
    // Linux: ~/.local/share/com.zero.axon-desktop
    dirs::data_dir().map(|p| p.join("com.zero.axon-desktop"))
}

/// 获取 agents 目录路径
fn get_agents_dir_path() -> Option<PathBuf> {
    get_app_data_dir_with_fallback().map(|p| p.join("agents"))
}

/// 获取 orchestrations 目录路径
fn get_orchestrations_dir_path() -> Option<PathBuf> {
    get_app_data_dir_with_fallback().map(|p| p.join("orchestrations"))
}

/// 从 orchestrations 目录加载主 Agent 配置
fn load_agents_from_orchestrations() -> Option<HashMap<String, AgentConfig>> {
    let app_data_dir = get_app_data_dir();
    info!("[DEBUG] get_app_data_dir() 返回: {:?}", app_data_dir);
    
    let orchestrations_dir = get_orchestrations_dir_path()?;
    info!("[DEBUG] orchestrations 目录路径: {:?}", orchestrations_dir);
    
    if !orchestrations_dir.exists() {
        info!("[DEBUG] orchestrations 目录不存在: {:?}", orchestrations_dir);
        return None;
    }
    
    info!("[DEBUG] orchestrations 目录存在，开始扫描...");
    
    let mut agents = HashMap::new();
    
    let entries = match std::fs::read_dir(&orchestrations_dir) {
        Ok(e) => e,
        Err(e) => {
            warn!("读取 orchestrations 目录失败: {:?}, 错误: {}", orchestrations_dir, e);
            return None;
        }
    };
    
    for entry in entries.flatten() {
        let path = entry.path();
        info!("[DEBUG] 发现文件: {:?}", path);
        
        if !path.is_file() || path.extension().map(|e| e != "json").unwrap_or(true) {
            info!("[DEBUG] 跳过非 JSON 文件: {:?}", path);
            continue;
        }
        
        match parse_orchestration_primary_agent(&path) {
            Ok((name, config)) => {
                info!("[DEBUG] 成功加载编排组主 Agent: {} -> {}", path.display(), name);
                agents.insert(name, config);
            }
            Err(e) => {
                info!("[DEBUG] 解析编排组文件失败 {:?}: {}", path, e);
            }
        }
    }
    
    info!("[DEBUG] 从编排组加载了 {} 个主 Agent 配置", agents.len());
    
    Some(agents)
}

/// 解析编排组的 primaryAgent 并转换为 AgentConfig
fn parse_orchestration_primary_agent(path: &std::path::Path) -> Result<(String, AgentConfig), String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("读取文件失败: {}", e))?;
    
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析 JSON 失败: {}", e))?;
    
    let primary_agent = json.get("primaryAgent")
        .ok_or("缺少 primaryAgent 字段")?;
    
    let name = primary_agent.get("name")
        .and_then(|v| v.as_str())
        .ok_or("缺少 primaryAgent.name 字段")?
        .to_string();
    
    let description = primary_agent.get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    
    let model = primary_agent.get("model")
        .and_then(|m| m.get("modelId"))
        .and_then(|m| m.as_str())
        .map(|s| s.to_string());
    
    let prompt = primary_agent.get("prompt")
        .and_then(|p| p.get("system"))
        .and_then(|s| s.as_str())
        .map(|s| s.to_string());
    
    let color = primary_agent.get("color")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    
    let temperature = primary_agent.get("parameters")
        .and_then(|p| p.get("temperature"))
        .and_then(|t| t.as_f64())
        .map(|t| t as f32);
    
    let top_p = primary_agent.get("parameters")
        .and_then(|p| p.get("topP"))
        .and_then(|t| t.as_f64())
        .map(|t| t as f32);
    
    let permission = primary_agent.get("permissions")
        .and_then(|p| p.as_object())
        .map(|obj| {
            obj.iter()
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect::<HashMap<String, serde_json::Value>>()
        });
    
    let tools = primary_agent.get("tools")
        .and_then(|t| {
            let mode = t.get("mode").and_then(|m| m.as_str()).unwrap_or("all");
            let list = t.get("list")
                .and_then(|l| l.as_array())
                .map(|arr| arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<_>>()
                )
                .unwrap_or_default();
            
            if mode != "all" && !list.is_empty() {
                let is_whitelist = mode == "whitelist";
                let tools_map: HashMap<String, bool> = list.iter()
                    .map(|tool| (tool.clone(), is_whitelist))
                    .collect();
                Some(tools_map)
            } else {
                None
            }
        });
    
    Ok((name.clone(), AgentConfig {
        name,
        description,
        mode: AgentMode::All,
        model,
        prompt,
        color,
        hidden: None,
        disable: None,
        temperature,
        top_p,
        permission,
        tools,
    }))
}

/// 从文件系统加载 Agent 配置
/// 
/// 读取 {app_data}/agents/ 目录下的所有 JSON 文件，
/// 将 AgentDefinition 格式转换为 AgentConfig 格式
fn load_agents_from_filesystem() -> Option<HashMap<String, AgentConfig>> {
    let agents_dir = get_agents_dir_path()?;
    
    if !agents_dir.exists() {
        debug!("agents 目录不存在: {:?}", agents_dir);
        return None;
    }
    
    let mut agents = HashMap::new();
    
    let entries = match std::fs::read_dir(&agents_dir) {
        Ok(e) => e,
        Err(e) => {
            warn!("读取 agents 目录失败: {:?}, 错误: {}", agents_dir, e);
            return None;
        }
    };
    
    for entry in entries.flatten() {
        let path = entry.path();
        
        // 只处理 .json 文件
        if !path.is_file() || path.extension().map(|e| e != "json").unwrap_or(true) {
            continue;
        }
        
        // 读取并解析 JSON
        match parse_agent_definition(&path) {
            Ok((name, config)) => {
                debug!("加载 agent 文件: {} -> {}", path.display(), name);
                agents.insert(name, config);
            }
            Err(e) => {
                debug!("跳过无法解析的 agent 文件 {:?}: {}", path, e);
            }
        }
    }
    
    if !agents.is_empty() {
        info!("从文件系统加载了 {} 个 agent 配置", agents.len());
    }
    
    Some(agents)
}

/// 解析 AgentDefinition JSON 文件并转换为 AgentConfig
/// 
/// AgentDefinition (编排页面格式) -> AgentConfig (Plugin API 格式)
fn parse_agent_definition(path: &std::path::Path) -> Result<(String, AgentConfig), String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("读取文件失败: {}", e))?;
    
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析 JSON 失败: {}", e))?;
    
    // 提取 name（必需）
    let name = json.get("name")
        .and_then(|v| v.as_str())
        .ok_or("缺少 name 字段")?
        .to_string();
    
    // 提取 description
    let description = json.get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    
    // 提取 runtime.mode 并转换
    let mode = json.get("runtime")
        .and_then(|r| r.get("mode"))
        .and_then(|m| m.as_str())
        .map(|m| match m {
            "primary" => AgentMode::Primary,
            "subagent" => AgentMode::Subagent,
            "all" => AgentMode::All,
            _ => AgentMode::Subagent,
        })
        .unwrap_or(AgentMode::Subagent);
    
    // 提取 model.modelId
    let model = json.get("model")
        .and_then(|m| m.get("modelId"))
        .and_then(|m| m.as_str())
        .map(|s| s.to_string());
    
    // 提取 prompt.system（作为主提示词）
    let prompt = json.get("prompt")
        .and_then(|p| p.get("system"))
        .and_then(|s| s.as_str())
        .map(|s| s.to_string());
    
    // 提取 color
    let color = json.get("color")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    
    // 提取 runtime.hidden
    let hidden = json.get("runtime")
        .and_then(|r| r.get("hidden"))
        .and_then(|h| h.as_bool());
    
    // 提取 runtime.disabled
    let disable = json.get("runtime")
        .and_then(|r| r.get("disabled"))
        .and_then(|d| d.as_bool());
    
    // 提取 parameters.temperature
    let temperature = json.get("parameters")
        .and_then(|p| p.get("temperature"))
        .and_then(|t| t.as_f64())
        .map(|t| t as f32);
    
    // 提取 parameters.topP
    let top_p = json.get("parameters")
        .and_then(|p| p.get("topP"))
        .and_then(|t| t.as_f64())
        .map(|t| t as f32);
    
    // 提取 permissions 并转换格式
    let permission = json.get("permissions")
        .and_then(|p| p.as_object())
        .map(|obj| {
            obj.iter()
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect::<HashMap<String, serde_json::Value>>()
        });
    
    // 提取 tools 配置并转换格式
    // AgentDefinition 格式: { mode: "whitelist"|"blacklist"|"all", list: string[] }
    // AgentConfig 格式: { [toolName]: boolean }
    let tools = json.get("tools")
        .and_then(|t| {
            let mode = t.get("mode").and_then(|m| m.as_str()).unwrap_or("all");
            let list = t.get("list")
                .and_then(|l| l.as_array())
                .map(|arr| arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<_>>()
                )
                .unwrap_or_default();
            
            // 只有在非 "all" 模式且有工具列表时才转换
            if mode != "all" && !list.is_empty() {
                let is_whitelist = mode == "whitelist";
                let tools_map: HashMap<String, bool> = list.iter()
                    .map(|tool| (tool.clone(), is_whitelist))
                    .collect();
                Some(tools_map)
            } else {
                None
            }
        });
    
    Ok((name.clone(), AgentConfig {
        name,
        description,
        mode,
        model,
        prompt,
        color,
        hidden,
        disable,
        temperature,
        top_p,
        permission,
        tools,
    }))
}

/// 设置 Agent 配置
pub async fn set_agent(
    State(state): State<PluginApiState>,
    Json(req): Json<SetAgentRequest>,
) -> Json<ApiResponse<AgentConfig>> {
    let name = req.agent.name.clone();
    state.set_agent(name.clone(), req.agent.clone());
    info!("已设置 Agent: {}", name);
    Json(ApiResponse::success(req.agent))
}

/// 删除 Agent 配置
pub async fn delete_agent(
    State(state): State<PluginApiState>,
    Path(name): Path<String>,
) -> Json<ApiResponse<Option<AgentConfig>>> {
    let removed = state.remove_agent(&name);
    if removed.is_some() {
        info!("已删除 Agent: {}", name);
    }
    Json(ApiResponse::success(removed))
}

/// 接收事件
pub async fn receive_event(
    State(state): State<PluginApiState>,
    Json(event): Json<serde_json::Value>,
) -> Json<ApiResponse<&'static str>> {
    // 解析事件
    let event_type = event
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    
    let properties = event.get("properties").cloned();

    let plugin_event = PluginEvent {
        event_type: event_type.clone(),
        properties,
        received_at: Utc::now(),
    };

    state.record_event(plugin_event);
    info!("收到事件: {}", event_type);

    Json(ApiResponse::success("ok"))
}

/// 获取所有工作流
pub async fn get_workflows(
    State(state): State<PluginApiState>,
) -> Json<Vec<OrchestrationWorkflow>> {
    let workflows: Vec<OrchestrationWorkflow> = state.get_workflows().into_values().collect();
    Json(workflows)
}

/// 添加工作流
pub async fn add_workflow(
    State(state): State<PluginApiState>,
    Json(mut workflow): Json<OrchestrationWorkflow>,
) -> Json<ApiResponse<OrchestrationWorkflow>> {
    // 设置创建/更新时间
    let now = Utc::now();
    workflow.created_at = Some(now);
    workflow.updated_at = Some(now);

    let id = workflow.id.clone();
    state.add_workflow(workflow.clone());
    info!("已添加工作流: {}", id);

    Json(ApiResponse::success(workflow))
}

/// 执行工作流
pub async fn execute_workflow(
    State(state): State<PluginApiState>,
    Path(id): Path<String>,
    Json(req): Json<ExecuteWorkflowRequest>,
) -> Json<ExecuteWorkflowResponse> {
    // 获取工作流
    let workflows = state.get_workflows();
    let workflow = match workflows.get(&id) {
        Some(w) => w,
        None => {
            return Json(ExecuteWorkflowResponse {
                success: false,
                result: None,
                error: Some(format!("工作流不存在: {}", id)),
            });
        }
    };

    info!("执行工作流: {} ({})", workflow.name, id);

    // TODO: 实现实际的工作流执行逻辑
    // 目前只返回一个模拟结果
    let result = serde_json::json!({
        "workflow_id": id,
        "workflow_name": workflow.name,
        "input": req.input,
        "status": "completed",
        "message": "工作流执行完成（模拟）"
    });

    Json(ExecuteWorkflowResponse {
        success: true,
        result: Some(result),
        error: None,
    })
}
