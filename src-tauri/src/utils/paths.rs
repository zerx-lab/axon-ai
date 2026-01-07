//! Application path utilities

use directories::ProjectDirs;
use std::path::PathBuf;

/// Get the application data directory
pub fn get_app_data_dir() -> Option<PathBuf> {
    ProjectDirs::from("com", "zero", "axon_desktop").map(|dirs| dirs.data_dir().to_path_buf())
}

/// Get the directory for storing binaries
pub fn get_bin_dir() -> Option<PathBuf> {
    get_app_data_dir().map(|p| p.join("bin"))
}

/// Get the opencode binary path
pub fn get_opencode_bin_path() -> Option<PathBuf> {
    get_bin_dir().map(|p| {
        if cfg!(windows) {
            p.join("opencode.exe")
        } else {
            p.join("opencode")
        }
    })
}

/// Get the config directory
/// TODO: Will be used for storing user settings and service configuration
#[allow(dead_code)]
pub fn get_config_dir() -> Option<PathBuf> {
    ProjectDirs::from("com", "zero", "axon_desktop").map(|dirs| dirs.config_dir().to_path_buf())
}

/// Get the logs directory
/// TODO: Will be used for storing application logs
#[allow(dead_code)]
pub fn get_logs_dir() -> Option<PathBuf> {
    get_app_data_dir().map(|p| p.join("logs"))
}
