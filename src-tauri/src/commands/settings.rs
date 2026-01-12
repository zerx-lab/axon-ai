//! 应用设置命令

use crate::opencode::AppSettings;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn get_app_settings(state: State<'_, AppState>) -> AppSettings {
    state.settings.get_settings()
}

#[tauri::command]
pub fn set_app_settings(state: State<'_, AppState>, settings: AppSettings) -> Result<(), String> {
    state.settings.set_settings(settings)
}

#[tauri::command]
pub fn set_auto_update(state: State<'_, AppState>, enabled: bool) -> Result<(), String> {
    state.settings.set_auto_update(enabled)
}

#[tauri::command]
pub fn set_custom_opencode_path(
    state: State<'_, AppState>,
    path: Option<String>,
) -> Result<(), String> {
    state.settings.set_custom_opencode_path(path)
}
