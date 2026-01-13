# AGENTS.md - Rust/Tauri 后端规范

**Generated:** 2026-01-13 | **Commit:** 9576b45

## 概述

Tauri 2 后端，负责窗口管理、OpenCode 二进制生命周期、文件系统操作、Diff 计算。

---

## 目录结构

```
src-tauri/src/
├── main.rs              # 入口，调用 lib::run()
├── lib.rs               # 核心：Tauri 配置、Command 注册、窗口管理
├── commands/            # Tauri Commands
│   ├── mod.rs           # 模块导出
│   ├── opencode.rs      # OpenCode 服务控制
│   ├── filesystem.rs    # 文件读写
│   ├── diff.rs          # Diff 计算
│   ├── settings.rs      # 配置管理
│   ├── layout.rs        # 布局持久化
│   └── window.rs        # 窗口控制
├── opencode/            # OpenCode 二进制管理
│   ├── mod.rs           # 模块导出
│   ├── service.rs       # 进程生命周期
│   ├── downloader.rs    # 自动下载
│   ├── platform.rs      # 平台检测
│   └── types.rs         # 类型定义
├── settings/            # 配置存储
├── state/               # 全局状态
└── utils/               # 工具函数
```

---

## Commands

### 添加新 Command

1. 在 `commands/` 下创建或编辑文件
2. 在 `commands/mod.rs` 中导出
3. 在 `lib.rs` 的 `generate_handler![]` 中注册

```rust
// commands/example.rs
#[tauri::command]
pub async fn my_command(param: String) -> Result<String, String> {
    Ok(format!("处理: {}", param))
}

// commands/mod.rs
pub mod example;
pub use example::*;

// lib.rs
.invoke_handler(tauri::generate_handler![
    commands::my_command,
    // ... 其他
])
```

---

## 代码规范

### 命名
- 函数: `snake_case`
- 类型/结构体: `PascalCase`
- 常量: `UPPER_SNAKE_CASE`

### 错误处理
- 返回 `Result<T, String>` (前端友好)
- 使用 `?` 操作符传播
- 错误信息需有意义

### 异步
- IO 操作使用 `async`
- 长时间任务使用 `tokio::spawn`

---

## 关键实现

### 窗口管理

```rust
// lib.rs - 窗口初始隐藏，等待前端就绪
.visible(false)  // 初始隐藏

// 监听 app-ready 事件
app.listen("app-ready", move |_| {
    window.show().unwrap();
});

// 3秒超时保护
tokio::spawn(async move {
    tokio::time::sleep(Duration::from_secs(3)).await;
    if !shown { window.show().unwrap(); }
});
```

### OpenCode 生命周期

| 阶段 | 文件 | 说明 |
|------|------|------|
| 检测 | `platform.rs` | 确定 OS、架构 |
| 下载 | `downloader.rs` | 从 GitHub 获取二进制 |
| 启动 | `service.rs` | `opencode serve` 子进程 |
| 监控 | `service.rs` | 状态查询、重启逻辑 |

---

## 验证

```bash
cargo check              # 快速类型检查
cargo clippy             # Lint
cargo test               # 测试
cargo fmt                # 格式化
```

---

## 禁止事项

- ❌ 使用 `unwrap()` 处理可能失败的操作
- ❌ 阻塞主线程（使用 async）
- ❌ 直接编辑 `Cargo.toml`（使用 `cargo add`）
- ❌ 删除 `main.rs` 中的 `windows_subsystem = "windows"` 注释

---

## 注意事项

- Windows Release: `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` 必须保留
- 所有 Command 需在 `lib.rs` 统一注册
- State 使用 `tauri::State<T>` 注入
