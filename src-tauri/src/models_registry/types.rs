//! 模型注册表类型定义
//!
//! 定义从 https://models.dev/api.json 获取的模型信息数据结构

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 模型注册表 API 响应的根结构
/// 格式: { "provider-id": ProviderInfo, ... }
pub type ModelsRegistryData = HashMap<String, ProviderInfo>;

/// Provider 信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    /// Provider ID (如 "anthropic", "openai")
    pub id: String,
    /// 环境变量名称列表
    #[serde(default)]
    pub env: Vec<String>,
    /// npm 包名
    #[serde(default)]
    pub npm: Option<String>,
    /// API 端点
    #[serde(default)]
    pub api: Option<String>,
    /// Provider 显示名称
    pub name: String,
    /// 文档链接
    #[serde(default)]
    pub doc: Option<String>,
    /// 模型列表
    #[serde(default)]
    pub models: HashMap<String, ModelInfo>,
}

/// 模型详细信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    /// 模型 ID
    pub id: String,
    /// 模型显示名称
    pub name: String,
    /// 模型家族 (如 "claude", "gpt", "gemini")
    #[serde(default)]
    pub family: Option<String>,
    /// 是否支持附件 (图片、文件等)
    #[serde(default)]
    pub attachment: bool,
    /// 是否支持推理/思考模式
    #[serde(default)]
    pub reasoning: bool,
    /// 是否支持工具调用
    #[serde(default)]
    pub tool_call: bool,
    /// 是否支持结构化输出
    #[serde(default)]
    pub structured_output: bool,
    /// 是否支持温度参数
    #[serde(default = "default_true")]
    pub temperature: bool,
    /// 知识截止日期
    #[serde(default)]
    pub knowledge: Option<String>,
    /// 发布日期
    #[serde(default)]
    pub release_date: Option<String>,
    /// 最后更新日期
    #[serde(default)]
    pub last_updated: Option<String>,
    /// 输入/输出模态
    #[serde(default)]
    pub modalities: Option<Modalities>,
    /// 是否开源权重
    #[serde(default)]
    pub open_weights: bool,
    /// 成本信息 (每百万 token)
    #[serde(default)]
    pub cost: Option<CostInfo>,
    /// 限制信息 (上下文窗口、最大输出等)
    #[serde(default)]
    pub limit: Option<LimitInfo>,
    /// 默认参数配置
    #[serde(default)]
    pub default: Option<DefaultParams>,
}

fn default_true() -> bool {
    true
}

/// 模态信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Modalities {
    /// 输入模态 (如 ["text", "image", "audio"])
    #[serde(default)]
    pub input: Vec<String>,
    /// 输出模态 (如 ["text"])
    #[serde(default)]
    pub output: Vec<String>,
}

/// 成本信息 (每百万 token 的美元价格)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostInfo {
    /// 输入成本
    #[serde(default)]
    pub input: f64,
    /// 输出成本
    #[serde(default)]
    pub output: f64,
}

/// 限制信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LimitInfo {
    /// 上下文窗口大小 (tokens)
    #[serde(default)]
    pub context: u64,
    /// 最大输出 token 数
    #[serde(default)]
    pub output: u64,
}

/// 默认参数配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefaultParams {
    /// 默认温度
    #[serde(default)]
    pub temperature: Option<f64>,
    /// 默认 top_p
    #[serde(default)]
    pub top_p: Option<f64>,
    /// 默认最大 tokens
    #[serde(default)]
    pub max_tokens: Option<u64>,
}

/// 缓存的模型注册表数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedModelsRegistry {
    /// 数据内容的 SHA256 哈希
    pub hash: String,
    /// 缓存时间戳 (Unix 秒)
    pub timestamp: u64,
    /// 注册表数据
    pub data: ModelsRegistryData,
}

/// 用于前端的简化模型信息
/// 只包含配置 Agent 时需要的参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelDefaults {
    /// 完整模型 ID (provider/model 格式)
    pub model_id: String,
    /// 模型显示名称
    pub name: String,
    /// Provider ID
    pub provider_id: String,
    /// Provider 名称
    pub provider_name: String,
    /// 是否支持推理/思考
    pub supports_reasoning: bool,
    /// 是否支持工具调用
    pub supports_tool_call: bool,
    /// 是否支持结构化输出
    pub supports_structured_output: bool,
    /// 是否支持温度参数
    pub supports_temperature: bool,
    /// 是否支持附件
    pub supports_attachment: bool,
    /// 上下文窗口大小
    pub context_window: u64,
    /// 最大输出 tokens
    pub max_output_tokens: u64,
    /// 推荐的默认温度
    pub default_temperature: Option<f64>,
    /// 推荐的默认 top_p
    pub default_top_p: Option<f64>,
    /// 推荐的默认 max_tokens
    pub default_max_tokens: Option<u64>,
    /// 输入成本 (每百万 token)
    pub cost_input: f64,
    /// 输出成本 (每百万 token)
    pub cost_output: f64,
}

impl ModelDefaults {
    /// 从 ProviderInfo 和 ModelInfo 构建 ModelDefaults
    pub fn from_model_info(provider: &ProviderInfo, model: &ModelInfo) -> Self {
        let limit = model.limit.as_ref();
        let cost = model.cost.as_ref();
        let default = model.default.as_ref();

        Self {
            model_id: format!("{}/{}", provider.id, model.id),
            name: model.name.clone(),
            provider_id: provider.id.clone(),
            provider_name: provider.name.clone(),
            supports_reasoning: model.reasoning,
            supports_tool_call: model.tool_call,
            supports_structured_output: model.structured_output,
            supports_temperature: model.temperature,
            supports_attachment: model.attachment,
            context_window: limit.map(|l| l.context).unwrap_or(0),
            max_output_tokens: limit.map(|l| l.output).unwrap_or(0),
            default_temperature: default.and_then(|d| d.temperature),
            default_top_p: default.and_then(|d| d.top_p),
            default_max_tokens: default.and_then(|d| d.max_tokens),
            cost_input: cost.map(|c| c.input).unwrap_or(0.0),
            cost_output: cost.map(|c| c.output).unwrap_or(0.0),
        }
    }
}
