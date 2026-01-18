# AGENTS.md - AI Coding Agent Guidelines for axon_desktop

**Generated:** 2026-01-13 | **Commit:** 9576b45 | **Branch:** master

## 语言规范 (Language Requirements)

**必须遵守**:
- 所有回复必须使用**中文**
- 所有代码注释必须使用**中文**
- 变量名、函数名等标识符保持英文
- Git commit message 可使用中文或英文

---

## Project Overview

**axon_desktop** - 跨平台 AI 编程助手桌面应用，集成 OpenCode 服务。

| 层 | 技术栈 |
|---|--------|
| Frontend | React 19, TypeScript 5.8, Vite 7, TailwindCSS 4 |
| Backend | Rust, Tauri 2, Tokio |
| State | Zustand, TanStack Query |
| Router | TanStack Router |
| Package | Bun |

---

## 项目结构

```
axon_desktop/
├── src/                      # 前端 React
│   ├── components/
│   │   ├── chat/             # 聊天核心（ChatInputCard, ChatMessage）
│   │   ├── settings/         # 设置页（Provider, MCP, Permission）
│   │   ├── ui/               # shadcn/ui 基础组件
│   │   ├── diff/             # Diff 可视化
│   │   ├── editor/           # Monaco 代码预览
│   │   └── titlebar/         # 窗口标题栏
│   ├── stores/               # Zustand 状态
│   │   └── chat/             # 聊天组合式 Store
│   ├── services/
│   │   └── opencode/         # OpenCode SDK 封装
│   ├── providers/            # Context Providers
│   ├── routes/               # TanStack Router 页面
│   ├── hooks/                # 自定义 Hooks
│   └── i18n/                 # 国际化
├── src-tauri/                # 后端 Rust（详见 src-tauri/AGENTS.md）
│   ├── src/
│   │   ├── commands/         # Tauri Commands
│   │   ├── opencode/         # 二进制管理
│   │   ├── settings/         # 配置管理
│   │   └── state/            # 全局状态
│   └── Cargo.toml
├── github/                   # 第三方参考项目
│   └── opencode/             # OpenCode 参考源码
└── public/                   # 静态资源
```

---

## WHERE TO LOOK

| 任务 | 位置 | 说明 |
|------|------|------|
| 添加 Tauri Command | `src-tauri/src/commands/` | 在 `mod.rs` 注册，`lib.rs` 导出 |
| 新增页面 | `src/routes/` | TanStack Router 文件路由 |
| 添加 UI 组件 | `src/components/ui/` | 基于 shadcn/ui |
| 修改聊天逻辑 | `src/stores/chat/` | 组合式 Hooks 模式 |
| OpenCode 集成 | `src/services/opencode/` | SDK 封装层 |
| 后端业务 | `src-tauri/src/opencode/` | 二进制下载、进程管理 |

---

## Commands

### Frontend (Bun)
```bash
bun install              # 安装依赖
bun run build            # TypeScript 检查 + Vite 构建（验证用）
bun run preview          # 预览生产构建
```

### Tauri
```bash
bun run tauri build      # 构建生产应用
```

### Rust/Backend (在 src-tauri/ 目录)
```bash
cargo check              # 检查错误
cargo build              # 构建后端
cargo test               # 运行测试
cargo fmt                # 格式化
cargo clippy             # Lint
```

**重要**: 禁止运行 `bun run dev` 或 `bun run tauri dev`，使用 `bun run build` 验证。

---

## 依赖管理 (CRITICAL)

**禁止直接编辑** `package.json`, `Cargo.toml`, `bun.lock`, `Cargo.lock`。

```bash
# Frontend
bun add <package>           # 添加生产依赖
bun add -d <package>        # 添加开发依赖

# Backend (在 src-tauri/)
cargo add <crate>           # 添加依赖
cargo add <crate> -F feat   # 添加带 feature
```

---

## 代码规范

### TypeScript / React

**Import 顺序**: React → 第三方 (@tauri-apps) → 本地模块 → CSS

**命名**:
- 组件: `PascalCase` (文件名同)
- 函数/变量: `camelCase`
- 常量: `UPPER_SNAKE_CASE`

**TypeScript**: strict 模式，禁止 `any`，显式返回类型。

### Zustand 状态管理

**模式 A - 简单 UI 状态**:
```typescript
// src/stores/theme.ts
interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}
export const useThemeStore = create<ThemeState>((set) => ({...}));
```

**模式 B - 复杂业务（如 Chat）**:
- 拆分为多个 Hooks (`useSessions`, `useMessages`, `useSSEHandler`)
- 在 `index.ts` 中组合导出
- 适用于 SSE 流式数据、SDK 集成

**持久化**: 使用 `persist` 中间件，key 以 `axon-` 为前缀。

### Rust / Tauri

详见 `src-tauri/AGENTS.md`。

---

## UI 设计系统 (Zed 风格极简主义)

### 核心哲学

1. **极简主义** - 只保留必要元素，留白优先
2. **优雅克制** - 微妙视觉反馈，动画 150-300ms
3. **一致性** - 统一圆角、间距、交互

### 视觉规范

| 属性 | 值 |
|------|-----|
| 圆角 | 1-4px (`rounded-sm` 到 `rounded-xl`) |
| 间距基准 | 4px |
| 边框 | `border-border/60` (低透明度) |
| 默认文字 | `text-muted-foreground/70` |
| 悬浮背景 | `bg-accent` |
| 动画时长 | 150ms (快), 200ms (标准), 300ms (强调) |
| 缓动函数 | `ease-out` |

### 组件规范

| 组件 | 规范 |
|------|------|
| Activity Bar | 宽 40px，图标 18px，激活指示器 2px 主题色竖线 |
| Dialog | 水平居中，垂直距顶 15%，从上滑入动画 |
| Sidebar | `bg-sidebar`，边框 `/50` 透明度 |
| Button ghost | 无背景，hover `bg-accent` |

### 禁止事项

- ❌ 渐变背景
- ❌ 大圆角 (>8px)
- ❌ 缩放/弹跳动画
- ❌ Dialog 垂直居中
- ❌ 过长动画 (>300ms)
- ❌ 多重阴影叠加

### 代码示例

```tsx
// ✅ 正确
<button className={cn(
  "flex items-center justify-center w-9 h-9",
  "text-muted-foreground/70 hover:text-foreground",
  "hover:bg-accent transition-colors duration-150",
  isActive && "text-foreground"
)}>
  <Icon className="w-[18px] h-[18px]" />
</button>

// ❌ 错误
<button className="bg-gradient-to-r rounded-xl shadow-2xl hover:scale-105">
```

---

## 前后端通信

```typescript
// 前端调用
import { invoke } from "@tauri-apps/api/core";
const result = await invoke("command_name", { param: value });
```

```rust
// 后端定义
#[tauri::command]
fn command_name(param: &str) -> Result<String, String> {
    Ok(format!("Result: {}", param))
}

// 注册 (lib.rs)
.invoke_handler(tauri::generate_handler![command_name])
```

---

## 架构关键点

### OpenCode 集成

- **后端**: `src-tauri/src/opencode/` 管理二进制下载、校验、进程生命周期
- **前端**: `src/services/opencode/` 通过 `@opencode-ai/sdk` 通信
- **启动流程**: 后端启动 `opencode serve` → 前端 OpencodeProvider 等待就绪 → 发送 `app-ready` 事件

### 窗口管理

- 初始隐藏 (`visible: false`)
- 前端就绪后发送 `app-ready` 事件
- 后端监听事件显示窗口（3秒超时保护）

### 复杂度热点

| 文件 | 行数 | 原因 |
|------|------|------|
| `McpSettings.tsx` | 1111 | 多模态框、复杂表单 |
| `PermissionSettings.tsx` | 848 | 权限 UI 逻辑 |
| `ProviderSettings.tsx` | 743 | 多 LLM 后端配置 |
| `opencode/service.ts` | 663 | SDK 封装 |
| `ChatInputCard.tsx` | 598 | 附件、命令补全 |

---

## 反模式 (Anti-Patterns)

| 禁止 | 原因 |
|------|------|
| 手动编辑 lock 文件 | 使用包管理器命令 |
| `as any`, `@ts-ignore` | 类型安全 |
| 空 catch 块 `catch(e) {}` | 必须处理错误 |
| 未授权 commit | 显式请求才 commit |
| `bun run dev` 验证 | 使用 `bun run build` |

---

## OpenCode 插件开发

OpenCode 支持通过插件扩展功能。插件可以钩入各种事件，自定义行为、添加新功能或集成外部服务。

### 使用插件

#### 本地文件方式

将 JavaScript 或 TypeScript 文件放入插件目录：

- `.opencode/plugin/` - 项目级插件
- `~/.config/opencode/plugin/` - 全局插件

目录中的文件在启动时自动加载。

#### npm 包方式

在配置文件中指定 npm 包：

```json
// opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-helicone-session", "opencode-wakatime", "@my-org/custom-plugin"]
}
```

### 创建插件

#### 基本结构

```javascript
// .opencode/plugin/example.js
export const MyPlugin = async ({ project, client, $, directory, worktree }) => {
  console.log("Plugin initialized!")

  return {
    // Hook 实现
  }
}
```

插件函数接收的参数：

| 参数 | 说明 |
|------|------|
| `project` | 当前项目信息 |
| `directory` | 当前工作目录 |
| `worktree` | Git worktree 路径 |
| `client` | OpenCode SDK 客户端，用于与 AI 交互 |
| `$` | Bun 的 shell API，用于执行命令 |

#### TypeScript 支持

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    // 类型安全的 Hook 实现
  }
}
```

#### 依赖管理

本地插件可使用外部 npm 包，在配置目录添加 `package.json`：

```json
// .opencode/package.json
{
  "dependencies": {
    "shescape": "^2.1.0"
  }
}
```

OpenCode 启动时会运行 `bun install` 安装依赖。

### 可用事件

| 类别 | 事件 |
|------|------|
| **Command** | `command.executed` |
| **File** | `file.edited`, `file.watcher.updated` |
| **Installation** | `installation.updated` |
| **LSP** | `lsp.client.diagnostics`, `lsp.updated` |
| **Message** | `message.part.removed`, `message.part.updated`, `message.removed`, `message.updated` |
| **Permission** | `permission.replied`, `permission.updated` |
| **Server** | `server.connected` |
| **Session** | `session.created`, `session.compacted`, `session.deleted`, `session.diff`, `session.error`, `session.idle`, `session.status`, `session.updated` |
| **Todo** | `todo.updated` |
| **Tool** | `tool.execute.before`, `tool.execute.after` |
| **TUI** | `tui.prompt.append`, `tui.command.execute`, `tui.toast.show` |

### 插件示例

#### 发送通知

```javascript
export const NotificationPlugin = async ({ $ }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await $`osascript -e 'display notification "Session completed!" with title "opencode"'`
      }
    },
  }
}
```

#### .env 文件保护

```javascript
export const EnvProtection = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "read" && output.args.filePath.includes(".env")) {
        throw new Error("Do not read .env files")
      }
    },
  }
}
```

#### 自定义工具

```typescript
import { type Plugin, tool } from "@opencode-ai/plugin"

export const CustomToolsPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      mytool: tool({
        description: "This is a custom tool",
        args: {
          foo: tool.schema.string(),
        },
        async execute(args, ctx) {
          return `Hello ${args.foo}!`
        },
      }),
    },
  }
}
```

#### 日志记录

使用 `client.app.log()` 代替 `console.log`：

```typescript
export const MyPlugin = async ({ client }) => {
  await client.app.log({
    service: "my-plugin",
    level: "info",  // debug, info, warn, error
    message: "Plugin initialized",
    extra: { foo: "bar" },
  })
}
```

#### Compaction 钩子

自定义会话压缩时包含的上下文：

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const CompactionPlugin: Plugin = async (ctx) => {
  return {
    "experimental.session.compacting": async (input, output) => {
      // 注入额外上下文到压缩提示
      output.context.push(`## Custom Context
Include any state that should persist across compaction:
- Current task status
- Important decisions made
- Files being actively worked on`)
    },
  }
}
```

### 加载顺序

1. 全局配置 (`~/.config/opencode/opencode.json`)
2. 项目配置 (`opencode.json`)
3. 全局插件目录 (`~/.config/opencode/plugin/`)
4. 项目插件目录 (`.opencode/plugin/`)

**参考**: [OpenCode 插件文档](https://opencode.ai/docs/plugins)

---

## 重要说明

- **Dev server port**: 1420
- **App identifier**: `com.zero.axon_desktop`
- **CSP**: 当前禁用，生产需配置
- **opencode 源码**: `github/opencode/` 可用于功能调研

---

## 子目录指南

- `src-tauri/AGENTS.md` - Rust 后端专用规范
- `github/opencode/AGENTS.md` - OpenCode 参考项目规范
