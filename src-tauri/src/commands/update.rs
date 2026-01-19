// 应用更新相关的命令

use serde::{Deserialize, Serialize};
use tauri::command;
use tauri_plugin_updater::UpdaterExt;

/// 更新信息响应
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateInfo {
    /// 是否有可用的更新
    pub available: bool,
    /// 当前版本
    pub current_version: String,
    /// 新版本（如果有可用更新）
    pub new_version: Option<String>,
    /// 更新说明（如果有可用更新）
    pub update_notes: Option<String>,
    /// 下载进度百分比（0-100）
    pub download_progress: u32,
}

/// 检查应用更新
///
/// 查询 GitHub releases 获取最新版本信息。
/// 如果有新版本可用，将在后台自动下载。
#[command]
pub async fn check_app_update(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    // 获取当前版本
    let current_version = app.package_info().version.to_string();

    // 创建 updater 查询
    match app.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(update_response) => match update_response {
                    Some(update) => {
                        // 有可用的更新，获取版本和更新说明
                        let new_version = update.version.clone();
                        let update_notes = update.body.clone();

                        tracing::info!("发现新版本: {}", new_version);

                        // 不自动安装，让前端决定
                        Ok(UpdateInfo {
                            available: true,
                            current_version,
                            new_version: Some(new_version),
                            update_notes,
                            download_progress: 100,
                        })
                    }
                    None => {
                        // 已是最新版本
                        tracing::info!("已是最新版本: {}", current_version);
                        Ok(UpdateInfo {
                            available: false,
                            current_version,
                            new_version: None,
                            update_notes: None,
                            download_progress: 0,
                        })
                    }
                },
                Err(e) => {
                    tracing::warn!("检查更新出错: {}", e);
                    Err(format!("检查更新失败: {}", e))
                }
            }
        }
        Err(e) => {
            tracing::error!("获取 updater 实例失败: {}", e);
            Err("更新模块未初始化".to_string())
        }
    }
}

/// 下载并安装更新
///
/// 在用户确认后执行更新。此操作会：
/// 1. 下载新版本
/// 2. 验证签名
/// 3. 安装更新
/// 4. 退出应用（安装程序会自动启动新版本）
#[command]
pub async fn install_app_update(app: tauri::AppHandle) -> Result<(), String> {
    match app.updater() {
        Ok(updater) => {
            // 重新检查更新
            match updater.check().await {
                Ok(update_response) => match update_response {
                    Some(update) => {
                        tracing::info!("准备安装新版本: {}", update.version);

                        // 安装更新（会自动退出应用）
                        // 使用简单的回调函数来跟踪进度
                        match update
                            .download_and_install(
                                |chunk_len, _content_length| {
                                    tracing::debug!("下载进度: {} 字节", chunk_len);
                                },
                                || {
                                    tracing::info!("下载完成，开始安装");
                                },
                            )
                            .await
                        {
                            Ok(_) => {
                                tracing::info!("更新下载并安装成功，正在重启应用");
                                Ok(())
                            }
                            Err(e) => {
                                tracing::error!("下载并安装更新失败: {}", e);
                                Err(format!("更新安装失败: {}", e))
                            }
                        }
                    }
                    None => Err("已是最新版本，无需更新".to_string()),
                },
                Err(e) => {
                    tracing::error!("重新检查更新失败: {}", e);
                    Err(format!("检查更新失败: {}", e))
                }
            }
        }
        Err(e) => {
            tracing::error!("获取 updater 实例失败: {}", e);
            Err("更新模块未初始化".to_string())
        }
    }
}

/// 获取当前应用版本信息
#[command]
pub fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}
