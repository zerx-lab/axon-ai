//! 终端命令处理
//!
//! 支持 PTY 进程管理、Tauri 事件通信和多终端实例

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Emitter, State};

use crate::state::AppState;

/// 终端实例 - 包含 PTY master 和进程信息
pub struct TerminalInstance {
    /// PTY master 写入端
    master_writer: Box<dyn Write + Send>,
    /// Shell 类型
    #[allow(dead_code)]
    pub shell: String,
    /// 工作目录
    #[allow(dead_code)]
    pub cwd: String,
    /// 进程 ID
    #[allow(dead_code)]
    pub pid: u32,
    /// PTY master（用于 resize）
    master: Box<dyn MasterPty + Send>,
    /// 子进程句柄（用于关闭时终止进程）
    child: Box<dyn Child + Send>,
}

/// 终端管理器 - 管理所有终端实例
pub struct TerminalManager {
    pub(crate) instances: Mutex<HashMap<String, TerminalInstance>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            instances: Mutex::new(HashMap::new()),
        }
    }

    /// 写入数据到终端
    pub fn write(&self, terminal_id: &str, data: &[u8]) -> Result<(), String> {
        let mut instances = self
            .instances
            .lock()
            .map_err(|_| "获取终端锁失败".to_string())?;

        let instance = instances
            .get_mut(terminal_id)
            .ok_or_else(|| format!("终端 {} 不存在", terminal_id))?;

        instance
            .master_writer
            .write_all(data)
            .map_err(|e| format!("写入终端失败: {}", e))?;

        instance
            .master_writer
            .flush()
            .map_err(|e| format!("刷新终端失败: {}", e))?;

        Ok(())
    }

    /// 关闭终端
    pub fn close(&self, terminal_id: &str) -> Result<(), String> {
        let mut instances = self
            .instances
            .lock()
            .map_err(|_| "获取终端锁失败".to_string())?;

        if let Some(mut instance) = instances.remove(terminal_id) {
            // 主动终止子进程，防止进程泄漏
            if let Err(e) = instance.child.kill() {
                tracing::warn!("[Terminal {}] 终止进程失败 (可能已退出): {}", terminal_id, e);
            }
            // 等待进程退出（非阻塞检查）
            let _ = instance.child.try_wait();
            tracing::info!("[Terminal {}] 已关闭并终止进程", terminal_id);
        }

        Ok(())
    }

    /// 获取终端列表
    pub fn list(&self) -> Result<Vec<String>, String> {
        let instances = self
            .instances
            .lock()
            .map_err(|_| "获取终端锁失败".to_string())?;

        Ok(instances.keys().cloned().collect())
    }

    /// 调整终端大小
    pub fn resize(&self, terminal_id: &str, rows: u16, cols: u16) -> Result<(), String> {
        let instances = self
            .instances
            .lock()
            .map_err(|_| "获取终端锁失败".to_string())?;

        let instance = instances
            .get(terminal_id)
            .ok_or_else(|| format!("终端 {} 不存在", terminal_id))?;

        instance
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("调整终端大小失败: {}", e))?;

        tracing::info!(
            "[Terminal {}] 已调整大小: {} cols x {} rows",
            terminal_id,
            cols,
            rows
        );

        Ok(())
    }
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}

/// 创建终端结果
#[derive(serde::Serialize)]
pub struct CreateTerminalResult {
    pub pid: u32,
    pub name: String,
}

/// 终端输出事件 payload
#[derive(Clone, serde::Serialize)]
pub struct TerminalOutputPayload {
    pub terminal_id: String,
    pub data: String,
}

/// 终端退出事件 payload
#[derive(Clone, serde::Serialize)]
pub struct TerminalExitPayload {
    pub terminal_id: String,
    pub exit_code: Option<i32>,
}

/// 获取默认 shell
fn get_default_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    }
}

/// 根据 shell 类型获取可执行路径
fn get_shell_command(shell: &str) -> String {
    match shell.to_lowercase().as_str() {
        "powershell" | "pwsh" => {
            // 优先使用 PowerShell 7 (pwsh)，否则使用 Windows PowerShell
            if which::which("pwsh").is_ok() {
                "pwsh".to_string()
            } else {
                "powershell.exe".to_string()
            }
        }
        "cmd" => "cmd.exe".to_string(),
        "bash" => {
            #[cfg(target_os = "windows")]
            {
                // Windows 上尝试使用 Git Bash
                if let Ok(program_files) = std::env::var("ProgramFiles") {
                    let git_bash = format!(r"{}\Git\bin\bash.exe", program_files);
                    if std::path::Path::new(&git_bash).exists() {
                        return git_bash;
                    }
                }
                "bash.exe".to_string()
            }
            #[cfg(not(target_os = "windows"))]
            {
                "/bin/bash".to_string()
            }
        }
        "zsh" => "/bin/zsh".to_string(),
        "fish" => "fish".to_string(),
        _ => get_default_shell(),
    }
}

/// 创建新终端
#[tauri::command]
pub async fn create_terminal(
    app: AppHandle,
    state: State<'_, AppState>,
    terminal_id: String,
    shell: String,
    cwd: String,
) -> Result<CreateTerminalResult, String> {
    tracing::info!(
        "[Terminal {}] 创建终端: shell={}, cwd={}",
        terminal_id,
        shell,
        cwd
    );

    // 创建 PTY
    let pty_system = native_pty_system();
    let pty_pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("创建 PTY 失败: {}", e))?;

    // 构建 shell 命令
    let shell_cmd = get_shell_command(&shell);
    let mut cmd = CommandBuilder::new(&shell_cmd);

    // 设置工作目录
    let work_dir = if cwd.is_empty() || cwd == "." {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    } else {
        cwd.clone()
    };
    cmd.cwd(&work_dir);

    // 设置环境变量
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    // 启动子进程
    let child = pty_pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("启动 shell 失败: {}", e))?;

    let pid = child.process_id().unwrap_or(0);

    // 获取读取器用于输出监听
    let mut reader = pty_pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("获取 PTY reader 失败: {}", e))?;

    // 获取写入器
    let writer = pty_pair
        .master
        .take_writer()
        .map_err(|e| format!("获取 PTY writer 失败: {}", e))?;

    // 创建终端实例（保存 child 进程句柄，用于关闭时终止进程）
    let instance = TerminalInstance {
        master_writer: writer,
        shell: shell.clone(),
        cwd: work_dir,
        pid,
        master: pty_pair.master,
        child,
    };

    // 保存实例
    let terminal_manager = state
        .terminal_manager
        .as_ref()
        .ok_or_else(|| "终端管理器未初始化".to_string())?;

    {
        let mut instances = terminal_manager
            .instances
            .lock()
            .map_err(|_| "获取终端锁失败".to_string())?;
        instances.insert(terminal_id.clone(), instance);
    }

    // 克隆 terminal_manager 用于线程清理
    let tm_for_cleanup = state.terminal_manager.clone();

    // 启动输出读取线程
    let output_terminal_id = terminal_id.clone();
    let app_handle = app.clone();
    let cleanup_terminal_id = terminal_id.clone();

    thread::spawn(move || {
        tracing::info!(
            "[Terminal {}] 输出读取线程已启动",
            output_terminal_id
        );
        let mut buf = [0u8; 4096];

        loop {
            match reader.read(&mut buf) {
                Ok(0) => {
                    // EOF - 进程已退出
                    tracing::info!("[Terminal {}] PTY EOF", output_terminal_id);
                    let _ = app_handle.emit(
                        "terminal-exit",
                        TerminalExitPayload {
                            terminal_id: output_terminal_id.clone(),
                            exit_code: None,
                        },
                    );
                    break;
                }
                Ok(n) => {
                    // 将输出发送到前端
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    tracing::info!(
                        "[Terminal {}] 发送输出: {} bytes, 内容前50字符: {:?}",
                        output_terminal_id,
                        n,
                        data.chars().take(50).collect::<String>()
                    );
                    let emit_result = app_handle.emit(
                        "terminal-output",
                        TerminalOutputPayload {
                            terminal_id: output_terminal_id.clone(),
                            data,
                        },
                    );
                    if let Err(e) = emit_result {
                        tracing::error!(
                            "[Terminal {}] 发送事件失败: {}",
                            output_terminal_id,
                            e
                        );
                    }
                }
                Err(e) => {
                    tracing::error!("[Terminal {}] 读取错误: {}", output_terminal_id, e);
                    let _ = app_handle.emit(
                        "terminal-exit",
                        TerminalExitPayload {
                            terminal_id: output_terminal_id.clone(),
                            exit_code: None,
                        },
                    );
                    break;
                }
            }
        }

        // 线程退出时清理 HashMap 条目，防止僵尸终端
        if let Some(tm) = tm_for_cleanup.as_ref() {
            if let Ok(mut instances) = tm.instances.lock() {
                if instances.remove(&cleanup_terminal_id).is_some() {
                    tracing::info!(
                        "[Terminal {}] 已从管理器中清理",
                        cleanup_terminal_id
                    );
                }
            }
        }

        tracing::info!(
            "[Terminal {}] 输出读取线程已退出",
            output_terminal_id
        );
    });

    tracing::info!(
        "[Terminal {}] 终端已创建, PID: {}",
        terminal_id,
        pid
    );

    Ok(CreateTerminalResult { pid, name: shell })
}

/// 关闭终端
#[tauri::command]
pub async fn close_terminal(
    state: State<'_, AppState>,
    terminal_id: String,
) -> Result<(), String> {
    if let Some(terminal_manager) = &state.terminal_manager {
        terminal_manager.close(&terminal_id)?;
    }
    Ok(())
}

/// 写入终端
#[tauri::command]
pub async fn terminal_write(
    state: State<'_, AppState>,
    terminal_id: String,
    data: String,
) -> Result<(), String> {
    if let Some(terminal_manager) = &state.terminal_manager {
        terminal_manager.write(&terminal_id, data.as_bytes())?;
    }

    Ok(())
}

/// 调整终端大小
#[tauri::command]
pub async fn terminal_resize(
    state: State<'_, AppState>,
    terminal_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    if let Some(terminal_manager) = &state.terminal_manager {
        terminal_manager.resize(&terminal_id, rows, cols)?;
    }
    Ok(())
}

/// 获取终端列表
#[tauri::command]
pub async fn list_terminals(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    if let Some(terminal_manager) = &state.terminal_manager {
        terminal_manager.list()
    } else {
        Ok(Vec::new())
    }
}
