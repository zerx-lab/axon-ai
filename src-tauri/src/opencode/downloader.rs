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
const FALLBACK_VERSION: &str = "v1.1.4";

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

    /// Get installed binary path
    pub fn get_binary_path(&self) -> Option<PathBuf> {
        let path = get_opencode_bin_path()?;
        if path.exists() {
            Some(path)
        } else {
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

        let release: GithubRelease = response
            .json()
            .await
            .map_err(|e| {
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
        let bin_dir = get_bin_dir()
            .ok_or_else(|| OpencodeError::ConfigError("Cannot determine bin directory".to_string()))?;
        std::fs::create_dir_all(&bin_dir)?;

        // Download archive
        let archive_path = bin_dir.join(format!("opencode.{}", get_archive_extension()));
        self.download_file(&url, &archive_path, progress_tx).await?;

        // Extract binary
        let binary_path = self.extract_binary(&archive_path, &bin_dir)?;

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

    /// Extract binary from archive
    fn extract_binary(&self, archive_path: &Path, dest_dir: &Path) -> Result<PathBuf, OpencodeError> {
        let binary_name = get_binary_name();
        let binary_path = dest_dir.join(binary_name);

        if cfg!(windows) {
            self.extract_zip(archive_path, dest_dir, binary_name)?;
        } else {
            self.extract_tar_gz(archive_path, dest_dir, binary_name)?;
        }

        if !binary_path.exists() {
            return Err(OpencodeError::ExtractError(
                "Binary not found in archive".to_string(),
            ));
        }

        Ok(binary_path)
    }

    /// Extract from zip archive (Windows)
    fn extract_zip(
        &self,
        archive_path: &Path,
        dest_dir: &Path,
        binary_name: &str,
    ) -> Result<(), OpencodeError> {
        let file = std::fs::File::open(archive_path)?;
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| OpencodeError::ExtractError(e.to_string()))?;

        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| OpencodeError::ExtractError(e.to_string()))?;

            let file_name = file.name().to_string();
            if file_name.ends_with(binary_name) {
                let dest_path = dest_dir.join(binary_name);
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

    /// Extract from tar.gz archive (Unix)
    #[cfg(not(windows))]
    fn extract_tar_gz(
        &self,
        archive_path: &Path,
        dest_dir: &Path,
        binary_name: &str,
    ) -> Result<(), OpencodeError> {
        use std::process::Command;

        let status = Command::new("tar")
            .args(["-xzf", archive_path.to_str().unwrap(), "-C", dest_dir.to_str().unwrap()])
            .status()?;

        if !status.success() {
            return Err(OpencodeError::ExtractError("tar extraction failed".to_string()));
        }

        // Find and move the binary to the expected location
        for entry in std::fs::read_dir(dest_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_file() && path.file_name().map(|n| n == binary_name).unwrap_or(false) {
                return Ok(());
            }
            // Check in subdirectories
            if path.is_dir() {
                let bin_in_subdir = path.join(binary_name);
                if bin_in_subdir.exists() {
                    std::fs::rename(&bin_in_subdir, dest_dir.join(binary_name))?;
                    // Clean up extracted directory
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
    fn extract_tar_gz(
        &self,
        _archive_path: &Path,
        _dest_dir: &Path,
        _binary_name: &str,
    ) -> Result<(), OpencodeError> {
        // Windows uses zip, this should never be called
        Err(OpencodeError::ExtractError(
            "tar.gz extraction not supported on Windows".to_string(),
        ))
    }
}

impl Default for OpencodeDownloader {
    fn default() -> Self {
        Self::new()
    }
}
