//! Axon Desktop - AI Client Application
//!
//! This is the main library for the Axon Desktop application.

mod commands;
mod opencode;
mod state;
mod utils;

use commands::*;
use state::AppState;
use tauri::Manager;
use tracing::info;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// Initialize logging
fn init_logging() {
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::from_default_env().add_directive("axon_desktop=debug".parse().unwrap()))
        .init();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logging();
    info!("Starting Axon Desktop...");

    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // OpenCode service commands
            get_service_status,
            get_service_config,
            set_service_mode,
            set_service_config,
            initialize_service,
            start_service,
            stop_service,
            restart_service,
            get_service_endpoint,
            // Window commands
            window_minimize,
            window_maximize,
            window_close,
            window_is_maximized,
            window_toggle_fullscreen,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            
            // Set app handle for event emission BEFORE any async operations
            {
                let state: tauri::State<'_, AppState> = handle.state();
                state.opencode.set_app_handle(handle.clone());
                info!("App handle set for OpenCode service");
            }
            
            // Auto-initialize service on startup
            let init_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                info!("Starting auto-initialization of OpenCode service...");
                let state: tauri::State<'_, AppState> = init_handle.state();
                
                // Initialize (download binary if needed)
                match state.opencode.initialize().await {
                    Ok(()) => {
                        info!("OpenCode service initialized successfully");
                        // Auto-start if configured
                        let config = state.opencode.get_config();
                        if config.auto_start {
                            info!("Auto-starting OpenCode service...");
                            if let Err(e) = state.opencode.start().await {
                                tracing::error!("Failed to auto-start opencode service: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("Failed to initialize opencode service: {}", e);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
