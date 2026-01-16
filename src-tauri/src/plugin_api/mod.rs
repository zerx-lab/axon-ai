//! Axon Plugin API Server
//!
//! 提供 HTTP API 供 OpenCode 插件与 Axon 后端通信。
//! 支持以下功能：
//! - Agent 动态配置管理
//! - 事件接收和处理
//! - 编排工作流执行

mod handlers;
mod types;

pub use handlers::*;
pub use types::*;

use axum::{
    routing::{get, post},
    Router,
};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::oneshot;
use tracing::{error, info};

/// 插件 API 服务器默认端口
pub const DEFAULT_PLUGIN_API_PORT: u16 = 23517;

/// 插件 API 状态
#[derive(Debug, Clone)]
pub struct PluginApiState {
    /// 自定义 Agent 配置
    pub agents: Arc<RwLock<HashMap<String, AgentConfig>>>,
    /// 禁用的默认 Agent 列表
    pub disabled_agents: Arc<RwLock<Vec<String>>>,
    /// 编排工作流
    pub workflows: Arc<RwLock<HashMap<String, OrchestrationWorkflow>>>,
    /// 接收到的事件（用于调试）
    pub events: Arc<RwLock<Vec<PluginEvent>>>,
    /// 服务端口
    pub port: u16,
}

impl Default for PluginApiState {
    fn default() -> Self {
        Self {
            agents: Arc::new(RwLock::new(HashMap::new())),
            disabled_agents: Arc::new(RwLock::new(Vec::new())),
            workflows: Arc::new(RwLock::new(HashMap::new())),
            events: Arc::new(RwLock::new(Vec::new())),
            port: DEFAULT_PLUGIN_API_PORT,
        }
    }
}

impl PluginApiState {
    /// 创建新的状态实例
    pub fn new(port: u16) -> Self {
        Self {
            port,
            ..Default::default()
        }
    }

    /// 添加或更新 Agent 配置
    pub fn set_agent(&self, name: String, config: AgentConfig) {
        self.agents.write().insert(name, config);
    }

    /// 移除 Agent 配置
    pub fn remove_agent(&self, name: &str) -> Option<AgentConfig> {
        self.agents.write().remove(name)
    }

    /// 获取所有 Agent 配置
    pub fn get_agents(&self) -> HashMap<String, AgentConfig> {
        self.agents.read().clone()
    }

    /// 禁用默认 Agent
    pub fn disable_agent(&self, name: String) {
        let mut disabled = self.disabled_agents.write();
        if !disabled.contains(&name) {
            disabled.push(name);
        }
    }

    /// 启用默认 Agent
    pub fn enable_agent(&self, name: &str) {
        self.disabled_agents.write().retain(|n| n != name);
    }

    /// 获取禁用的 Agent 列表
    pub fn get_disabled_agents(&self) -> Vec<String> {
        self.disabled_agents.read().clone()
    }

    /// 添加编排工作流
    pub fn add_workflow(&self, workflow: OrchestrationWorkflow) {
        self.workflows.write().insert(workflow.id.clone(), workflow);
    }

    /// 移除编排工作流
    pub fn remove_workflow(&self, id: &str) -> Option<OrchestrationWorkflow> {
        self.workflows.write().remove(id)
    }

    /// 获取所有工作流
    pub fn get_workflows(&self) -> HashMap<String, OrchestrationWorkflow> {
        self.workflows.read().clone()
    }

    /// 记录事件
    pub fn record_event(&self, event: PluginEvent) {
        let mut events = self.events.write();
        // 只保留最近 100 个事件
        if events.len() >= 100 {
            events.remove(0);
        }
        events.push(event);
    }
}

/// 插件 API 服务器
pub struct PluginApiServer {
    state: PluginApiState,
    shutdown_tx: Option<oneshot::Sender<()>>,
}

impl PluginApiServer {
    /// 创建新的服务器实例
    pub fn new(port: u16) -> Self {
        Self {
            state: PluginApiState::new(port),
            shutdown_tx: None,
        }
    }

    /// 获取状态引用
    pub fn state(&self) -> &PluginApiState {
        &self.state
    }

    /// 启动服务器
    pub async fn start(&mut self) -> Result<(), String> {
        if self.shutdown_tx.is_some() {
            return Err("服务器已在运行".to_string());
        }

        let state = self.state.clone();
        let port = state.port;
        let (shutdown_tx, shutdown_rx) = oneshot::channel();

        // 构建路由
        let app = Router::new()
            // 健康检查
            .route("/api/plugin/health", get(handlers::health_check))
            // 配置端点
            .route("/api/plugin/config", get(handlers::get_config))
            // Agent 管理
            .route("/api/plugin/agents", get(handlers::get_agents))
            .route("/api/plugin/agents", post(handlers::set_agent))
            .route("/api/plugin/agents/:name", axum::routing::delete(handlers::delete_agent))
            // 事件接收
            .route("/api/plugin/events", post(handlers::receive_event))
            // 编排端点
            .route("/api/plugin/orchestration", get(handlers::get_workflows))
            .route("/api/plugin/orchestration", post(handlers::add_workflow))
            .route(
                "/api/plugin/orchestration/:id/execute",
                post(handlers::execute_workflow),
            )
            .with_state(state);

        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        
        // 尝试绑定端口
        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                error!("无法绑定端口 {}: {}", port, e);
                return Err(format!("无法绑定端口 {}: {}", port, e));
            }
        };

        info!("Plugin API 服务器启动于 http://{}", addr);

        // 在后台运行服务器
        tokio::spawn(async move {
            axum::serve(listener, app)
                .with_graceful_shutdown(async {
                    let _ = shutdown_rx.await;
                    info!("Plugin API 服务器正在关闭...");
                })
                .await
                .ok();
        });

        self.shutdown_tx = Some(shutdown_tx);
        Ok(())
    }

    /// 停止服务器
    pub fn stop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
            info!("Plugin API 服务器已停止");
        }
    }

    /// 检查服务器是否在运行
    pub fn is_running(&self) -> bool {
        self.shutdown_tx.is_some()
    }
}

impl Drop for PluginApiServer {
    fn drop(&mut self) {
        self.stop();
    }
}
