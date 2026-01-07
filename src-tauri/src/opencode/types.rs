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

    // TODO: Will be used when implementing service health checks
    #[allow(dead_code)]
    #[error("Service is not running")]
    ServiceNotRunning,

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
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServiceMode {
    /// Local opencode binary (auto-download if needed)
    Local,
    /// Remote opencode server
    Remote { url: String },
}

impl Default for ServiceMode {
    fn default() -> Self {
        Self::Local
    }
}

/// Current status of the opencode service
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServiceStatus {
    /// Service is not initialized
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

impl Default for ServiceStatus {
    fn default() -> Self {
        Self::Uninitialized
    }
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
