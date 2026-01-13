//! OpenCode binary downloader

use crate::opencode::platform::{
    build_download_url, get_archive_extension, get_binary_name, get_latest_release_api_url,
};
use crate::opencode::types::{DownloadProgress, OpencodeError};
use crate::utils::paths::{get_bin_dir, get_opencode_bin_path};
use futures_util::StreamExt;
use serde::Deserialize;
use std::io::Write;
use std::path::{Path, PathBuf};
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

/// Default fallback version when API is rate-limited
const FALLBACK_VERSION: &str = "v1.1.13";

fn extract_binary_sync(archive_path: &Path, dest_dir: &Path) -> Result<PathBuf, OpencodeError> {
    let binary_name = get_binary_name();
    let binary_path = dest_dir.join(binary_name);

    if cfg!(windows) {
        extract_zip_sync(archive_path, dest_dir, binary_name)?;
    } else {
        extract_tar_gz_sync(archive_path, dest_dir, binary_name)?;
    }

    if !binary_path.exists() {
        return Err(OpencodeError::ExtractError(
            "Binary not found in archive".to_string(),
        ));
    }

    Ok(binary_path)
}

fn extract_zip_sync(
    archive_path: &Path,
    dest_dir: &Path,
    binary_name: &str,
) -> Result<(), OpencodeError> {
    let file = std::fs::File::open(archive_path)?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| OpencodeError::ExtractError(e.to_string()))?;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| OpencodeError::ExtractError(e.to_string()))?;

        let file_name = file.name().to_string();
        if file_name.ends_with(binary_name) {
            let dest_path = dest_dir.join(binary_name);

            if dest_path.exists() {
                let max_retries = 20;
                let mut deleted = false;
                for attempt in 1..=max_retries {
                    match std::fs::remove_file(&dest_path) {
                        Ok(_) => {
                            debug!("Removed old binary on attempt {}", attempt);
                            deleted = true;
                            break;
                        }
                        Err(e) => {
                            if attempt < max_retries {
                                debug!(
                                    "Retry {}/{}: waiting for file release: {}",
                                    attempt, max_retries, e
                                );
                                std::thread::sleep(std::time::Duration::from_millis(500));
                            } else {
                                warn!(
                                    "Failed to remove old binary after {} attempts ({}s): {}",
                                    max_retries,
                                    max_retries as f32 * 0.5,
                                    e
                                );
                                return Err(OpencodeError::ExtractError(format!(
                                    "无法替换旧版本文件，文件被占用。请确保 opencode 进程已完全退出后重试。错误: {}",
                                    e
                                )));
                            }
                        }
                    }
                }
                if !deleted {
                    return Err(OpencodeError::ExtractError(
                        "无法删除旧版本文件，文件被锁定".to_string(),
                    ));
                }
            }

            let mut dest_file = std::fs::File::create(&dest_path)?;
            std::io::copy(&mut file, &mut dest_file)?;
            debug!("Extracted {} to {:?}", binary_name, dest_path);
            return Ok(());
        }
    }

    Err(OpencodeError::ExtractError(format!(
        "Binary '{}' not found in archive",
        binary_name
    )))
}

#[cfg(not(windows))]
fn extract_tar_gz_sync(
    archive_path: &Path,
    dest_dir: &Path,
    binary_name: &str,
) -> Result<(), OpencodeError> {
    use std::process::Command;

    let status = Command::new("tar")
        .args([
            "-xzf",
            archive_path.to_str().unwrap(),
            "-C",
            dest_dir.to_str().unwrap(),
        ])
        .status()?;

    if !status.success() {
        return Err(OpencodeError::ExtractError(
            "tar extraction failed".to_string(),
        ));
    }

    for entry in std::fs::read_dir(dest_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() && path.file_name().map(|n| n == binary_name).unwrap_or(false) {
            return Ok(());
        }
        if path.is_dir() {
            let bin_in_subdir = path.join(binary_name);
            if bin_in_subdir.exists() {
                std::fs::rename(&bin_in_subdir, dest_dir.join(binary_name))?;
                let _ = std::fs::remove_dir_all(&path);
                return Ok(());
            }
        }
    }

    Err(OpencodeError::ExtractError(format!(
        "Binary '{}' not found after extraction",
        binary_name
    )))
}

#[cfg(windows)]
fn extract_tar_gz_sync(
    _archive_path: &Path,
    _dest_dir: &Path,
    _binary_name: &str,
) -> Result<(), OpencodeError> {
    Err(OpencodeError::ExtractError(
        "tar.gz extraction not supported on Windows".to_string(),
    ))
}

/// Downloader for opencode binary
pub struct OpencodeDownloader {
    client: reqwest::Client,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
}

impl OpencodeDownloader {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                // Use a proper User-Agent to avoid GitHub API rate limits
                .user_agent("axon-desktop/0.1.0 (https://github.com/zero/axon_desktop)")
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    /// Check if opencode binary exists
    pub fn is_installed(&self) -> bool {
        get_opencode_bin_path()
            .map(|p: PathBuf| p.exists())
            .unwrap_or(false)
    }

    pub fn get_binary_path(&self) -> Option<PathBuf> {
        let path = match get_opencode_bin_path() {
            Some(p) => p,
            None => {
                debug!("get_opencode_bin_path returned None");
                return None;
            }
        };
        
        if path.exists() {
            debug!("Binary exists at: {:?}", path);
            Some(path)
        } else {
            debug!("Binary not found at: {:?}", path);
            None
        }
    }

    /// Get binary path with optional custom path override
    pub fn get_binary_path_with_custom(&self, custom_path: Option<&str>) -> Option<PathBuf> {
        if let Some(path_str) = custom_path {
            if !path_str.is_empty() {
                let path = PathBuf::from(path_str);
                if path.exists() {
                    return Some(path);
                }
            }
        }
        self.get_binary_path()
    }

    pub fn get_installed_version(&self, custom_path: Option<&str>) -> Option<String> {
        let binary_path = match self.get_binary_path_with_custom(custom_path) {
            Some(p) => {
                debug!("Binary path found: {:?}", p);
                p
            }
            None => {
                debug!("Binary path not found, custom_path: {:?}", custom_path);
                return None;
            }
        };

        let output = match std::process::Command::new(&binary_path)
            .arg("--version")
            .output()
        {
            Ok(o) => o,
            Err(e) => {
                warn!("Failed to run opencode --version: {}", e);
                return None;
            }
        };

        if output.status.success() {
            let version_str = String::from_utf8_lossy(&output.stdout);
            let version = version_str
                .trim()
                .split_whitespace()
                .find(|s| {
                    let s = s.trim_start_matches('v');
                    s.split('.').take(3).all(|part| part.chars().all(|c| c.is_ascii_digit()))
                        && s.contains('.')
                })
                .map(|s| {
                    if s.starts_with('v') {
                        s.to_string()
                    } else {
                        format!("v{}", s)
                    }
                });
            
            debug!("Detected installed version: {:?}", version);
            version
        } else {
            warn!("opencode --version failed: {}", String::from_utf8_lossy(&output.stderr));
            None
        }
    }

    /// Fetch the latest release version from GitHub
    /// Falls back to a known version if rate-limited
    pub async fn fetch_latest_version(&self) -> Result<String, OpencodeError> {
        let url = get_latest_release_api_url();
        debug!("Fetching latest release from: {}", url);

        let response = match self.client.get(url).send().await {
            Ok(resp) => resp,
            Err(e) => {
                warn!("Failed to fetch latest version, using fallback: {}", e);
                return Ok(FALLBACK_VERSION.to_string());
            }
        };

        // Check for rate limiting or other errors
        if !response.status().is_success() {
            let status = response.status();
            if status.as_u16() == 403 || status.as_u16() == 429 {
                warn!(
                    "GitHub API rate limited ({}), using fallback version: {}",
                    status, FALLBACK_VERSION
                );
                return Ok(FALLBACK_VERSION.to_string());
            }
            return Err(OpencodeError::DownloadError(format!(
                "GitHub API returned status: {}",
                status
            )));
        }

        let release: GithubRelease = response.json().await.map_err(|e| {
            warn!("Failed to parse release info, using fallback: {}", e);
            OpencodeError::DownloadError(e.to_string())
        })?;

        info!("Latest opencode version: {}", release.tag_name);
        Ok(release.tag_name)
    }

    /// Download opencode binary with progress reporting
    pub async fn download(
        &self,
        version: Option<&str>,
        progress_tx: Option<mpsc::Sender<DownloadProgress>>,
    ) -> Result<PathBuf, OpencodeError> {
        // Get version (fetch latest if not specified)
        let version = match version {
            Some(v) => v.to_string(),
            None => self.fetch_latest_version().await?,
        };

        // Build download URL
        let url = build_download_url(&version)
            .ok_or_else(|| OpencodeError::DownloadError("Unsupported platform".to_string()))?;

        info!("Downloading opencode from: {}", url);

        // Create bin directory
        let bin_dir = get_bin_dir().ok_or_else(|| {
            OpencodeError::ConfigError("Cannot determine bin directory".to_string())
        })?;
        std::fs::create_dir_all(&bin_dir)?;

        // Download archive
        let archive_path = bin_dir.join(format!("opencode.{}", get_archive_extension()));
        self.download_file(&url, &archive_path, progress_tx).await?;

        // Extract binary in blocking task to avoid blocking async runtime
        let archive_path_clone = archive_path.clone();
        let bin_dir_clone = bin_dir.clone();
        let binary_path = tokio::task::spawn_blocking(move || {
            extract_binary_sync(&archive_path_clone, &bin_dir_clone)
        })
        .await
        .map_err(|e| OpencodeError::ExtractError(format!("Task join error: {}", e)))??;

        // Clean up archive
        if let Err(e) = std::fs::remove_file(&archive_path) {
            warn!("Failed to remove archive: {}", e);
        }

        // Set executable permission on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&binary_path)?.permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&binary_path, perms)?;
        }

        info!("OpenCode installed at: {:?}", binary_path);
        Ok(binary_path)
    }

    /// Download a file with progress reporting
    async fn download_file(
        &self,
        url: &str,
        dest: &Path,
        progress_tx: Option<mpsc::Sender<DownloadProgress>>,
    ) -> Result<(), OpencodeError> {
        let response = self
            .client
            .get(url)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| OpencodeError::DownloadError(e.to_string()))?;

        let total_size = response.content_length();
        let mut downloaded: u64 = 0;

        let mut file = std::fs::File::create(dest)?;
        let mut stream = response.bytes_stream();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| OpencodeError::DownloadError(e.to_string()))?;
            file.write_all(&chunk)?;

            downloaded += chunk.len() as u64;

            if let Some(ref tx) = progress_tx {
                let progress = DownloadProgress {
                    downloaded,
                    total: total_size,
                    percentage: total_size
                        .map(|t| (downloaded as f32 / t as f32) * 100.0)
                        .unwrap_or(0.0),
                };
                let _ = tx.send(progress).await;
            }
        }

        Ok(())
    }
}

impl Default for OpencodeDownloader {
    fn default() -> Self {
        Self::new()
    }
}
