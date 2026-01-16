//! Plugin API 类型定义

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Agent 运行模式
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AgentMode {
    Primary,
    Subagent,
    All,
}

/// Agent 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    /// Agent 名称
    pub name: String,
    /// Agent 描述
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// 运行模式
    pub mode: AgentMode,
    /// 使用的模型
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// 系统提示词
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt: Option<String>,
    /// 显示颜色
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// 是否隐藏
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hidden: Option<bool>,
    /// 是否禁用
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disable: Option<bool>,
    /// 温度参数
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    /// Top P 参数
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    /// 权限配置
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permission: Option<HashMap<String, serde_json::Value>>,
    /// 工具配置
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<HashMap<String, bool>>,
}

/// 编排节点类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum OrchestrationNodeType {
    Agent,
    Tool,
    Condition,
    Parallel,
    Sequence,
}

/// 编排节点
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationNode {
    /// 节点 ID
    pub id: String,
    /// 节点类型
    #[serde(rename = "type")]
    pub node_type: OrchestrationNodeType,
    /// 关联的 Agent ID（当类型为 Agent 时）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    /// 关联的工具 ID（当类型为 Tool 时）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_id: Option<String>,
    /// 节点配置
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<HashMap<String, serde_json::Value>>,
    /// 后续节点 ID 列表
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next: Option<Vec<String>>,
    /// 节点位置（用于 UI 显示）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position: Option<NodePosition>,
}

/// 节点位置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodePosition {
    pub x: f64,
    pub y: f64,
}

/// 编排工作流
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationWorkflow {
    /// 工作流 ID
    pub id: String,
    /// 工作流名称
    pub name: String,
    /// 工作流描述
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// 节点列表
    pub nodes: Vec<OrchestrationNode>,
    /// 入口节点 ID
    pub entry_node_id: String,
    /// 创建时间
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    /// 更新时间
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// 插件事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginEvent {
    /// 事件类型
    #[serde(rename = "type")]
    pub event_type: String,
    /// 事件属性
    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<serde_json::Value>,
    /// 接收时间
    pub received_at: chrono::DateTime<chrono::Utc>,
}

/// Plugin API 配置响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginConfigResponse {
    /// 服务端口
    pub port: u16,
    /// 是否开发模式
    pub dev_mode: bool,
    /// 自定义 Agent 配置
    pub agents: HashMap<String, AgentConfig>,
    /// 禁用的默认 Agent 列表
    pub disabled_agents: Vec<String>,
    /// 工作流列表
    pub workflows: Vec<OrchestrationWorkflow>,
}

/// 工作流执行请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteWorkflowRequest {
    /// 输入参数
    #[serde(default)]
    pub input: HashMap<String, serde_json::Value>,
}

/// 工作流执行响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteWorkflowResponse {
    /// 是否成功
    pub success: bool,
    /// 执行结果
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    /// 错误信息
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// 设置 Agent 请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetAgentRequest {
    /// Agent 配置
    pub agent: AgentConfig,
}

/// API 通用响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    /// 是否成功
    pub success: bool,
    /// 数据
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    /// 错误信息
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    /// 创建成功响应
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    /// 创建错误响应
    pub fn error(msg: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(msg.into()),
        }
    }
}
