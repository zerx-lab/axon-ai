<p align="center">
  <img src="public/icon.svg" alt="Axon" width="80" height="80">
</p>

<h1 align="center">Axon</h1>

<p align="center">
  基于 OpenCode 的跨平台 AI 编程客户端
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tauri-2.0-FFC131?style=flat-square&logo=tauri" alt="Tauri">
  <img src="https://img.shields.io/badge/Rust-2021-000000?style=flat-square&logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey?style=flat-square" alt="License">
</p>

---

## 简介

Axon 是 [OpenCode](https://github.com/opencode-ai/opencode) 的桌面客户端，使用 Tauri 2 + React 19 构建。

相比命令行工具，Axon 提供了可视化的会话管理、代码预览、Diff 对比等功能，适合需要图形界面的开发场景。

---

## 功能

- **会话管理** - 多会话切换，历史记录持久化
- **代码预览** - 文件浏览，语法高亮
- **Diff 可视化** - unified/split 视图，Rust 后端计算
- **任务追踪** - 实时显示 AI 执行的操作步骤
- **权限确认** - 文件写入、命令执行等操作需用户确认
- **主题切换** - 深色/浅色主题，跟随系统
- **多语言** - 中文/英文界面

---

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                         Axon                             │
├──────────────────────┬──────────────────────────────────┤
│      Frontend        │            Backend               │
│  ┌────────────────┐  │  ┌────────────────────────────┐  │
│  │  React 19      │  │  │  Tauri 2 (Rust)            │  │
│  │  TanStack      │◄─┼─►│  - 窗口管理                │  │
│  │  Zustand       │  │  │  - 文件系统                │  │
│  │  TailwindCSS   │  │  │  - Diff 计算 (similar)     │  │
│  └────────────────┘  │  │  - 进程管理                │  │
│          │           │  └────────────────────────────┘  │
│          │           │               │                  │
│          └───────────┼───── SSE ─────┘                  │
│                      │                                  │
│              ┌───────┴───────┐                          │
│              │  OpenCode     │                          │
│              │  (子进程)      │                          │
│              └───────────────┘                          │
└─────────────────────────────────────────────────────────┘
```

### 前端

| 依赖 | 用途 |
|------|------|
| React 19 | UI 渲染 |
| TanStack Router | 路由 |
| TanStack Query | 数据请求与缓存 |
| Zustand | 状态管理 |
| TailwindCSS 4 | 样式 |
| Radix UI | 无障碍组件 |
| @opencode-ai/sdk | OpenCode API 客户端 |

### 后端

| 依赖 | 用途 |
|------|------|
| Tauri 2 | 桌面应用框架 |
| Tokio | 异步运行时 |
| similar | Diff 算法 |
| reqwest | HTTP 客户端 |

---

## 项目结构

```
axon/
├── src/                         # 前端代码
│   ├── components/
│   │   ├── chat/                # 会话组件
│   │   │   └── parts/           # 消息渲染器
│   │   ├── diff/                # Diff 可视化
│   │   ├── editor/              # 代码预览
│   │   ├── sidebar/             # 侧边栏
│   │   └── ui/                  # 基础组件
│   ├── providers/               # Context Providers
│   ├── services/opencode/       # OpenCode 服务封装
│   ├── stores/                  # Zustand Stores
│   └── routes/                  # 页面
├── src-tauri/                   # Rust 后端
│   └── src/
│       ├── commands/            # Tauri Commands
│       ├── opencode/            # OpenCode 进程管理
│       └── utils/               # 工具函数
└── public/                      # 静态资源
```

---

## 开发

### 环境要求

- Node.js 18+ 或 [Bun](https://bun.sh)
- Rust 1.70+
- 系统依赖见 [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

### 安装与构建

```bash
# 安装依赖
bun install

# 构建前端
bun run build

# 构建完整应用
bun run tauri build
```

### Rust 开发

```bash
cd src-tauri

cargo check      # 类型检查
cargo test       # 运行测试
cargo fmt        # 格式化
cargo clippy     # Lint
```

---

## OpenCode 集成

Axon 通过 `@opencode-ai/sdk` 与 OpenCode 服务通信：

1. 应用启动时自动下载 OpenCode 二进制文件（如不存在）
2. 启动 `opencode serve` 子进程
3. 前端通过 HTTP + SSE 与服务交互

支持的模型取决于 OpenCode 配置（Claude、GPT-4、Gemini、Ollama 等）。

---

## 许可证

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)

- 允许分享和修改
- 需要署名
- 禁止商业使用
- 修改后需使用相同许可证

---

## 相关项目

- [OpenCode](https://github.com/opencode-ai/opencode) - AI 编程 CLI
- [Tauri](https://tauri.app) - 桌面应用框架
