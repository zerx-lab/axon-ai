//! 应用设置持久化模块

use crate::opencode::AppSettings;
use crate::utils::paths::get_app_data_dir;
use parking_lot::RwLock;
use std::path::PathBuf;
use std::sync::Arc;
use tracing::{debug, info, warn};

const SETTINGS_FILE: &str = "settings.json";

pub struct SettingsManager {
    settings: RwLock<AppSettings>,
}

impl SettingsManager {
    pub fn new() -> Arc<Self> {
        let settings = Self::load_settings().unwrap_or_default();
        info!("Settings loaded: auto_update={}, custom_path={:?}",
            settings.auto_update,
            settings.custom_opencode_path
        );

        Arc::new(Self {
            settings: RwLock::new(settings),
        })
    }

    fn get_settings_path() -> Option<PathBuf> {
        get_app_data_dir().map(|p| p.join(SETTINGS_FILE))
    }

    fn load_settings() -> Option<AppSettings> {
        let path = Self::get_settings_path()?;
        if !path.exists() {
            debug!("Settings file not found, using defaults");
            return None;
        }

        match std::fs::read_to_string(&path) {
            Ok(content) => match serde_json::from_str(&content) {
                Ok(settings) => Some(settings),
                Err(e) => {
                    warn!("Failed to parse settings file: {}", e);
                    None
                }
            },
            Err(e) => {
                warn!("Failed to read settings file: {}", e);
                None
            }
        }
    }

    fn save_settings(&self) -> Result<(), String> {
        let path = Self::get_settings_path()
            .ok_or_else(|| "Cannot determine settings path".to_string())?;

        let settings = self.settings.read();
        let content = serde_json::to_string_pretty(&*settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;

        std::fs::write(&path, content)
            .map_err(|e| format!("Failed to write settings file: {}", e))?;

        debug!("Settings saved to {:?}", path);
        Ok(())
    }

    pub fn get_settings(&self) -> AppSettings {
        self.settings.read().clone()
    }

    pub fn set_settings(&self, settings: AppSettings) -> Result<(), String> {
        *self.settings.write() = settings;
        self.save_settings()
    }

    pub fn set_auto_update(&self, enabled: bool) -> Result<(), String> {
        self.settings.write().auto_update = enabled;
        self.save_settings()
    }

    pub fn set_custom_opencode_path(&self, path: Option<String>) -> Result<(), String> {
        self.settings.write().custom_opencode_path = path;
        self.save_settings()
    }

    pub fn set_installed_version(&self, version: Option<String>) -> Result<(), String> {
        self.settings.write().installed_version = version;
        self.save_settings()
    }

    pub fn get_custom_opencode_path(&self) -> Option<String> {
        self.settings.read().custom_opencode_path.clone()
    }

    pub fn get_installed_version(&self) -> Option<String> {
        self.settings.read().installed_version.clone()
    }

    pub fn set_project_directory(&self, path: Option<String>) -> Result<(), String> {
        self.settings.write().project_directory = path;
        self.save_settings()
    }

    pub fn get_project_directory(&self) -> Option<String> {
        self.settings.read().project_directory.clone()
    }
}

impl Default for SettingsManager {
    fn default() -> Self {
        Self {
            settings: RwLock::new(AppSettings::default()),
        }
    }
}
