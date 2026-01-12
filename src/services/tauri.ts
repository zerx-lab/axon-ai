/**
 * Tauri API service layer
 * Wraps all Tauri invoke calls for type safety
 */

import { invoke } from "@tauri-apps/api/core";

// Types matching Rust definitions
export type ServiceMode =
  | { type: "local" }
  | { type: "remote"; url: string };

export type ServiceStatus =
  | { type: "uninitialized" }
  | { type: "downloading"; progress: number }
  | { type: "ready" }
  | { type: "starting" }
  | { type: "running"; port: number }
  | { type: "stopped" }
  | { type: "error"; message: string };

export interface ServiceConfig {
  mode: ServiceMode;
  port: number;
  autoStart: boolean;
}

export interface VersionInfo {
  installed: string | null;
  latest: string | null;
  updateAvailable: boolean;
}

export interface AppSettings {
  autoUpdate: boolean;
  customOpencodePath: string | null;
  installedVersion: string | null;
}

// OpenCode service commands
export const opencode = {
  getStatus: () => invoke<ServiceStatus>("get_service_status"),
  getConfig: () => invoke<ServiceConfig>("get_service_config"),
  setMode: (mode: ServiceMode) => invoke("set_service_mode", { mode }),
  setConfig: (config: ServiceConfig) => invoke("set_service_config", { config }),
  initialize: () => invoke("initialize_service"),
  start: () => invoke("start_service"),
  stop: () => invoke("stop_service"),
  restart: () => invoke("restart_service"),
  getEndpoint: () => invoke<string | null>("get_service_endpoint"),
  getVersionInfo: () => invoke<VersionInfo>("get_version_info"),
  checkForUpdate: () => invoke<VersionInfo>("check_for_update"),
  updateOpencode: () => invoke("update_opencode"),
};

// App settings commands
export const settings = {
  get: () => invoke<AppSettings>("get_app_settings"),
  set: (settings: AppSettings) => invoke("set_app_settings", { settings }),
  setAutoUpdate: (enabled: boolean) => invoke("set_auto_update", { enabled }),
  setCustomOpencodePath: (path: string | null) => invoke("set_custom_opencode_path", { path }),
};

// Window control commands
export const window = {
  minimize: () => invoke("window_minimize"),
  maximize: () => invoke("window_maximize"),
  close: () => invoke("window_close"),
  isMaximized: () => invoke<boolean>("window_is_maximized"),
  toggleFullscreen: () => invoke("window_toggle_fullscreen"),
};
