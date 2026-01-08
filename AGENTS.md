# AGENTS.md - AI Coding Agent Guidelines for axon_desktop

## 语言规范 (Language Requirements)

**必须遵守以下语言规范**:
- 所有回复必须使用**中文**
- 所有代码注释必须使用**中文**
- 变量名、函数名等标识符保持英文（遵循编程规范）
- Git commit message 可使用中文或英文

---

## Project Overview

**axon_desktop** is an AI client desktop application (similar to LLM Studio) built with:
- **Frontend**: React 19 + TypeScript 5 + Vite 7
- **Backend**: Rust + Tauri 2
- **Package Manager**: Bun
- **opencode**: 项目根目录下存在opencode源码,可用于功能调研与对接参考

The backend handles async detection/download of opencode binary on startup and invokes `opencode serve` for AI operations.

---

## Build / Dev / Test Commands

### Frontend (Bun)
```bash
bun install              # Install dependencies
bun run build            # TypeScript check + Vite build (use this to verify)
bun run preview          # Preview production build
```

### Tauri (Full Application)
```bash
bun run tauri build      # Build production application
```

### Rust/Backend (run from src-tauri/)
```bash
cargo check              # Check for errors
cargo build              # Build backend
cargo build --release    # Release build
cargo test               # Run all tests
cargo test <test_name>   # Run single test
cargo test -- --nocapture # Tests with output
cargo fmt                # Format code
cargo clippy             # Lint code
```

### TypeScript Check
```bash
npx tsc --noEmit         # Type check only
```

**IMPORTANT**: Do NOT run `bun run dev` or `bun run tauri dev` - use `bun run build` for verification.

---

## Dependency Management (CRITICAL)

**NEVER directly edit dependency files** (`package.json`, `Cargo.toml`, `bun.lock`, `Cargo.lock`).

### Adding Frontend Dependencies
```bash
bun add <package>           # Add production dependency
bun add -d <package>        # Add dev dependency
bun remove <package>        # Remove dependency
```

### Adding Backend Dependencies (run from src-tauri/)
```bash
cargo add <crate>           # Add dependency
cargo add <crate> -F feat   # Add with features
cargo add --dev <crate>     # Add dev dependency
cargo remove <crate>        # Remove dependency
```

**Examples**:
```bash
# Frontend
bun add zustand             # Add state management
bun add -d vitest           # Add test framework

# Backend (in src-tauri/)
cargo add tokio -F full     # Add tokio with full features
cargo add reqwest -F json   # Add reqwest with json feature
```

---

## Project Structure

```
axon_desktop/
├── src/                    # Frontend (React/TypeScript)
│   ├── main.tsx           # React entry point
│   ├── App.tsx            # Main component
│   └── assets/            # Static assets
├── src-tauri/             # Backend (Rust/Tauri)
│   ├── src/
│   │   ├── main.rs        # Rust entry point
│   │   └── lib.rs         # Tauri commands
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri config
├── package.json           # Node dependencies
└── tsconfig.json          # TypeScript config
```

---

## Code Style Guidelines

### TypeScript / React

**Imports Order**:
1. React imports → 2. Third-party (@tauri-apps) → 3. Local modules → 4. CSS (last)

```typescript
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import MyComponent from "./MyComponent";
import "./styles.css";
```

**Naming Conventions**:
- Components: `PascalCase` (e.g., `AppHeader`)
- Functions/Variables: `camelCase` (e.g., `userName`)
- Constants: `UPPER_SNAKE_CASE`
- Files: `PascalCase.tsx` for components

**TypeScript Rules** (strict mode enabled):
- No unused locals/parameters
- Explicit return types for public functions
- No implicit `any`

**React Patterns**:
- Functional components with hooks
- Use `React.StrictMode`
- Form submissions: `e.preventDefault()`

### Rust / Tauri

**Naming Conventions**:
- Functions: `snake_case`
- Types/Structs: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`

**Tauri Commands**:
```rust
#[tauri::command]
fn command_name(param: &str) -> Result<String, String> {
    Ok(format!("Result: {}", param))
}
```

**Error Handling**:
- Use `Result<T, E>` for fallible operations
- Use `?` operator for propagation
- Return meaningful error messages

**Required Attributes**:
- `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` in main.rs
- `#[cfg_attr(mobile, tauri::mobile_entry_point)]` for mobile support

---

## Frontend-Backend Communication

```typescript
// Frontend: Call Rust command
const result = await invoke("command_name", { param: value });
```

```rust
// Backend: Register command
.invoke_handler(tauri::generate_handler![command_name])
```

---

## Key Dependencies

**Frontend**: react ^19.1.0, @tauri-apps/api ^2, typescript ~5.8.3, vite ^7.0.4
**Backend**: tauri 2, serde 1 (derive), serde_json 1

---

## Important Notes

- Dev server port: `1420`
- App identifier: `com.zero.axon_desktop`
- CSP currently disabled (configure for production)

## Future Features

- opencode binary download/management on startup
- `opencode serve` process management
- State synchronization between frontend and Rust backend

---

## UI 设计系统

本项目采用 **Zed 风格极简主义设计**，所有 UI 组件必须遵循以下统一规范。

### 核心设计哲学

1. **极简主义 (Minimalism)**
   - 只保留必要元素，去除视觉噪音
   - 留白即设计，空间感优先
   - 功能导向，形式服务于内容

2. **优雅克制 (Elegant Restraint)**
   - 使用微妙的视觉反馈，不喧宾夺主
   - 动画简短流畅（150-300ms），避免花哨效果
   - 颜色使用克制，避免过度装饰

3. **一致性 (Consistency)**
   - 统一的圆角系统（2-4px 小圆角）
   - 统一的间距节奏（4px 基准）
   - 统一的交互反馈模式

### 视觉规范

#### 圆角系统
```css
--radius-sm: 1px;
--radius-md: 2px;   /* 默认 */
--radius-lg: 3px;
--radius-xl: 4px;
```

#### 颜色使用
- **默认状态**: `text-muted-foreground/70` - 柔和不突兀
- **悬浮状态**: `text-foreground` + `bg-accent` - 清晰反馈
- **激活状态**: `text-foreground` + 主题色指示器
- **边框透明度**: 使用 50-60% 透明度，更加细腻

#### 图标规范
- 尺寸统一：小图标 16px，标准图标 18px，大图标 20px
- 默认使用 `muted-foreground` 颜色
- 悬浮/激活时过渡到 `foreground`

#### 动画规范
- 过渡时长：150ms（快速）、200ms（标准）、300ms（强调）
- 缓动函数：`ease-out` 为主
- 禁止使用：缩放动画（zoom-in/zoom-out）、弹跳效果

### 组件规范

#### Activity Bar（活动栏）
- 宽度：40px（紧凑）
- 图标大小：18px
- 激活指示器：2px 宽主题色竖线
- 微交互：设置图标悬浮时 45° 旋转

#### Dialog（对话框）
- 位置：水平居中，垂直距顶部 15%（不垂直居中）
- 动画：从上向下滑入 + 淡入，关闭时反向
- 样式：`rounded-lg`、`shadow-lg`、`border border-border/60`
- 禁止：缩放动画、垂直居中

#### Sidebar（侧边栏）
- 背景：`bg-sidebar`（略深于主背景）
- 边框：`border-sidebar-border/50`
- 滚动条：默认隐藏，悬浮显示，宽度 4-6px

#### Button（按钮）
- ghost 变体：无背景，悬浮时 `bg-accent`
- 图标按钮：正方形，常用尺寸 28-36px
- 焦点状态：1px ring，偏移 1px

### 交互规范

#### Tooltip
- 延迟显示：300ms
- 字体大小：`text-xs`
- 位置：根据触发元素位置自动调整

#### 右键菜单
- 最小宽度：160px
- 菜单项：`text-xs`，图标 14px

#### 悬浮效果
- 背景变化：`hover:bg-accent`
- 颜色过渡：`transition-colors duration-150`
- 避免多重效果叠加

### 代码示例

```tsx
// ✅ 正确：极简按钮样式
<button
  className={cn(
    "flex items-center justify-center",
    "w-9 h-9",
    "text-muted-foreground/70 hover:text-foreground",
    "hover:bg-accent",
    "transition-colors duration-150",
    isActive && "text-foreground"
  )}
>
  <Icon className="w-[18px] h-[18px]" />
</button>

// ❌ 错误：过度装饰
<button
  className="bg-gradient-to-r from-blue-500 to-purple-500 
             rounded-xl shadow-2xl hover:scale-105 
             transition-all duration-500"
>
```

### 禁止事项

- ❌ 渐变背景（gradients）
- ❌ 大圆角（>8px）
- ❌ 过长动画（>300ms）
- ❌ 缩放/弹跳动画
- ❌ 多重阴影叠加
- ❌ 过度使用颜色

