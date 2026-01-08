//! 工作区布局持久化命令
//!
//! 提供基于项目目录的布局持久化功能：
//! - 每个项目独立存储布局配置
//! - 包括面板宽度、打开的文件标签等
//! - 使用 JSON 文件存储在应用数据目录下

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tracing::debug;

use crate::utils::paths::get_app_data_dir;

/// 布局配置存储子目录
const LAYOUT_DIR: &str = "layouts";

/// 打开的文件标签信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenedTab {
    /// 文件路径
    pub path: String,
    /// 文件名
    pub name: String,
    /// 语言类型
    pub language: String,
}

/// 工作区布局配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceLayout {
    /// 项目目录（用于标识）
    pub project_directory: String,
    /// 侧边栏宽度（像素）
    pub sidebar_width: Option<f64>,
    /// 编辑器面板占比（百分比 0-100）
    pub editor_panel_ratio: Option<f64>,
    /// 打开的文件标签列表
    pub opened_tabs: Vec<OpenedTab>,
    /// 当前活动的文件路径
    pub active_tab_path: Option<String>,
    /// 编辑器面板是否可见
    pub editor_visible: bool,
    /// 最后更新时间（Unix 时间戳毫秒）
    pub updated_at: u64,
}

impl Default for WorkspaceLayout {
    fn default() -> Self {
        Self {
            project_directory: String::new(),
            sidebar_width: None,
            editor_panel_ratio: Some(50.0), // 默认均匀分割
            opened_tabs: Vec::new(),
            active_tab_path: None,
            editor_visible: false,
            updated_at: 0,
        }
    }
}

/// 获取布局存储目录
fn get_layout_dir() -> Result<PathBuf, String> {
    let app_dir = get_app_data_dir().ok_or("应用数据目录未初始化")?;
    let layout_dir = app_dir.join(LAYOUT_DIR);
    
    // 确保目录存在
    if !layout_dir.exists() {
        std::fs::create_dir_all(&layout_dir)
            .map_err(|e| format!("创建布局目录失败: {}", e))?;
    }
    
    Ok(layout_dir)
}

/// 根据项目目录生成布局文件名
/// 使用目录路径的哈希值作为文件名，避免路径中的特殊字符问题
fn get_layout_filename(project_directory: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    // 规范化路径进行哈希
    let normalized = project_directory
        .replace('\\', "/")
        .to_lowercase()
        .trim_end_matches('/')
        .to_string();
    normalized.hash(&mut hasher);
    
    format!("{:x}.json", hasher.finish())
}

/// 保存工作区布局
/// 将布局配置保存到项目特定的 JSON 文件中
#[tauri::command]
pub async fn save_workspace_layout(layout: WorkspaceLayout) -> Result<(), String> {
    debug!("保存工作区布局: {}", layout.project_directory);
    
    let layout_dir = get_layout_dir()?;
    let filename = get_layout_filename(&layout.project_directory);
    let file_path = layout_dir.join(&filename);
    
    // 更新时间戳
    let mut layout = layout;
    layout.updated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    
    // 序列化并保存
    let json = serde_json::to_string_pretty(&layout)
        .map_err(|e| format!("序列化布局失败: {}", e))?;
    
    std::fs::write(&file_path, json)
        .map_err(|e| format!("保存布局文件失败: {}", e))?;
    
    debug!("布局已保存到: {:?}", file_path);
    Ok(())
}

/// 加载工作区布局
/// 从项目特定的 JSON 文件中加载布局配置
#[tauri::command]
pub async fn load_workspace_layout(project_directory: String) -> Result<Option<WorkspaceLayout>, String> {
    debug!("加载工作区布局: {}", project_directory);
    
    let layout_dir = get_layout_dir()?;
    let filename = get_layout_filename(&project_directory);
    let file_path = layout_dir.join(&filename);
    
    if !file_path.exists() {
        debug!("布局文件不存在: {:?}", file_path);
        return Ok(None);
    }
    
    let json = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("读取布局文件失败: {}", e))?;
    
    let layout: WorkspaceLayout = serde_json::from_str(&json)
        .map_err(|e| format!("解析布局文件失败: {}", e))?;
    
    debug!("成功加载布局，打开的标签数: {}", layout.opened_tabs.len());
    Ok(Some(layout))
}

/// 删除工作区布局
/// 当项目被关闭或删除时，可以选择删除其布局配置
#[tauri::command]
pub async fn delete_workspace_layout(project_directory: String) -> Result<(), String> {
    debug!("删除工作区布局: {}", project_directory);
    
    let layout_dir = get_layout_dir()?;
    let filename = get_layout_filename(&project_directory);
    let file_path = layout_dir.join(&filename);
    
    if file_path.exists() {
        std::fs::remove_file(&file_path)
            .map_err(|e| format!("删除布局文件失败: {}", e))?;
        debug!("布局文件已删除: {:?}", file_path);
    }
    
    Ok(())
}

/// 列出所有已保存的布局
/// 返回所有已保存布局的项目目录列表
#[tauri::command]
pub async fn list_workspace_layouts() -> Result<Vec<WorkspaceLayout>, String> {
    debug!("列出所有工作区布局");
    
    let layout_dir = get_layout_dir()?;
    
    let mut layouts = Vec::new();
    
    for entry in std::fs::read_dir(&layout_dir)
        .map_err(|e| format!("读取布局目录失败: {}", e))?
    {
        let entry = entry.map_err(|e| format!("读取目录条目失败: {}", e))?;
        let path = entry.path();
        
        if path.extension().map(|e| e == "json").unwrap_or(false) {
            if let Ok(json) = std::fs::read_to_string(&path) {
                if let Ok(layout) = serde_json::from_str::<WorkspaceLayout>(&json) {
                    layouts.push(layout);
                }
            }
        }
    }
    
    // 按更新时间排序（最近的在前）
    layouts.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    
    debug!("找到 {} 个布局配置", layouts.len());
    Ok(layouts)
}
