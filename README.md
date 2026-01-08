<p align="center">
  <img src="public/icon.svg" alt="Axon" width="80" height="80">
</p>

<h1 align="center">Axon</h1>

<p align="center">
  跨平台 AI 编程助手
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

Axon 是一个桌面端 AI 编程助手，使用 Tauri 2 + React 19 构建，支持 Windows、macOS、Linux。

通过对话的方式完成代码编写、文件编辑、命令执行等开发任务。

---

## 功能

### AI 能力

- **代码生成** - 根据描述生成代码，支持多种编程语言
- **代码编辑** - 修改现有代码，自动生成 Diff
- **代码解释** - 分析代码逻辑，回答技术问题
- **命令执行** - 运行 shell 命令，查看输出结果
- **文件操作** - 读取、创建、修改项目文件
- **上下文理解** - 自动读取相关文件，理解项目结构

### 模型支持

- Claude (Anthropic)
- GPT-4 / GPT-4o (OpenAI)
- Gemini (Google)
- 本地模型 (Ollama)

### 客户端功能

- **会话管理** - 多会话并行，历史记录持久化
- **代码预览** - 文件浏览器，语法高亮
- **Diff 可视化** - unified/split 视图，查看代码变更
- **任务追踪** - 实时显示执行步骤和进度
- **权限确认** - 敏感操作（写文件、执行命令）需用户确认
- **布局记忆** - 自动保存窗口布局和打开的文件
- **主题** - 深色/浅色，跟随系统
- **多语言** - 中文/英文

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
│  │  TailwindCSS   │  │  │  - Diff 计算               │  │
│  └────────────────┘  │  │  - 进程管理                │  │
│          │           │  └────────────────────────────┘  │
│          │ SSE       │               │                  │
│          ▼           │               ▼                  │
│  ┌────────────────────────────────────────────────────┐ │
│  │                   AI Service                        │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 前端依赖

| 依赖 | 用途 |
|------|------|
| React 19 | UI 渲染 |
| TanStack Router | 路由 |
| TanStack Query | 数据请求与缓存 |
| Zustand | 状态管理 |
| TailwindCSS 4 | 样式 |
| Radix UI | 无障碍组件 |

### 后端依赖

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
│   ├── services/                # API 服务封装
│   ├── stores/                  # Zustand Stores
│   └── routes/                  # 页面
├── src-tauri/                   # Rust 后端
│   └── src/
│       ├── commands/            # Tauri Commands
│       └── utils/               # 工具函数
└── public/                      # 静态资源
```

---

## 开发

### 环境要求

- Node.js 18+ 或 [Bun](https://bun.sh)
- Rust 1.70+
- 系统依赖见 [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

### 构建

```bash
# 安装依赖
bun install

# 构建前端
bun run build

# 构建应用
bun run tauri build
```

### Rust

```bash
cd src-tauri

cargo check      # 类型检查
cargo test       # 测试
cargo fmt        # 格式化
cargo clippy     # Lint
```

---

## 许可证

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)

- 允许分享和修改
- 需要署名
- 禁止商业使用
- 修改后需使用相同许可证
