//! 模型注册表管理器
//!
//! 负责下载、缓存、哈希校验 models.dev/api.json

use crate::models_registry::types::{
    CachedModelsRegistry, ModelDefaults, ModelsRegistryData, ProviderInfo,
};
use crate::utils::paths::get_app_data_dir;
use parking_lot::RwLock;
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{debug, error, info, warn};

/// 模型注册表 API URL
const MODELS_REGISTRY_URL: &str = "https://models.dev/api.json";

/// 缓存文件名
const CACHE_FILE: &str = "models_registry.json";

/// 缓存有效期：24 小时
const CACHE_TTL_SECS: u64 = 24 * 60 * 60;

/// 后台刷新间隔：6 小时
const BACKGROUND_REFRESH_INTERVAL_SECS: u64 = 6 * 60 * 60;

/// 模型注册表管理器
pub struct ModelsRegistryManager {
    /// 缓存的注册表数据
    cache: RwLock<Option<CachedModelsRegistry>>,
    /// HTTP 客户端
    client: reqwest::Client,
    /// 上次后台刷新时间
    last_background_refresh: RwLock<u64>,
}

impl ModelsRegistryManager {
    /// 创建新的管理器实例
    pub fn new() -> Arc<Self> {
        let client = reqwest::Client::builder()
            .user_agent("axon-desktop/0.1.0 (https://github.com/zero/axon_desktop)")
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("创建 HTTP 客户端失败");

        Arc::new(Self {
            cache: RwLock::new(None),
            client,
            last_background_refresh: RwLock::new(0),
        })
    }

    /// 获取缓存文件路径
    fn get_cache_path() -> Option<PathBuf> {
        get_app_data_dir().map(|p| p.join(CACHE_FILE))
    }

    /// 计算数据的 SHA256 哈希
    fn compute_hash(data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        format!("{:x}", hasher.finalize())
    }

    /// 获取当前时间戳
    fn now() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    }

    /// 检查缓存是否过期
    fn is_cache_expired(timestamp: u64) -> bool {
        Self::now().saturating_sub(timestamp) > CACHE_TTL_SECS
    }

    /// 检查是否需要后台刷新
    fn should_background_refresh(&self) -> bool {
        let last_refresh = *self.last_background_refresh.read();
        Self::now().saturating_sub(last_refresh) > BACKGROUND_REFRESH_INTERVAL_SECS
    }

    /// 从磁盘加载缓存
    fn load_from_disk(&self) -> Option<CachedModelsRegistry> {
        let path = Self::get_cache_path()?;
        if !path.exists() {
            debug!("缓存文件不存在: {:?}", path);
            return None;
        }

        match std::fs::read_to_string(&path) {
            Ok(content) => match serde_json::from_str::<CachedModelsRegistry>(&content) {
                Ok(cached) => {
                    debug!(
                        "从磁盘加载缓存成功, hash={}, timestamp={}",
                        cached.hash, cached.timestamp
                    );
                    Some(cached)
                }
                Err(e) => {
                    warn!("解析缓存文件失败: {}", e);
                    None
                }
            },
            Err(e) => {
                warn!("读取缓存文件失败: {}", e);
                None
            }
        }
    }

    /// 保存缓存到磁盘
    fn save_to_disk(&self, cached: &CachedModelsRegistry) -> Result<(), String> {
        let path = Self::get_cache_path().ok_or("无法获取缓存路径")?;

        // 确保目录存在
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("创建缓存目录失败: {}", e))?;
            }
        }

        let content =
            serde_json::to_string_pretty(cached).map_err(|e| format!("序列化缓存失败: {}", e))?;

        std::fs::write(&path, content).map_err(|e| format!("写入缓存文件失败: {}", e))?;

        debug!("缓存已保存到: {:?}", path);
        Ok(())
    }

    /// 初始化：加载缓存（首次启动时调用）
    pub fn initialize(&self) {
        // 首先尝试从磁盘加载缓存
        if let Some(cached) = self.load_from_disk() {
            *self.cache.write() = Some(cached);
            info!("模型注册表缓存已加载");
        } else {
            info!("模型注册表缓存不存在，将在后台下载");
        }
    }

    /// 从远程获取注册表数据
    async fn fetch_remote(&self) -> Result<(String, ModelsRegistryData), String> {
        debug!("正在从 {} 获取模型注册表...", MODELS_REGISTRY_URL);

        let response = self
            .client
            .get(MODELS_REGISTRY_URL)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP 错误: {}", response.status()));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("读取响应失败: {}", e))?;

        let hash = Self::compute_hash(&bytes);

        let data: ModelsRegistryData = serde_json::from_slice(&bytes)
            .map_err(|e| format!("解析 JSON 失败: {}", e))?;

        info!(
            "成功获取模型注册表, 包含 {} 个 provider, hash={}",
            data.len(),
            &hash[..16]
        );

        Ok((hash, data))
    }

    /// 后台刷新缓存（静默更新）
    pub async fn refresh_in_background(self: &Arc<Self>) {
        // 检查是否需要刷新
        if !self.should_background_refresh() {
            debug!("后台刷新间隔未到，跳过");
            return;
        }

        // 更新刷新时间
        *self.last_background_refresh.write() = Self::now();

        // 获取当前缓存的哈希
        let current_hash = self
            .cache
            .read()
            .as_ref()
            .map(|c| c.hash.clone())
            .unwrap_or_default();

        // 克隆 self 用于 async 移动
        let manager = Arc::clone(self);

        // 在后台执行刷新
        tokio::spawn(async move {
            match manager.fetch_remote().await {
                Ok((new_hash, data)) => {
                    // 检查哈希是否变化
                    if new_hash == current_hash {
                        debug!("模型注册表未变化，跳过更新");
                        return;
                    }

                    info!("模型注册表已更新 (hash: {} -> {})", &current_hash[..8.min(current_hash.len())], &new_hash[..8]);

                    let cached = CachedModelsRegistry {
                        hash: new_hash,
                        timestamp: Self::now(),
                        data,
                    };

                    // 更新内存缓存
                    *manager.cache.write() = Some(cached.clone());

                    // 保存到磁盘
                    if let Err(e) = manager.save_to_disk(&cached) {
                        error!("保存模型注册表缓存失败: {}", e);
                    }
                }
                Err(e) => {
                    warn!("后台刷新模型注册表失败: {}", e);
                }
            }
        });
    }

    /// 强制刷新（用户手动触发）
    pub async fn force_refresh(&self) -> Result<(), String> {
        let (hash, data) = self.fetch_remote().await?;

        let cached = CachedModelsRegistry {
            hash,
            timestamp: Self::now(),
            data,
        };

        // 更新内存缓存
        *self.cache.write() = Some(cached.clone());

        // 保存到磁盘
        self.save_to_disk(&cached)?;

        Ok(())
    }

    /// 获取缓存的注册表数据
    #[allow(dead_code)]
    pub fn get_registry(&self) -> Option<ModelsRegistryData> {
        self.cache.read().as_ref().map(|c| c.data.clone())
    }

    /// 获取缓存信息（用于调试）
    pub fn get_cache_info(&self) -> Option<(String, u64, bool)> {
        self.cache.read().as_ref().map(|c| {
            (
                c.hash.clone(),
                c.timestamp,
                Self::is_cache_expired(c.timestamp),
            )
        })
    }

    /// 获取指定模型的默认参数
    pub fn get_model_defaults(&self, model_id: &str) -> Option<ModelDefaults> {
        let cache = self.cache.read();
        let registry = cache.as_ref()?.data.clone();
        drop(cache);

        // 解析 model_id: "provider/model" 格式
        let parts: Vec<&str> = model_id.splitn(2, '/').collect();
        if parts.len() != 2 {
            warn!("无效的模型 ID 格式: {}", model_id);
            return None;
        }

        let provider_id = parts[0];
        let model_id_only = parts[1];

        // 查找 provider
        let provider = registry.get(provider_id)?;

        // 查找模型
        let model = provider.models.get(model_id_only)?;

        Some(ModelDefaults::from_model_info(provider, model))
    }

    /// 获取所有模型的默认参数列表
    pub fn get_all_model_defaults(&self) -> Vec<ModelDefaults> {
        let cache = self.cache.read();
        let Some(cached) = cache.as_ref() else {
            return Vec::new();
        };

        let mut defaults = Vec::new();

        for provider in cached.data.values() {
            for model in provider.models.values() {
                defaults.push(ModelDefaults::from_model_info(provider, model));
            }
        }

        defaults
    }

    /// 搜索模型
    pub fn search_models(&self, query: &str) -> Vec<ModelDefaults> {
        let query_lower = query.to_lowercase();

        self.get_all_model_defaults()
            .into_iter()
            .filter(|m| {
                m.model_id.to_lowercase().contains(&query_lower)
                    || m.name.to_lowercase().contains(&query_lower)
                    || m.provider_name.to_lowercase().contains(&query_lower)
            })
            .collect()
    }

    /// 按 provider 获取模型列表
    #[allow(dead_code)]
    pub fn get_models_by_provider(&self, provider_id: &str) -> Vec<ModelDefaults> {
        let cache = self.cache.read();
        let Some(cached) = cache.as_ref() else {
            return Vec::new();
        };

        let Some(provider) = cached.data.get(provider_id) else {
            return Vec::new();
        };

        provider
            .models
            .values()
            .map(|m| ModelDefaults::from_model_info(provider, m))
            .collect()
    }

    /// 获取所有 provider 列表
    #[allow(dead_code)]
    pub fn get_providers(&self) -> Vec<ProviderInfo> {
        let cache = self.cache.read();
        cache
            .as_ref()
            .map(|c| c.data.values().cloned().collect())
            .unwrap_or_default()
    }
}

impl Default for ModelsRegistryManager {
    fn default() -> Self {
        Self {
            cache: RwLock::new(None),
            client: reqwest::Client::new(),
            last_background_refresh: RwLock::new(0),
        }
    }
}
