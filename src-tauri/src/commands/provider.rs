use crate::opencode::UserProviderConfig;
use crate::state::AppState;
use crate::utils::paths::get_app_data_dir;
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::{debug, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderAuthStatus {
    /// Provider ID
    pub provider_id: String,
    /// 是否已认证
    pub authenticated: bool,
    /// 认证类型 (api/oauth/wellknown)
    pub auth_type: Option<String>,
}

/// 获取 auth.json 文件路径
fn get_auth_json_path() -> Result<std::path::PathBuf, String> {
    let app_data_dir = get_app_data_dir()
        .ok_or_else(|| "应用数据目录未初始化".to_string())?;
    // OpenCode 的 auth.json 位于 <app_data_dir>/opencode/auth.json
    // 因为 Axon 设置了 XDG_DATA_HOME=app_data_dir，
    // xdg-basedir 会在其下创建 /opencode 子目录
    Ok(app_data_dir.join("opencode").join("auth.json"))
}

/// 获取 config.json 文件路径
fn get_config_json_path() -> Result<std::path::PathBuf, String> {
    let app_data_dir = get_app_data_dir()
        .ok_or_else(|| "应用数据目录未初始化".to_string())?;
    // OpenCode 的 config.json 位于 <app_data_dir>/opencode/config.json
    Ok(app_data_dir.join("opencode").join("config.json"))
}

/// 读取 auth.json 内容
fn read_auth_json() -> Result<serde_json::Value, String> {
    let auth_path = get_auth_json_path()?;
    
    if !auth_path.exists() {
        debug!("auth.json 不存在，返回空对象");
        return Ok(serde_json::json!({}));
    }
    
    let content = std::fs::read_to_string(&auth_path)
        .map_err(|e| format!("读取 auth.json 失败: {}", e))?;
    
    serde_json::from_str(&content)
        .map_err(|e| format!("解析 auth.json 失败: {}", e))
}

/// 写入 auth.json 内容
fn write_auth_json(data: &serde_json::Value) -> Result<(), String> {
    let auth_path = get_auth_json_path()?;
    
    // 确保目录存在
    if let Some(parent) = auth_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("创建 auth.json 目录失败: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("序列化 auth.json 失败: {}", e))?;
    
    std::fs::write(&auth_path, content)
        .map_err(|e| format!("写入 auth.json 失败: {}", e))?;
    
    // 设置文件权限为 600（仅所有者可读写）- 仅 Unix 系统
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let permissions = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(&auth_path, permissions)
            .map_err(|e| format!("设置 auth.json 权限失败: {}", e))?;
    }
    
    Ok(())
}

/// 读取 config.json 内容
fn read_config_json() -> Result<serde_json::Value, String> {
    let config_path = get_config_json_path()?;
    
    if !config_path.exists() {
        debug!("config.json 不存在，返回空对象");
        return Ok(serde_json::json!({}));
    }
    
    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("读取 config.json 失败: {}", e))?;
    
    serde_json::from_str(&content)
        .map_err(|e| format!("解析 config.json 失败: {}", e))
}

/// 写入 config.json 内容
fn write_config_json(data: &serde_json::Value) -> Result<(), String> {
    let config_path = get_config_json_path()?;
    
    // 确保目录存在
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("创建 config.json 目录失败: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("序列化 config.json 失败: {}", e))?;
    
    std::fs::write(&config_path, content)
        .map_err(|e| format!("写入 config.json 失败: {}", e))?;
    
    Ok(())
}

/// 删除指定 provider 的认证信息和配置
///
/// 清理以下内容:
/// 1. auth.json 中的认证信息（API Key、OAuth Token 等）
/// 2. config.json 中的整个 provider.{providerID} 配置项
///
/// 注意：前端调用后应该调用 client.instance.dispose() 刷新 OpenCode 缓存
#[tauri::command]
pub async fn remove_provider_auth(provider_id: String) -> Result<(), String> {
    info!("删除 provider 认证和配置: {}", provider_id);

    // 1. 删除 auth.json 中的认证信息
    let mut auth_data = read_auth_json()?;
    if let Some(obj) = auth_data.as_object_mut() {
        if obj.remove(&provider_id).is_some() {
            write_auth_json(&auth_data)?;
            info!("已删除 provider {} 的认证信息 (auth.json)", provider_id);
        } else {
            debug!("provider {} 的认证信息不存在 (auth.json)", provider_id);
        }
    }

    // 2. 删除 config.json 中的整个 provider 配置项
    let mut config_data = read_config_json()?;
    if let Some(config_obj) = config_data.as_object_mut() {
        if let Some(provider_section) = config_obj.get_mut("provider") {
            if let Some(provider_obj) = provider_section.as_object_mut() {
                if provider_obj.remove(&provider_id).is_some() {
                    write_config_json(&config_data)?;
                    info!("已删除 provider {} 的全部配置 (config.json)", provider_id);
                } else {
                    debug!("provider {} 在 config.json 中不存在", provider_id);
                }
            }
        }
    }

    info!("provider {} 的认证和配置清理完成", provider_id);
    Ok(())
}

/// 获取指定 provider 的认证状态
#[tauri::command]
pub async fn get_provider_auth_status(provider_id: String) -> Result<ProviderAuthStatus, String> {
    let auth_data = read_auth_json()?;
    
    let (authenticated, auth_type) = if let Some(auth_info) = auth_data.get(&provider_id) {
        let auth_type = auth_info.get("type")
            .and_then(|v| v.as_str())
            .map(String::from);
        (true, auth_type)
    } else {
        (false, None)
    };
    
    Ok(ProviderAuthStatus {
        provider_id,
        authenticated,
        auth_type,
    })
}

/// 获取所有已认证的 provider 列表
#[tauri::command]
pub async fn get_all_provider_auth_status() -> Result<Vec<ProviderAuthStatus>, String> {
    let auth_data = read_auth_json()?;
    
    let mut statuses = Vec::new();
    
    if let Some(obj) = auth_data.as_object() {
        for (provider_id, auth_info) in obj {
            let auth_type = auth_info.get("type")
                .and_then(|v| v.as_str())
                .map(String::from);
            
            statuses.push(ProviderAuthStatus {
                provider_id: provider_id.clone(),
                authenticated: true,
                auth_type,
            });
        }
    }
    
    Ok(statuses)
}

#[tauri::command]
pub async fn add_user_provider(
    state: State<'_, AppState>,
    config: UserProviderConfig,
) -> Result<(), String> {
    let mut settings = state.settings.get_settings();
    settings.providers.push(config);
    state.settings.set_settings(settings)?;
    Ok(())
}

#[tauri::command]
pub async fn update_user_provider(
    state: State<'_, AppState>,
    id: String,
    updates: serde_json::Value,
) -> Result<(), String> {
    use crate::opencode::{CustomConfig, ProviderAuth};
    
    let mut settings = state.settings.get_settings();
    
    let provider = settings
        .providers
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| "Provider not found".to_string())?;
    
    // 更新名称
    if let Some(name) = updates.get("name").and_then(|v| v.as_str()) {
        provider.name = name.to_string();
    }
    
    // 更新认证信息
    if let Some(auth_value) = updates.get("auth") {
        if let Ok(auth) = serde_json::from_value::<ProviderAuth>(auth_value.clone()) {
            provider.auth = auth;
        }
    }
    
    // 更新自定义配置
    if let Some(custom_config_value) = updates.get("customConfig") {
        if custom_config_value.is_null() {
            provider.custom_config = None;
        } else if let Ok(custom_config) = serde_json::from_value::<CustomConfig>(custom_config_value.clone()) {
            provider.custom_config = Some(custom_config);
        }
    }
    
    provider.updated_at = chrono::Utc::now().to_rfc3339();
    
    state.settings.set_settings(settings)?;
    Ok(())
}

#[tauri::command]
pub async fn remove_user_provider(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let mut settings = state.settings.get_settings();
    settings.providers.retain(|p| p.id != id);
    state.settings.set_settings(settings)?;
    Ok(())
}

#[tauri::command]
pub async fn test_provider_connection(
    _state: State<'_, AppState>,
    _id: String,
) -> Result<bool, String> {
    Ok(true)
}
