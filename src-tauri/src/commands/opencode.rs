//! OpenCode service commands

use crate::opencode::{ServiceConfig, ServiceMode, ServiceStatus};
use crate::state::AppState;
use tauri::State;

/// Get current service status
#[tauri::command]
pub fn get_service_status(state: State<'_, AppState>) -> ServiceStatus {
    state.opencode.get_status()
}

/// Get current service configuration
#[tauri::command]
pub fn get_service_config(state: State<'_, AppState>) -> ServiceConfig {
    state.opencode.get_config()
}

/// Set service mode (local or remote)
#[tauri::command]
pub fn set_service_mode(state: State<'_, AppState>, mode: ServiceMode) {
    state.opencode.set_mode(mode);
}

/// Set full service configuration
#[tauri::command]
pub fn set_service_config(state: State<'_, AppState>, config: ServiceConfig) {
    state.opencode.set_config(config);
}

/// Initialize the opencode service
#[tauri::command]
pub async fn initialize_service(state: State<'_, AppState>) -> Result<(), String> {
    state
        .opencode
        .initialize()
        .await
        .map_err(|e| e.to_string())
}

/// Start the opencode service
#[tauri::command]
pub async fn start_service(state: State<'_, AppState>) -> Result<(), String> {
    state.opencode.start().await.map_err(|e| e.to_string())
}

/// Stop the opencode service
#[tauri::command]
pub async fn stop_service(state: State<'_, AppState>) -> Result<(), String> {
    state.opencode.stop().await.map_err(|e| e.to_string())
}

/// Restart the opencode service
#[tauri::command]
pub async fn restart_service(state: State<'_, AppState>) -> Result<(), String> {
    state.opencode.restart().await.map_err(|e| e.to_string())
}

/// Get the service endpoint URL
#[tauri::command]
pub fn get_service_endpoint(state: State<'_, AppState>) -> Option<String> {
    state.opencode.get_endpoint()
}
