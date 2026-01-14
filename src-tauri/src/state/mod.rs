//! Application state management

use crate::commands::terminal::TerminalManager;
use crate::opencode::OpencodeService;
use crate::settings::SettingsManager;
use std::sync::Arc;

pub struct AppState {
    pub opencode: Arc<OpencodeService>,
    pub settings: Arc<SettingsManager>,
    pub terminal_manager: Option<Arc<TerminalManager>>,
}

impl AppState {
    pub fn new() -> Self {
        let settings = SettingsManager::new();
        let terminal_manager = Some(Arc::new(TerminalManager::new()));
        Self {
            opencode: OpencodeService::with_settings(Arc::clone(&settings)),
            settings,
            terminal_manager,
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
