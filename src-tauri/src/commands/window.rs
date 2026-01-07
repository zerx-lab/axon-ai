//! Window control commands

use tauri::{AppHandle, Manager};

/// Minimize the window
#[tauri::command]
pub fn window_minimize(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.minimize();
    }
}

/// Maximize or restore the window
#[tauri::command]
pub fn window_maximize(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_maximized().unwrap_or(false) {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

/// Close the window
#[tauri::command]
pub fn window_close(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.close();
    }
}

/// Check if window is maximized
#[tauri::command]
pub fn window_is_maximized(app: AppHandle) -> bool {
    app.get_webview_window("main")
        .map(|w| w.is_maximized().unwrap_or(false))
        .unwrap_or(false)
}

/// Toggle fullscreen
#[tauri::command]
pub fn window_toggle_fullscreen(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_fullscreen = window.is_fullscreen().unwrap_or(false);
        let _ = window.set_fullscreen(!is_fullscreen);
    }
}
