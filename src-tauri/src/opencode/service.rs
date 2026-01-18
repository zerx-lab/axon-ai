//! OpenCode 服务生命周期管理模块
//!
//! 负责 opencode 二进制的下载、启动、停止、重启等操作。
//! 通过 Tauri 事件系统与前端通信，实时报告服务状态。

use crate::opencode::downloader::OpencodeDownloader;
use crate::opencode::types::{
    DownloadProgress, OpencodeError, ServiceConfig, ServiceMode, ServiceStatus, VersionInfo,
};
use crate::settings::SettingsManager;
use crate::utils::paths::{ensure_dir_exists, get_app_data_dir};
use parking_lot::RwLock;
use std::process::Child;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

/// Event names for frontend communication
pub const EVENT_SERVICE_STATUS: &str = "service:status";
/// Event for download progress updates
pub const EVENT_DOWNLOAD_PROGRESS: &str = "service:download-progress";

pub struct OpencodeService {
    config: RwLock<ServiceConfig>,
    status: RwLock<ServiceStatus>,
    process: RwLock<Option<Child>>,
    downloader: OpencodeDownloader,
    app_handle: RwLock<Option<AppHandle>>,
    settings: Option<Arc<SettingsManager>>,
}

impl OpencodeService {
    pub fn with_settings(settings: Arc<SettingsManager>) -> Arc<Self> {
        Arc::new(Self {
            config: RwLock::new(ServiceConfig::default()),
            status: RwLock::new(ServiceStatus::Uninitialized),
            process: RwLock::new(None),
            downloader: OpencodeDownloader::new(),
            app_handle: RwLock::new(None),
            settings: Some(settings),
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
    /// 如果进程在运行但状态未更新，自动修正状态
    /// 注意：对于动态端口，如果无法确定实际端口，则不进行自动修正
    pub fn get_status(&self) -> ServiceStatus {
        let current_status = self.status.read().clone();
        
        // 如果状态是 Uninitialized 或 Ready 或 Stopped，但进程实际在运行，修正状态
        if matches!(current_status, ServiceStatus::Uninitialized | ServiceStatus::Ready | ServiceStatus::Stopped) {
            if self.is_process_running() {
                // 尝试获取端口，只有在能确定端口时才修正状态
                if let Some(port) = self.detect_running_port() {
                    let corrected_status = ServiceStatus::Running { port };
                    info!("状态修正: {:?} -> {:?}", current_status, corrected_status);
                    *self.status.write() = corrected_status.clone();
                    return corrected_status;
                } else {
                    // 进程在运行但无法确定端口（动态端口场景），不修正状态
                    // 返回一个特殊状态表示进程在运行但端口未知
                    warn!("进程在运行但无法确定端口，保持当前状态: {:?}", current_status);
                }
            }
        }
        
        current_status
    }
    
    /// 检测正在运行的服务端口
    /// 返回 None 表示无法确定端口（例如使用动态端口但没有记录）
    fn detect_running_port(&self) -> Option<u16> {
        // 首先检查当前状态中是否已有端口信息
        if let ServiceStatus::Running { port } = *self.status.read() {
            return Some(port);
        }
        
        // 检查配置中的端口
        let config_port = self.config.read().port;
        if config_port != 0 {
            // 配置了固定端口
            return Some(config_port);
        }
        
        // 动态端口（port=0），无法确定实际端口
        // 返回 None 而不是猜测一个默认值
        None
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

    fn find_available_port() -> Result<u16, OpencodeError> {
        use std::net::TcpListener;
        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|e| OpencodeError::ServiceStartError(format!("无法绑定端口: {}", e)))?;
        let port = listener.local_addr()
            .map_err(|e| OpencodeError::ServiceStartError(format!("无法获取端口: {}", e)))?
            .port();
        drop(listener);
        Ok(port)
    }

    async fn start_local_service(&self, port: u16) -> Result<(), OpencodeError> {
        let actual_port = if port == 0 {
            Self::find_available_port()?
        } else {
            port
        };
        let binary_path = self
            .downloader
            .get_binary_path()
            .ok_or(OpencodeError::BinaryNotFound)?;

        self.update_status(ServiceStatus::Starting);
        info!("启动 opencode serve，端口: {}", actual_port);

        // 获取应用数据目录
        let app_data_dir = get_app_data_dir().ok_or(OpencodeError::ConfigError(
            "未初始化应用数据目录".to_string(),
        ))?;

        // 缓存目录
        let cache_dir = app_data_dir.join("cache");
        if let Err(e) = ensure_dir_exists(&cache_dir) {
            warn!("创建缓存目录失败: {}", e);
        }

        // opencode 会在 $XDG_CONFIG_HOME/opencode/ 下创建配置
        // 设置 XDG_CONFIG_HOME 为 app_data_dir，opencode 自动创建 /opencode 子目录
        let opencode_config_dir = app_data_dir.join("opencode");
        if let Err(e) = ensure_dir_exists(&opencode_config_dir) {
            warn!("创建 opencode 配置目录失败: {}", e);
        }

        let config_file = opencode_config_dir.join("opencode.json");
        if config_file.exists() {
            self.update_config_port(&config_file, actual_port);
        } else {
            let config_json = self.build_opencode_config(actual_port);
            if let Err(e) = std::fs::write(&config_file, &config_json) {
                warn!("写入 opencode 配置文件失败: {}", e);
            } else {
                info!("已创建 opencode 配置文件: {:?}", config_file);
            }
        }

        info!("opencode 配置目录: {:?}", opencode_config_dir);

        // 确定工作目录：优先使用用户配置的项目目录，否则使用配置目录
        let working_directory = if let Some(settings) = &self.settings {
            settings.get_project_directory()
                .and_then(|p| {
                    let path = std::path::Path::new(&p);
                    if path.exists() && path.is_dir() {
                        info!("使用用户配置的项目目录作为工作目录: {:?}", path);
                        Some(path.to_path_buf())
                    } else {
                        warn!("配置的项目目录不存在或不是目录: {:?}，使用默认配置目录", p);
                        None
                    }
                })
                .unwrap_or_else(|| opencode_config_dir.clone())
        } else {
            opencode_config_dir.clone()
        };

        info!("OpenCode 工作目录: {:?}", working_directory);

        let mut cmd = std::process::Command::new(&binary_path);
        cmd.args(["serve", "--port", &actual_port.to_string()])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            // 设置工作目录
            // - 如果用户配置了项目目录，使用项目目录（能够扫描到项目的 .opencode）
            // - 否则使用 opencode 配置目录（保持原有行为）
            .current_dir(&working_directory)
            // 设置 XDG 环境变量实现配置隔离
            // xdg-basedir 会自动在这些目录下创建 /opencode 子目录
            .env("XDG_CONFIG_HOME", &app_data_dir)
            .env("XDG_DATA_HOME", &app_data_dir)
            .env("XDG_STATE_HOME", &app_data_dir)
            .env("XDG_CACHE_HOME", &cache_dir)
            // 禁用自动更新（由 Axon 管理）
            .env("OPENCODE_DISABLE_AUTOUPDATE", "true")
            // 标识这是由 Axon 启动的 opencode 实例，用于 axon-bridge 插件判断
            .env("AXON_RUNNING", "true")
            .env("AXON_BRIDGE_PORT", &actual_port.to_string());

        // Windows 平台：设置 CREATE_NO_WINDOW 标志，避免弹出 CMD 控制台窗口
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            // CREATE_NO_WINDOW = 0x08000000
            // 参考：https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let child = cmd
            .spawn()
            .map_err(|e| OpencodeError::ServiceStartError(e.to_string()))?;

        *self.process.write() = Some(child);

        // 等待服务启动
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        // 验证服务是否正在运行
        if self.is_process_running() {
            self.update_status(ServiceStatus::Running { port: actual_port });
            info!("OpenCode 服务启动成功，端口: {}", actual_port);
            Ok(())
        } else {
            self.update_status(ServiceStatus::Error {
                message: "服务启动失败".to_string(),
            });
            Err(OpencodeError::ServiceStartError(
                "进程立即退出".to_string(),
            ))
        }
    }

    fn update_config_port(&self, config_file: &std::path::Path, port: u16) {
        let content = match std::fs::read_to_string(config_file) {
            Ok(c) => c,
            Err(e) => {
                warn!("读取配置文件失败: {}", e);
                return;
            }
        };

        let mut config: serde_json::Value = match serde_json::from_str(&content) {
            Ok(c) => c,
            Err(e) => {
                warn!("解析配置文件失败: {}", e);
                return;
            }
        };

        // 更新服务器端口
        if let Some(server) = config.get_mut("server") {
            if let Some(obj) = server.as_object_mut() {
                obj.insert("port".to_string(), serde_json::json!(port));
            }
        } else {
            config["server"] = serde_json::json!({
                "port": port,
                "hostname": "127.0.0.1"
            });
        }
        
        // 检查是否需要添加插件配置（如果存在符号链接但配置中没有）
        let has_plugin_config = config.get("plugin").is_some();
        if !has_plugin_config {
            let plugin_path = get_app_data_dir()
                .map(|p| p.join("opencode").join("plugins").join("opencode").join("dist").join("index.js"));
            
            let plugin_exists = plugin_path.as_ref().map(|p| p.exists()).unwrap_or(false);
            
            if plugin_exists {
                if let Some(path) = plugin_path {
                    let plugin_url = format!("file://{}", path.to_string_lossy().replace('\\', "/"));
                    info!("检测到 axon-bridge 插件，添加到配置: {}", plugin_url);
                    config["plugin"] = serde_json::json!([plugin_url]);
                }
            }
        }

        match serde_json::to_string_pretty(&config) {
            Ok(json) => {
                if let Err(e) = std::fs::write(config_file, json) {
                    warn!("写入配置文件失败: {}", e);
                } else {
                    debug!("已更新配置文件端口: {}", port);
                }
            }
            Err(e) => warn!("序列化配置失败: {}", e),
        }
    }

    /// 构建 Axon 专用的 opencode 配置文件内容
    ///
    /// 由于我们通过 XDG_CONFIG_HOME 实现了完全隔离，
    /// opencode 会在全新的配置目录中启动，不会加载任何全局配置。
    /// 这里只需要配置 Axon 需要的基本设置即可。
    /// 注意：不设置 permission 字段，让 opencode 使用默认的交互式权限确认流程
    fn build_opencode_config(&self, port: u16) -> String {
        let plugin_path = get_app_data_dir()
            .map(|p| p.join("opencode").join("plugins").join("opencode").join("dist").join("index.js"));
        
        let has_plugin = plugin_path
            .as_ref()
            .map(|p| p.exists())
            .unwrap_or(false);
        
        let mut config = serde_json::json!({
            "$schema": "https://opencode.ai/config.json",
            "server": {
                "port": port,
                "hostname": "127.0.0.1"
            },
            "autoupdate": false,
            "share": "disabled"
        });
        
        if has_plugin {
            if let Some(path) = plugin_path {
                let plugin_url = format!("file://{}", path.to_string_lossy().replace('\\', "/"));
                info!("检测到 axon-bridge 插件，已添加到配置: {}", plugin_url);
                config["plugin"] = serde_json::json!([plugin_url]);
            }
        } else {
            debug!("未检测到 axon-bridge 插件，跳过插件配置");
        }

        serde_json::to_string_pretty(&config).unwrap_or_else(|_| "{}".to_string())
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
        // 获取进程 PID 后立即释放锁，避免在异步等待时持有锁
        let pid_to_kill = {
            let process = self.process.read();
            process.as_ref().map(|child| child.id())
        };

        if let Some(pid) = pid_to_kill {
            info!("Stopping opencode service (PID: {})...", pid);

            #[cfg(target_os = "windows")]
            {
                info!("Killing opencode process tree (PID: {})...", pid);
                // 使用 tokio::process::Command 进行异步执行
                let output = tokio::process::Command::new("taskkill")
                    .args(["/F", "/T", "/PID", &pid.to_string()])
                    .output()
                    .await;
                match output {
                    Ok(o) => {
                        if o.status.success() {
                            info!("taskkill 成功终止进程");
                        } else {
                            warn!("taskkill 失败: {}", String::from_utf8_lossy(&o.stderr));
                        }
                    }
                    Err(e) => warn!("taskkill 执行失败: {}", e),
                }

                // 使用异步等待，最多等待 5 秒（50 次 × 100ms）
                for attempt in 1..=50 {
                    let still_running = {
                        let mut process = self.process.write();
                        if let Some(ref mut child) = *process {
                            match child.try_wait() {
                                Ok(Some(status)) => {
                                    info!("进程已退出，状态码: {:?}", status);
                                    false
                                }
                                Ok(None) => true, // 仍在运行
                                Err(e) => {
                                    debug!("try_wait error: {}", e);
                                    false
                                }
                            }
                        } else {
                            false
                        }
                    };

                    if !still_running {
                        info!("进程已在第 {} 次尝试后确认退出", attempt);
                        break;
                    }

                    if attempt % 10 == 0 {
                        debug!("等待进程退出... (尝试 {}/50)", attempt);
                    }
                    // 使用异步 sleep，不阻塞运行时
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                }
                
                // 最后再次确认进程状态
                {
                    let mut process = self.process.write();
                    if let Some(ref mut child) = *process {
                        if let Ok(None) = child.try_wait() {
                            warn!("进程在 5 秒后仍在运行，强制标记为已停止");
                        }
                    }
                }
            }

            #[cfg(not(target_os = "windows"))]
            {
                let mut process = self.process.write();
                if let Some(ref mut child) = *process {
                    if let Err(e) = child.kill() {
                        warn!("Kill returned error (may already be dead): {}", e);
                    }
                    match child.wait() {
                        Ok(status) => info!("Process exited with status: {:?}", status),
                        Err(e) => warn!("Wait returned error: {}", e),
                    }
                }
            }
        }

        // 清理进程引用
        *self.process.write() = None;

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

    fn get_custom_path(&self) -> Option<String> {
        self.settings.as_ref().and_then(|s| s.get_custom_opencode_path())
    }

    pub async fn get_version_info(&self) -> Result<VersionInfo, OpencodeError> {
        let custom_path = self.get_custom_path();
        let installed = self.downloader.get_installed_version(custom_path.as_deref())
            .or_else(|| {
                self.settings.as_ref().and_then(|s| s.get_installed_version())
            });

        let latest = match self.downloader.fetch_latest_version().await {
            Ok(v) => Some(v),
            Err(e) => {
                warn!("Failed to fetch latest version: {}", e);
                None
            }
        };

        // 使用语义化版本比较，只有当 latest > installed 时才提示更新
        let update_available = match (&installed, &latest) {
            (Some(inst), Some(lat)) => {
                let inst_clean = inst.trim_start_matches('v');
                let lat_clean = lat.trim_start_matches('v');
                
                // 尝试解析为 semver，如果失败则回退到字符串比较
                match (semver::Version::parse(inst_clean), semver::Version::parse(lat_clean)) {
                    (Ok(inst_ver), Ok(lat_ver)) => lat_ver > inst_ver,
                    _ => {
                        // 如果无法解析为 semver，回退到字符串不等比较
                        // 但这种情况下可能会误判，记录警告
                        warn!("Cannot parse versions as semver, falling back to string comparison: installed={}, latest={}", inst, lat);
                        inst_clean != lat_clean
                    }
                }
            }
            _ => false,
        };

        Ok(VersionInfo {
            installed,
            latest,
            update_available,
        })
    }

    pub async fn check_for_update(&self) -> Result<VersionInfo, OpencodeError> {
        self.get_version_info().await
    }

    pub async fn update_opencode(self: &Arc<Self>) -> Result<(), OpencodeError> {
        info!("开始更新流程...");

        let was_running = matches!(self.get_status(), ServiceStatus::Running { .. });

        // 停止服务
        self.stop().await?;

        // 给操作系统一点时间清理进程资源
        // 注意：主要的文件替换逻辑（重命名旧文件）在 downloader 的 extract_zip_sync 中处理
        #[cfg(target_os = "windows")]
        {
            info!("等待 Windows 释放进程资源...");
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        }

        #[cfg(not(target_os = "windows"))]
        {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        }

        let (progress_tx, mut progress_rx) = mpsc::channel::<DownloadProgress>(32);
        let self_clone = Arc::clone(self);

        tokio::spawn(async move {
            while let Some(progress) = progress_rx.recv().await {
                self_clone.emit_download_progress(&progress);
                self_clone.update_status(ServiceStatus::Downloading {
                    progress: progress.percentage,
                });
            }
        });

        self.downloader.download(None, Some(progress_tx)).await?;

        if let Some(settings) = &self.settings {
            if let Ok(info) = self.get_version_info().await {
                if let Some(version) = info.installed {
                    let _ = settings.set_installed_version(Some(version));
                }
            }
        }

        self.update_status(ServiceStatus::Ready);
        info!("OpenCode update completed successfully");

        if was_running {
            info!("Restarting service after update...");
            if let Err(e) = self.start().await {
                warn!("Failed to restart service after update: {}", e);
            }
        }

        Ok(())
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
            settings: None,
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
