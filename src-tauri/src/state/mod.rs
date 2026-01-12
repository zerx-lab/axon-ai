//! Application state management

use crate::opencode::OpencodeService;
use crate::settings::SettingsManager;
use std::sync::Arc;

pub struct AppState {
    pub opencode: Arc<OpencodeService>,
    pub settings: Arc<SettingsManager>,
}

impl AppState {
    pub fn new() -> Self {
        let settings = SettingsManager::new();
        Self {
            opencode: OpencodeService::with_settings(Arc::clone(&settings)),
            settings,
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
