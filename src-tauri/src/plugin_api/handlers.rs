//! Plugin API HTTP 处理函数

use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;
use std::collections::HashMap;
use tracing::info;

use super::{
    types::*,
    PluginApiState,
};

/// 健康检查
pub async fn health_check() -> Json<ApiResponse<&'static str>> {
    Json(ApiResponse::success("ok"))
}

/// 获取配置
pub async fn get_config(
    State(state): State<PluginApiState>,
) -> Json<PluginConfigResponse> {
    let agents = state.get_agents();
    let disabled_agents = state.get_disabled_agents();
    let workflows: Vec<OrchestrationWorkflow> = state.get_workflows().into_values().collect();

    Json(PluginConfigResponse {
        port: state.port,
        dev_mode: cfg!(debug_assertions),
        agents,
        disabled_agents,
        workflows,
    })
}

/// 获取所有 Agent 配置
pub async fn get_agents(
    State(state): State<PluginApiState>,
) -> Json<HashMap<String, AgentConfig>> {
    Json(state.get_agents())
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
