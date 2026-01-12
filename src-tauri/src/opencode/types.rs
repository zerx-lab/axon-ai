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
            port: 9120,
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
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_update: false,
            custom_opencode_path: None,
            installed_version: None,
        }
    }
}
