//! Application state management

use crate::opencode::OpencodeService;
use crate::plugin_api::{PluginApiServer, DEFAULT_PLUGIN_API_PORT};
use crate::settings::SettingsManager;
use parking_lot::RwLock;
use std::sync::Arc;

pub struct AppState {
    pub opencode: Arc<OpencodeService>,
    pub settings: Arc<SettingsManager>,
    pub plugin_api: Arc<RwLock<PluginApiServer>>,
}

impl AppState {
    pub fn new() -> Self {
        let settings = SettingsManager::new();
        Self {
            opencode: OpencodeService::with_settings(Arc::clone(&settings)),
            settings,
            plugin_api: Arc::new(RwLock::new(PluginApiServer::new(DEFAULT_PLUGIN_API_PORT))),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
