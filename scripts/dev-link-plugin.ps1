# Axon Desktop - 开发环境插件符号链接脚本
#
# 此脚本在 Axon 的 opencode 配置目录中创建符号链接，
# 指向项目目录的 .opencode 目录，便于开发时实时同步插件变更。
#
# 用法：
#   .\scripts\dev-link-plugin.ps1
#
# 注意：需要管理员权限（Windows 符号链接需要）或启用开发者模式

param(
    [switch]$Force,  # 强制重新创建链接
    [switch]$Remove  # 移除链接
)

$ErrorActionPreference = "Stop"

# 颜色输出
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "[OK] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $args" -ForegroundColor Red }

# 路径定义
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $ProjectRoot) {
    $ProjectRoot = (Get-Location).Path
}
# 插件源目录：plugins/opencode（独立于 .opencode，避免污染项目配置）
$SourcePlugin = Join-Path $ProjectRoot "axon_desktop\plugins\opencode"
$AppDataDir = Join-Path $env:APPDATA "com.zero.axon-desktop"
$OpencodeConfigDir = Join-Path $AppDataDir "opencode"
# 目标：在 Axon 配置目录下创建 plugins/opencode 链接
$TargetPluginDir = Join-Path $OpencodeConfigDir "plugins"
$TargetPlugin = Join-Path $TargetPluginDir "opencode"

Write-Info "项目目录: $ProjectRoot"
Write-Info "源目录: $SourcePlugin"
Write-Info "Axon 配置目录: $OpencodeConfigDir"
Write-Info "目标链接: $TargetPlugin"

# 检查源目录是否存在
if (-not (Test-Path $SourcePlugin)) {
    Write-Err "源目录不存在: $SourcePlugin"
    exit 1
}

# 移除模式
if ($Remove) {
    if (Test-Path $TargetPlugin) {
        Remove-Item $TargetPlugin -Force -Recurse
        Write-Success "已移除符号链接: $TargetPlugin"
    } else {
        Write-Warn "符号链接不存在，无需移除"
    }
    exit 0
}

# 确保 Axon 配置目录和 plugins 目录存在
if (-not (Test-Path $OpencodeConfigDir)) {
    New-Item -ItemType Directory -Path $OpencodeConfigDir -Force | Out-Null
    Write-Info "已创建配置目录: $OpencodeConfigDir"
}
if (-not (Test-Path $TargetPluginDir)) {
    New-Item -ItemType Directory -Path $TargetPluginDir -Force | Out-Null
    Write-Info "已创建插件目录: $TargetPluginDir"
}

# 检查目标是否已存在
if (Test-Path $TargetPlugin) {
    $item = Get-Item $TargetPlugin
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        # 已是符号链接
        $linkTarget = (Get-Item $TargetPlugin).Target
        if ($linkTarget -eq $SourcePlugin) {
            Write-Success "符号链接已存在且正确指向源目录"
            exit 0
        }
        if ($Force) {
            Write-Warn "符号链接指向错误目标，将重新创建"
            Remove-Item $TargetPlugin -Force
        } else {
            Write-Warn "符号链接已存在但指向: $linkTarget"
            Write-Warn "使用 -Force 参数强制重新创建"
            exit 1
        }
    } else {
        # 是普通目录/文件
        if ($Force) {
            Write-Warn "目标已存在（非链接），将备份并重新创建"
            $backupPath = "$TargetPlugin.bak_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
            Move-Item $TargetPlugin $backupPath
            Write-Info "已备份到: $backupPath"
        } else {
            Write-Err "目标已存在且不是符号链接: $TargetPlugin"
            Write-Err "使用 -Force 参数强制处理"
            exit 1
        }
    }
}

# 创建符号链接
try {
    # Windows 上使用 New-Item -ItemType SymbolicLink
    # 注意：需要管理员权限或启用开发者模式
    New-Item -ItemType SymbolicLink -Path $TargetPlugin -Target $SourcePlugin | Out-Null
    Write-Success "符号链接创建成功!"
    Write-Success "  源: $SourcePlugin"
    Write-Success "  链接: $TargetPlugin"
} catch {
    Write-Err "创建符号链接失败: $_"
    Write-Host ""
    Write-Warn "可能的解决方案："
    Write-Warn "  1. 以管理员身份运行 PowerShell"
    Write-Warn "  2. 启用 Windows 开发者模式："
    Write-Warn "     设置 -> 更新和安全 -> 开发者选项 -> 开发人员模式"
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Info "开发提示："
Write-Info "  - 修改 $SourcePlugin\axon-bridge.ts 后无需重新运行此脚本"
Write-Info "  - 重启 opencode 服务以加载插件更改"
Write-Info "  - 生产环境请使用其他方案（嵌入插件或配置文件引用）"
