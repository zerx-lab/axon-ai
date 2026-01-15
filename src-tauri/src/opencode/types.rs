//! Types and error definitions for opencode module

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Errors that can occur in opencode operations
#[derive(Error, Debug)]
pub enum OpencodeError {
    #[error("Failed to download opencode: {0}")]
    DownloadError(String),

    #[error("Failed to extract archive: {0}")]
    ExtractError(String),

    #[error("Binary not found at expected path")]
    BinaryNotFound,

    #[error("Failed to start service: {0}")]
    ServiceStartError(String),

    #[error("Failed to connect to service: {0}")]
    ConnectionError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Request error: {0}")]
    RequestError(#[from] reqwest::Error),

    #[error("Invalid configuration: {0}")]
    ConfigError(String),
}

/// Service connection mode
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServiceMode {
    /// Local opencode binary (auto-download if needed)
    #[default]
    Local,
    /// Remote opencode server
    Remote { url: String },
}

/// Current status of the opencode service
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServiceStatus {
    /// Service is not initialized
    #[default]
    Uninitialized,
    /// Downloading binary
    Downloading { progress: f32 },
    /// Binary downloaded, service not started
    Ready,
    /// Service is starting
    Starting,
    /// Service is running
    Running { port: u16 },
    /// Service stopped
    Stopped,
    /// Error state
    Error { message: String },
}

/// Download progress information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: Option<u64>,
    pub percentage: f32,
}

/// Service configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceConfig {
    pub mode: ServiceMode,
    pub port: u16,
    pub auto_start: bool,
}

impl Default for ServiceConfig {
    fn default() -> Self {
        Self {
            mode: ServiceMode::Local,
            // 端口为 0 表示启动时自动分配可用随机端口
            port: 0,
            auto_start: true,
        }
    }
}

/// 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionInfo {
    /// 已安装版本（如果已安装）
    pub installed: Option<String>,
    /// 最新可用版本
    pub latest: Option<String>,
    /// 是否有更新可用
    pub update_available: bool,
}

impl Default for VersionInfo {
    fn default() -> Self {
        Self {
            installed: None,
            latest: None,
            update_available: false,
        }
    }
}

/// 应用全局设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// 是否自动更新 opencode
    pub auto_update: bool,
    /// 自定义 opencode 路径（如果为空则使用默认路径）
    pub custom_opencode_path: Option<String>,
    /// 已安装的 opencode 版本（用于版本记录）
    pub installed_version: Option<String>,
    /// 项目工作目录（OpenCode 服务的工作目录，用于扫描 .opencode 等配置）
    #[serde(default)]
    pub project_directory: Option<String>,
    /// 用户添加的服务商配置
    #[serde(default)]
    pub providers: Vec<UserProviderConfig>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_update: false,
            custom_opencode_path: None,
            installed_version: None,
            project_directory: None,
            providers: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProviderConfig {
    pub id: String,
    pub registry_id: String,
    pub name: String,
    pub auth: ProviderAuth,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_config: Option<CustomConfig>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ProviderAuth {
    Api { key: String },
    OAuth { connected: bool, method: u32 },
    Subscription { provider: String, connected: bool },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enterprise_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub set_cache_key: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<std::collections::HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<std::collections::HashMap<String, String>>,
    #[serde(flatten)]
    pub extra: Option<serde_json::Map<String, serde_json::Value>>,
}
