//! 应用设置命令

use crate::opencode::AppSettings;
use crate::state::AppState;
use crate::utils::paths;
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

#[tauri::command]
pub fn set_project_directory(
    state: State<'_, AppState>,
    path: Option<String>,
) -> Result<(), String> {
    state.settings.set_project_directory(path)
}

#[tauri::command]
pub fn get_project_directory(state: State<'_, AppState>) -> Option<String> {
    state.settings.get_project_directory()
}

#[tauri::command]
pub fn get_opencode_config_path() -> Result<String, String> {
    paths::get_opencode_config_path()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "应用数据目录未初始化".to_string())
}
