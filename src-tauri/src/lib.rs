//! Axon Desktop - AI Client Application
//!
//! 这是 Axon Desktop 应用的主库入口。
//! 负责初始化 Tauri 应用、设置窗口、管理 OpenCode 服务。

mod commands;
mod models_registry;
mod opencode;
mod plugin_api;
mod settings;
mod state;
mod utils;

use commands::*;
use state::AppState;
use tauri::Listener;
use tauri::Manager;
use tauri::window::Color;
use tauri_plugin_window_state::StateFlags;
use tracing::info;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// 初始化日志系统
fn init_logging() {
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::from_default_env().add_directive("axon_desktop=debug".parse().unwrap()))
        .init();
}

/// 获取 WebView2 优化参数（仅 Windows）
/// 这些参数可以加速 WebView2 启动
#[cfg(target_os = "windows")]
fn get_webview_args() -> &'static str {
    // 禁用不必要的功能以加速启动
    "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection \
     --no-first-run \
     --disable-background-networking \
     --disable-component-update \
     --disable-sync \
     --disable-translate"
}

#[cfg(not(target_os = "windows"))]
fn get_webview_args() -> &'static str {
    ""
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logging();
    info!("启动 Axon Desktop...");

    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    StateFlags::SIZE
                        | StateFlags::POSITION
                        | StateFlags::MAXIMIZED
                        | StateFlags::FULLSCREEN,
                )
                .build(),
        )
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
            // 版本管理命令
            get_version_info,
            check_for_update,
            update_opencode,
            // 应用更新命令
            check_app_update,
            install_app_update,
            get_app_version,
            // 应用设置命令
            get_app_settings,
            set_app_settings,
            set_auto_update,
            set_custom_opencode_path,
            set_project_directory,
            get_project_directory,
            get_opencode_config_path,
            // Provider 管理命令
            add_user_provider,
            update_user_provider,
            remove_user_provider,
            test_provider_connection,
            remove_provider_auth,
            get_provider_auth_status,
            get_all_provider_auth_status,
            // 窗口命令
            window_minimize,
            window_maximize,
            window_close,
            window_is_maximized,
            window_toggle_fullscreen,
            // 文件系统命令
            ensure_directory_exists,
            select_directory,
            read_directory,
            read_file_content,
            read_file_binary,
            write_file_content,
            delete_path,
            rename_path,
            copy_path,
            move_path,
            // Diff 计算命令
            compute_diff,
            compute_unified_diff,
            compute_diff_stats,
            texts_are_equal,
            // 工作区布局命令
            save_workspace_layout,
            load_workspace_layout,
            delete_workspace_layout,
            list_workspace_layouts,
            // Agent 配置命令
            get_agents_directory,
            list_agents,
            read_agent,
            save_agent,
            delete_agent,
            save_agents_batch,
            // Workflow 配置命令
            get_workflows_directory,
            list_workflows,
            read_workflow,
            save_workflow,
            delete_workflow,
            save_workflows_batch,
            // 编排组配置命令
            get_orchestrations_directory,
            list_orchestrations,
            read_orchestration,
            save_orchestration,
            delete_orchestration,
            save_orchestrations_batch,
            // 模型注册表命令
            get_model_defaults,
            get_all_model_defaults,
            search_models,
            get_models_registry_cache_info,
            refresh_models_registry,
            trigger_background_refresh,
        ])
        .setup(|app| {
            let setup_start = std::time::Instant::now();
            let handle = app.handle().clone();

            // 0. 创建优化的主窗口（使用 additional_browser_args 加速 WebView）
            let webview_args = get_webview_args();
            info!("创建主窗口，WebView 参数: {}", webview_args);
            
            // 窗口背景色 - 与 index.html 的亮色主题一致
            // 使用 RGBA 格式: (R, G, B, A)，颜色值 #f8f9fa
            let bg_color = Color(0xf8, 0xf9, 0xfa, 0xFF);
            
            // 创建窗口时先隐藏，等 WebView 加载完成后再显示
            // 这样可以避免用户看到白屏闪烁
            let main_window = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Axon")
            .inner_size(1200.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .decorations(false)
            .transparent(false)
            .visible(false)
            .background_color(bg_color)
            .additional_browser_args(webview_args)
            .build()?;

            // 监听前端发送的 "app-ready" 事件，收到后显示窗口
            let window_for_event = main_window.clone();
            main_window.listen("app-ready", move |_| {
                info!("收到前端 app-ready 事件，显示窗口");
                if let Err(e) = window_for_event.show() {
                    tracing::error!("显示窗口失败: {}", e);
                }
                // 确保窗口获得焦点
                let _ = window_for_event.set_focus();
            });

            // 设置超时保护：如果 3 秒内前端没有发送 ready 事件，强制显示窗口
            // 避免因前端错误导致窗口永远不显示
            let window_for_timeout = main_window.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(3));
                // 检查窗口是否仍然隐藏
                if let Ok(visible) = window_for_timeout.is_visible() {
                    if !visible {
                        info!("超时保护：强制显示窗口");
                        let _ = window_for_timeout.show();
                        let _ = window_for_timeout.set_focus();
                    }
                }
            });

            // 1. 首先初始化应用数据目录（其他操作依赖此路径）
            //    使用 Tauri API 获取正确的应用目录，与 identifier 一致
            utils::paths::init_app_data_dir(&handle)
                .map_err(|e| Box::new(std::io::Error::other(e)))?;

            if let Err(e) = utils::plugin_installer::install_bundled_plugins(&handle) {
                tracing::warn!("插件安装失败: {}，继续启动应用", e);
            }

            // 2. 设置 app_handle 用于事件发送（必须在异步操作之前）
            {
                let state: tauri::State<'_, AppState> = handle.state();
                state.opencode.set_app_handle(handle.clone());
                info!("OpenCode 服务 app_handle 已设置");

                state.models_registry.initialize();
                info!("模型注册表缓存已加载");
            }

            info!("Setup 同步阶段完成，耗时: {:?}", setup_start.elapsed());

            // 3. 异步初始化服务（不阻塞窗口显示）
            //    下载 opencode 二进制、启动服务等耗时操作都在这里进行
            let init_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                info!("开始异步初始化服务...");
                let state: tauri::State<'_, AppState> = init_handle.state();

                // 启动 Plugin API 服务器
                let plugin_api = std::sync::Arc::clone(&state.plugin_api);
                let opencode = std::sync::Arc::clone(&state.opencode);
                let _ = tokio::task::spawn_blocking(move || {
                    let rt = tokio::runtime::Handle::current();
                    let mut server = plugin_api.write();
                    rt.block_on(async {
                        match server.start().await {
                            Ok(port) => {
                                info!("Plugin API 服务器启动成功，端口: {}", port);
                                opencode.set_plugin_api_port(port);
                            }
                            Err(e) => tracing::error!("Plugin API 服务器启动失败: {}", e),
                        }
                    });
                }).await;

                // 初始化 OpenCode 服务（如需要会下载二进制）
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

                state.models_registry.refresh_in_background().await;
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    info!("主窗口关闭，停止 Plugin API 服务器");
                    let state: tauri::State<'_, AppState> = window.state();
                    let mut server = state.plugin_api.write();
                    server.stop();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用时发生错误");
}
