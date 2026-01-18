//! 模型注册表 Tauri Commands
//!
//! 提供给前端调用的模型注册表相关接口

use crate::models_registry::ModelDefaults;
use crate::state::AppState;
use tauri::State;
use tracing::debug;

/// 获取指定模型的默认参数
///
/// # 参数
/// - `model_id`: 模型 ID，格式为 "provider/model"，如 "anthropic/claude-sonnet-4-5"
///
/// # 返回
/// 模型默认参数，如果模型不存在则返回 None
#[tauri::command]
pub fn get_model_defaults(
    state: State<'_, AppState>,
    model_id: String,
) -> Option<ModelDefaults> {
    debug!("获取模型默认参数: {}", model_id);
    state.models_registry.get_model_defaults(&model_id)
}

/// 获取所有模型的默认参数列表
///
/// # 返回
/// 所有已缓存模型的默认参数列表
#[tauri::command]
pub fn get_all_model_defaults(state: State<'_, AppState>) -> Vec<ModelDefaults> {
    debug!("获取所有模型默认参数");
    state.models_registry.get_all_model_defaults()
}

/// 搜索模型
///
/// # 参数
/// - `query`: 搜索关键词，匹配模型 ID、名称或 Provider 名称
///
/// # 返回
/// 匹配的模型列表
#[tauri::command]
pub fn search_models(state: State<'_, AppState>, query: String) -> Vec<ModelDefaults> {
    debug!("搜索模型: {}", query);
    state.models_registry.search_models(&query)
}

/// 获取缓存信息
///
/// # 返回
/// (hash, timestamp, is_expired) 或 None（如果无缓存）
#[tauri::command]
pub fn get_models_registry_cache_info(
    state: State<'_, AppState>,
) -> Option<(String, u64, bool)> {
    state.models_registry.get_cache_info()
}

/// 强制刷新模型注册表
///
/// 从远程重新获取数据，忽略缓存
#[tauri::command]
pub async fn refresh_models_registry(state: State<'_, AppState>) -> Result<(), String> {
    debug!("强制刷新模型注册表");
    state.models_registry.force_refresh().await
}

/// 触发后台刷新（静默）
///
/// 如果距上次刷新超过 6 小时，则在后台刷新数据
#[tauri::command]
pub async fn trigger_background_refresh(state: State<'_, AppState>) -> Result<(), String> {
    debug!("触发后台刷新模型注册表");
    state.models_registry.refresh_in_background().await;
    Ok(())
}
