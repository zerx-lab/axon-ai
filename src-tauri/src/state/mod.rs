//! Application state management

use crate::opencode::OpencodeService;
use std::sync::Arc;

/// Global application state
pub struct AppState {
    pub opencode: Arc<OpencodeService>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            opencode: OpencodeService::new(),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
