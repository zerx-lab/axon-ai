//! Application state management

use crate::models_registry::ModelsRegistryManager;
use crate::opencode::OpencodeService;
use crate::plugin_api::{PluginApiServer, DEFAULT_PLUGIN_API_PORT};
use crate::settings::SettingsManager;
use parking_lot::RwLock;
use std::sync::Arc;

pub struct AppState {
    pub opencode: Arc<OpencodeService>,
    pub settings: Arc<SettingsManager>,
    pub plugin_api: Arc<RwLock<PluginApiServer>>,
    /// 模型注册表管理器（用于获取模型默认参数）
    pub models_registry: Arc<ModelsRegistryManager>,
}

impl AppState {
    pub fn new() -> Self {
        let settings = SettingsManager::new();
        let models_registry = ModelsRegistryManager::new();
        Self {
            opencode: OpencodeService::with_settings(Arc::clone(&settings)),
            settings,
            plugin_api: Arc::new(RwLock::new(PluginApiServer::new(DEFAULT_PLUGIN_API_PORT))),
            models_registry,
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
