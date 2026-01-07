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
