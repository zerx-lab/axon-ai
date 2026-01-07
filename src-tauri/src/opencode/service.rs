//! OpenCode service management

use crate::opencode::downloader::OpencodeDownloader;
use crate::opencode::types::{DownloadProgress, OpencodeError, ServiceConfig, ServiceMode, ServiceStatus};
use parking_lot::RwLock;
use std::process::Child;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

/// Event names for frontend communication
pub const EVENT_SERVICE_STATUS: &str = "service:status";
/// Event for download progress updates
pub const EVENT_DOWNLOAD_PROGRESS: &str = "service:download-progress";

/// Manages the opencode service lifecycle
pub struct OpencodeService {
    config: RwLock<ServiceConfig>,
    status: RwLock<ServiceStatus>,
    process: RwLock<Option<Child>>,
    downloader: OpencodeDownloader,
    app_handle: RwLock<Option<AppHandle>>,
}

impl OpencodeService {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            config: RwLock::new(ServiceConfig::default()),
            status: RwLock::new(ServiceStatus::Uninitialized),
            process: RwLock::new(None),
            downloader: OpencodeDownloader::new(),
            app_handle: RwLock::new(None),
        })
    }

    /// Set the app handle for event emission
    pub fn set_app_handle(&self, handle: AppHandle) {
        *self.app_handle.write() = Some(handle);
        // 设置 handle 后立即发送当前状态
        let status = self.status.read().clone();
        self.emit_event(EVENT_SERVICE_STATUS, &status);
        info!("App handle set, emitted initial status: {:?}", status);
    }

    /// Emit event to frontend
    fn emit_event<S: serde::Serialize + Clone>(&self, event: &str, payload: S) {
        if let Some(handle) = self.app_handle.read().as_ref() {
            if let Err(e) = handle.emit(event, payload) {
                warn!("Failed to emit event {}: {}", event, e);
            }
        } else {
            debug!("No app handle set, skipping event emission for: {}", event);
        }
    }

    /// Get current service status
    pub fn get_status(&self) -> ServiceStatus {
        self.status.read().clone()
    }

    /// Get current configuration
    pub fn get_config(&self) -> ServiceConfig {
        self.config.read().clone()
    }

    /// Update configuration
    pub fn set_config(&self, config: ServiceConfig) {
        *self.config.write() = config;
    }

    /// Set service mode
    pub fn set_mode(&self, mode: ServiceMode) {
        self.config.write().mode = mode;
    }

    /// Update and broadcast status
    fn update_status(&self, status: ServiceStatus) {
        info!("Updating service status: {:?}", status);
        *self.status.write() = status.clone();
        // Emit to frontend via Tauri events
        self.emit_event(EVENT_SERVICE_STATUS, &status);
    }

    /// Emit download progress to frontend
    fn emit_download_progress(&self, progress: &DownloadProgress) {
        self.emit_event(EVENT_DOWNLOAD_PROGRESS, progress);
    }

    /// Initialize the service (download binary if needed)
    pub async fn initialize(self: &Arc<Self>) -> Result<(), OpencodeError> {
        let config = self.get_config();

        match config.mode {
            ServiceMode::Local => {
                if !self.downloader.is_installed() {
                    info!("OpenCode binary not found, starting download...");
                    self.update_status(ServiceStatus::Downloading { progress: 0.0 });

                    let (progress_tx, mut progress_rx) = mpsc::channel::<DownloadProgress>(32);
                    let self_clone = Arc::clone(self);

                    // Spawn progress reporter - emit both status and detailed progress
                    tokio::spawn(async move {
                        while let Some(progress) = progress_rx.recv().await {
                            // Emit detailed progress event
                            self_clone.emit_download_progress(&progress);
                            // Also update status with percentage
                            self_clone.update_status(ServiceStatus::Downloading {
                                progress: progress.percentage,
                            });
                        }
                    });

                    self.downloader.download(None, Some(progress_tx)).await?;
                }

                self.update_status(ServiceStatus::Ready);
                info!("OpenCode service initialized (local mode)");
            }
            ServiceMode::Remote { ref url } => {
                // Verify remote connection
                debug!("Verifying remote opencode server at: {}", url);
                self.update_status(ServiceStatus::Ready);
                info!("OpenCode service initialized (remote mode: {})", url);
            }
        }

        Ok(())
    }

    /// Start the opencode serve process
    pub async fn start(self: &Arc<Self>) -> Result<(), OpencodeError> {
        let config = self.get_config();

        match config.mode {
            ServiceMode::Local => {
                self.start_local_service(config.port).await?;
            }
            ServiceMode::Remote { url } => {
                // For remote mode, just verify connectivity
                self.verify_remote_connection(&url).await?;
                self.update_status(ServiceStatus::Running { port: config.port });
            }
        }

        Ok(())
    }

    /// Start local opencode serve process
    async fn start_local_service(&self, port: u16) -> Result<(), OpencodeError> {
        let binary_path = self
            .downloader
            .get_binary_path()
            .ok_or(OpencodeError::BinaryNotFound)?;

        self.update_status(ServiceStatus::Starting);
        info!("Starting opencode serve on port {}", port);

        let child = std::process::Command::new(&binary_path)
            .args(["serve", "--port", &port.to_string()])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| OpencodeError::ServiceStartError(e.to_string()))?;

        *self.process.write() = Some(child);

        // Wait a bit for the service to start
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        // Verify service is running
        if self.is_process_running() {
            self.update_status(ServiceStatus::Running { port });
            info!("OpenCode service started successfully on port {}", port);
            Ok(())
        } else {
            self.update_status(ServiceStatus::Error {
                message: "Service failed to start".to_string(),
            });
            Err(OpencodeError::ServiceStartError(
                "Process exited immediately".to_string(),
            ))
        }
    }

    /// Verify remote server connection
    async fn verify_remote_connection(&self, url: &str) -> Result<(), OpencodeError> {
        let client = reqwest::Client::new();
        let health_url = format!("{}/health", url.trim_end_matches('/'));

        match client.get(&health_url).send().await {
            Ok(response) if response.status().is_success() => {
                info!("Remote opencode server is healthy");
                Ok(())
            }
            Ok(response) => Err(OpencodeError::ConnectionError(format!(
                "Server returned status: {}",
                response.status()
            ))),
            Err(e) => Err(OpencodeError::ConnectionError(e.to_string())),
        }
    }

    /// Check if the local process is still running
    fn is_process_running(&self) -> bool {
        let mut process = self.process.write();
        if let Some(ref mut child) = *process {
            match child.try_wait() {
                Ok(None) => true,  // Still running
                Ok(Some(_)) => false, // Exited
                Err(_) => false,
            }
        } else {
            false
        }
    }

    /// Stop the service
    pub async fn stop(&self) -> Result<(), OpencodeError> {
        let mut process = self.process.write();
        if let Some(ref mut child) = *process {
            info!("Stopping opencode service...");
            if let Err(e) = child.kill() {
                error!("Failed to kill process: {}", e);
            }
            let _ = child.wait();
        }
        *process = None;
        self.update_status(ServiceStatus::Stopped);
        info!("OpenCode service stopped");
        Ok(())
    }

    /// Restart the service
    pub async fn restart(self: &Arc<Self>) -> Result<(), OpencodeError> {
        self.stop().await?;
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        self.start().await
    }

    /// Get the service endpoint URL
    pub fn get_endpoint(&self) -> Option<String> {
        let config = self.config.read();
        let status = self.status.read();

        match (&config.mode, &*status) {
            (ServiceMode::Remote { url }, ServiceStatus::Running { .. }) => Some(url.clone()),
            (ServiceMode::Local, ServiceStatus::Running { port }) => {
                Some(format!("http://127.0.0.1:{}", port))
            }
            _ => None,
        }
    }
}

impl Default for OpencodeService {
    fn default() -> Self {
        Self {
            config: RwLock::new(ServiceConfig::default()),
            status: RwLock::new(ServiceStatus::Uninitialized),
            process: RwLock::new(None),
            downloader: OpencodeDownloader::new(),
            app_handle: RwLock::new(None),
        }
    }
}

impl Drop for OpencodeService {
    fn drop(&mut self) {
        // Ensure process is killed on drop
        if let Some(ref mut child) = *self.process.write() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
