//! 模型注册表模块
//!
//! 从 https://models.dev/api.json 获取模型信息，
//! 提供模型默认参数查询功能，用于编排页面的 Agent 配置。
//!
//! ## 功能
//!
//! - 首次启动时从磁盘加载缓存
//! - 后台静默刷新数据（每 6 小时检查一次）
//! - 使用 SHA256 哈希校验数据变化
//! - 提供模型默认参数查询接口
//!
//! ## 使用
//!
//! ```rust
//! // 初始化（启动时调用一次）
//! manager.initialize();
//!
//! // 获取模型默认参数
//! if let Some(defaults) = manager.get_model_defaults("anthropic/claude-sonnet-4-5") {
//!     println!("supports_reasoning: {}", defaults.supports_reasoning);
//!     println!("context_window: {}", defaults.context_window);
//! }
//!
//! // 后台刷新（定期调用）
//! manager.refresh_in_background().await;
//! ```

mod manager;
mod types;

pub use manager::ModelsRegistryManager;
pub use types::{
    CachedModelsRegistry, CostInfo, DefaultParams, LimitInfo, Modalities, ModelDefaults, ModelInfo,
    ModelsRegistryData, ProviderInfo,
};
