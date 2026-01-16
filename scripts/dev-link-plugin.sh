#!/bin/bash
# Axon Desktop - 开发环境插件符号链接脚本 (macOS/Linux)
#
# 此脚本在 Axon 的 opencode 配置目录中创建符号链接，
# 指向项目目录的 .opencode 目录，便于开发时实时同步插件变更。
#
# 用法：
#   ./scripts/dev-link-plugin.sh
#   ./scripts/dev-link-plugin.sh --force   # 强制重新创建
#   ./scripts/dev-link-plugin.sh --remove  # 移除链接

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info() { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# 参数解析
FORCE=false
REMOVE=false
for arg in "$@"; do
    case $arg in
        --force|-f) FORCE=true ;;
        --remove|-r) REMOVE=true ;;
        *) warn "未知参数: $arg" ;;
    esac
done

# 路径定义
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
# 插件源目录：plugins/opencode（独立于 .opencode，避免污染项目配置）
SOURCE_PLUGIN="$PROJECT_ROOT/plugins/opencode"

# 根据操作系统确定 Axon 配置目录
case "$(uname -s)" in
    Darwin)
        APP_DATA_DIR="$HOME/Library/Application Support/com.zero.axon_desktop"
        ;;
    Linux)
        APP_DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/com.zero.axon_desktop"
        ;;
    *)
        error "不支持的操作系统: $(uname -s)"
        exit 1
        ;;
esac

OPENCODE_CONFIG_DIR="$APP_DATA_DIR/opencode"
# 目标：在 Axon 配置目录下创建 plugins/opencode 链接
TARGET_PLUGIN_DIR="$OPENCODE_CONFIG_DIR/plugins"
TARGET_PLUGIN="$TARGET_PLUGIN_DIR/opencode"

info "项目目录: $PROJECT_ROOT"
info "源目录: $SOURCE_PLUGIN"
info "Axon 配置目录: $OPENCODE_CONFIG_DIR"
info "目标链接: $TARGET_PLUGIN"

# 检查源目录是否存在
if [ ! -d "$SOURCE_PLUGIN" ]; then
    error "源目录不存在: $SOURCE_PLUGIN"
    exit 1
fi

# 移除模式
if [ "$REMOVE" = true ]; then
    if [ -L "$TARGET_PLUGIN" ] || [ -e "$TARGET_PLUGIN" ]; then
        rm -rf "$TARGET_PLUGIN"
        success "已移除符号链接: $TARGET_PLUGIN"
    else
        warn "符号链接不存在，无需移除"
    fi
    exit 0
fi

# 确保 Axon 配置目录和 plugins 目录存在
if [ ! -d "$OPENCODE_CONFIG_DIR" ]; then
    mkdir -p "$OPENCODE_CONFIG_DIR"
    info "已创建配置目录: $OPENCODE_CONFIG_DIR"
fi
if [ ! -d "$TARGET_PLUGIN_DIR" ]; then
    mkdir -p "$TARGET_PLUGIN_DIR"
    info "已创建插件目录: $TARGET_PLUGIN_DIR"
fi

# 检查目标是否已存在
if [ -L "$TARGET_PLUGIN" ]; then
    # 已是符号链接
    LINK_TARGET="$(readlink "$TARGET_PLUGIN")"
    if [ "$LINK_TARGET" = "$SOURCE_PLUGIN" ]; then
        success "符号链接已存在且正确指向源目录"
        exit 0
    fi
    if [ "$FORCE" = true ]; then
        warn "符号链接指向错误目标，将重新创建"
        rm "$TARGET_PLUGIN"
    else
        warn "符号链接已存在但指向: $LINK_TARGET"
        warn "使用 --force 参数强制重新创建"
        exit 1
    fi
elif [ -e "$TARGET_PLUGIN" ]; then
    # 是普通目录/文件
    if [ "$FORCE" = true ]; then
        warn "目标已存在（非链接），将备份并重新创建"
        BACKUP_PATH="${TARGET_PLUGIN}.bak_$(date +%Y%m%d_%H%M%S)"
        mv "$TARGET_PLUGIN" "$BACKUP_PATH"
        info "已备份到: $BACKUP_PATH"
    else
        error "目标已存在且不是符号链接: $TARGET_PLUGIN"
        error "使用 --force 参数强制处理"
        exit 1
    fi
fi

# 创建符号链接
ln -s "$SOURCE_PLUGIN" "$TARGET_PLUGIN"
success "符号链接创建成功!"
success "  源: $SOURCE_PLUGIN"
success "  链接: $TARGET_PLUGIN"

echo ""
info "开发提示："
info "  - 修改 $SOURCE_PLUGIN/axon-bridge.ts 后无需重新运行此脚本"
info "  - 重启 opencode 服务以加载插件更改"
info "  - 生产环境请使用其他方案（嵌入插件或配置文件引用）"
