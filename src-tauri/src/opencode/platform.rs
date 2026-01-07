//! Platform-specific utilities for opencode binary
//!
//! Download URL format: https://github.com/anomalyco/opencode/releases/download/{version}/opencode-{platform}.zip
//! Example: https://github.com/anomalyco/opencode/releases/download/v1.1.4/opencode-darwin-arm64.zip

use std::env::consts::{ARCH, OS};

/// Get the platform identifier for download URL
/// Format: {os}-{arch} where:
/// - os: darwin, linux, windows
/// - arch: arm64, x64
pub fn get_platform_identifier() -> Option<&'static str> {
    match (OS, ARCH) {
        ("windows", "x86_64") => Some("windows-x64"),
        ("windows", "aarch64") => Some("windows-arm64"),
        ("macos", "x86_64") => Some("darwin-x64"),
        ("macos", "aarch64") => Some("darwin-arm64"),
        ("linux", "x86_64") => Some("linux-x64"),
        ("linux", "aarch64") => Some("linux-arm64"),
        _ => None,
    }
}

/// Get the archive extension for the current platform
/// All platforms use .zip for opencode releases
pub fn get_archive_extension() -> &'static str {
    "zip"
}

/// Get the binary name for the current platform
pub fn get_binary_name() -> &'static str {
    if cfg!(windows) {
        "opencode.exe"
    } else {
        "opencode"
    }
}

/// Build the download URL for a specific version
/// URL format: https://github.com/anomalyco/opencode/releases/download/{version}/opencode-{platform}.zip
pub fn build_download_url(version: &str) -> Option<String> {
    let platform = get_platform_identifier()?;
    let ext = get_archive_extension();

    Some(format!(
        "https://github.com/anomalyco/opencode/releases/download/{version}/opencode-{platform}.{ext}"
    ))
}

/// Get the latest release API URL
pub fn get_latest_release_api_url() -> &'static str {
    "https://api.github.com/repos/anomalyco/opencode/releases/latest"
}
