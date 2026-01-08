//! Axon Desktop - AI Client Application
//!
//! 这是 Axon Desktop 应用的主库入口。
//! 负责初始化 Tauri 应用、设置窗口、管理 OpenCode 服务。

mod commands;
mod opencode;
mod state;
mod utils;

use commands::*;
use state::AppState;
use tauri::Manager;
use tracing::info;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// 初始化日志系统
fn init_logging() {
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::from_default_env().add_directive("axon_desktop=debug".parse().unwrap()))
        .init();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logging();
    info!("启动 Axon Desktop...");

    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // OpenCode 服务命令
            get_service_status,
            get_service_config,
            set_service_mode,
            set_service_config,
            initialize_service,
            start_service,
            stop_service,
            restart_service,
            get_service_endpoint,
            // 窗口命令
            window_minimize,
            window_maximize,
            window_close,
            window_is_maximized,
            window_toggle_fullscreen,
            // 文件系统命令
            ensure_directory_exists,
            select_directory,
        ])
        .setup(|app| {
            let setup_start = std::time::Instant::now();
            let handle = app.handle().clone();

            // 1. 首先初始化应用数据目录（其他操作依赖此路径）
            //    使用 Tauri API 获取正确的应用目录，与 identifier 一致
            utils::paths::init_app_data_dir(&handle)
                .map_err(|e| Box::new(std::io::Error::other(e)))?;

            // 2. 设置 app_handle 用于事件发送（必须在异步操作之前）
            {
                let state: tauri::State<'_, AppState> = handle.state();
                state.opencode.set_app_handle(handle.clone());
                info!("OpenCode 服务 app_handle 已设置");
            }

            info!("Setup 同步阶段完成，耗时: {:?}", setup_start.elapsed());

            // 3. 异步初始化服务（不阻塞窗口显示）
            //    下载 opencode 二进制、启动服务等耗时操作都在这里进行
            let init_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                info!("开始异步初始化 OpenCode 服务...");
                let state: tauri::State<'_, AppState> = init_handle.state();

                // 初始化服务（如需要会下载二进制）
                match state.opencode.initialize().await {
                    Ok(()) => {
                        info!("OpenCode 服务初始化成功");
                        // 如果配置了自动启动，则启动服务
                        let config = state.opencode.get_config();
                        if config.auto_start {
                            info!("自动启动 OpenCode 服务...");
                            if let Err(e) = state.opencode.start().await {
                                tracing::error!("自动启动 opencode 服务失败: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("初始化 opencode 服务失败: {}", e);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用时发生错误");
}
