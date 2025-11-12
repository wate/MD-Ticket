#!/usr/bin/env bash
#
# MD-Ticket Installer
# https://github.com/wate/MD-Ticket
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/wate/MD-Ticket/master/install.sh | bash
#   TICKET_DIR=.custom curl -fsSL https://raw.githubusercontent.com/wate/MD-Ticket/master/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/wate/MD-Ticket/master/install.sh | bash -s -- --dir=.custom

set -e

# デフォルト設定
REPO_URL="https://github.com/wate/MD-Ticket"
DEFAULT_BRANCH="master"
RAW_URL="https://raw.githubusercontent.com/wate/MD-Ticket/${DEFAULT_BRANCH}"
DEFAULT_DIR=".ticket"
TICKET_DIR=""
BRANCH=""
FORCE_INSTALL=false

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# ヘルプ表示
show_help() {
    cat << EOF
MD-Ticket Installer

Usage:
  curl -fsSL ${RAW_URL}/install.sh | bash
  TICKET_DIR=.custom curl -fsSL ${RAW_URL}/install.sh | bash
  curl -fsSL ${RAW_URL}/install.sh | bash -s -- [OPTIONS]

Options:
  -d, --dir=DIR       インストール先ディレクトリ (デフォルト: .ticket)
  -b, --branch=BRANCH ダウンロード元ブランチ (デフォルト: master)
  -f, --force         既存ディレクトリを上書き更新（テンプレート・ドキュメントのみ）
  -h, --help          このヘルプを表示

Environment Variables:
  TICKET_DIR          インストール先ディレクトリ (--dirオプションで上書き可能)
  TICKET_BRANCH       ダウンロード元ブランチ (--branchオプションで上書き可能)

Examples:
  # デフォルトディレクトリにインストール
  curl -fsSL ${RAW_URL}/install.sh | bash

  # 環境変数でディレクトリ指定
  TICKET_DIR=.custom curl -fsSL ${RAW_URL}/install.sh | bash

  # オプションでディレクトリ指定
  curl -fsSL ${RAW_URL}/install.sh | bash -s -- --dir=.custom

  # developブランチからインストール
  curl -fsSL https://raw.githubusercontent.com/wate/MD-Ticket/master/install.sh | bash -s -- --branch=develop

  # 既存環境を上書き更新(テンプレート等を最新に)
  curl -fsSL ${RAW_URL}/install.sh | bash -s -- --force

EOF
    exit 0
}

# 引数解析
CUSTOM_DIR=""
CUSTOM_BRANCH=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dir)
            CUSTOM_DIR="$2"
            shift 2
            ;;
        --dir=*)
            CUSTOM_DIR="${1#*=}"
            shift
            ;;
        -b|--branch)
            CUSTOM_BRANCH="$2"
            shift 2
            ;;
        --branch=*)
            CUSTOM_BRANCH="${1#*=}"
            shift
            ;;
        -f|--force)
            FORCE_INSTALL=true
            shift
            ;;
        -h|--help)
            show_help
            ;;
        *)
            error "Unknown option: $1\nUse --help for usage information."
            ;;
    esac
done

# 優先順位: コマンドライン引数 > 環境変数 > デフォルト値
if [[ -n "$CUSTOM_DIR" ]]; then
    TICKET_DIR="$CUSTOM_DIR"
elif [[ -n "$TICKET_DIR" ]]; then
    TICKET_DIR="$TICKET_DIR"
else
    TICKET_DIR="$DEFAULT_DIR"
fi

if [[ -n "$CUSTOM_BRANCH" ]]; then
    BRANCH="$CUSTOM_BRANCH"
elif [[ -n "$TICKET_BRANCH" ]]; then
    BRANCH="$TICKET_BRANCH"
else
    BRANCH="$DEFAULT_BRANCH"
fi

# ブランチ指定に応じてRAW_URLを更新
RAW_URL="https://raw.githubusercontent.com/wate/MD-Ticket/${BRANCH}"

# curlまたはwgetの検出
if command -v curl &> /dev/null; then
    DOWNLOAD_CMD="curl -fsSL"
elif command -v wget &> /dev/null; then
    DOWNLOAD_CMD="wget -qO-"
else
    error "curl or wget is required but not installed."
fi

# 既存ディレクトリチェック
if [ -d "$TICKET_DIR" ]; then
    if [ "$FORCE_INSTALL" = false ]; then
        error "Directory '$TICKET_DIR' already exists. Use --force to update existing installation."
    fi
    warn "Force mode: Updating existing installation in '$TICKET_DIR'"
    warn "Existing tickets will be preserved, but templates and documentation will be overwritten."
fi

# インストール開始
info "Branch: ${BRANCH}"
if [ "$FORCE_INSTALL" = true ]; then
    info "Updating MD-Ticket in '$TICKET_DIR'..."
else
    info "Installing MD-Ticket to '$TICKET_DIR'..."
fi

# ディレクトリ構造作成
if [ "$FORCE_INSTALL" = false ]; then
    info "Creating directory structure..."
    mkdir -p "$TICKET_DIR"/{_template,_shared/adr,_files,_archive/_files,_tools/lib/pm-tool/plugins,bug,idea,request,task}

    # .gitkeep作成
    touch "$TICKET_DIR/_archive/.gitkeep"
    touch "$TICKET_DIR/_archive/_files/.gitkeep"
    touch "$TICKET_DIR/_files/.gitkeep"
    touch "$TICKET_DIR/_shared/.gitkeep"
    touch "$TICKET_DIR/_shared/adr/.gitkeep"
    touch "$TICKET_DIR/bug/.gitkeep"
    touch "$TICKET_DIR/idea/.gitkeep"
    touch "$TICKET_DIR/request/.gitkeep"
    touch "$TICKET_DIR/task/.gitkeep"
else
    info "Ensuring directory structure..."
    mkdir -p "$TICKET_DIR"/{_template,_shared/adr,_files,_archive/_files,_tools/lib/pm-tool/plugins,bug,idea,request,task}
fi

# ファイルダウンロード
info "Downloading files..."

download_file() {
    local file=$1
    local target=$2
    info "  - $file"
    $DOWNLOAD_CMD "$RAW_URL/$file" > "$target" || error "Failed to download $file"
}

# メインファイル
download_file "README.md" "$TICKET_DIR/README.md"
download_file "AGENTS.md" "$TICKET_DIR/AGENTS.md"
download_file "LICENSE" "$TICKET_DIR/LICENSE"
download_file ".gitignore" "$TICKET_DIR/.gitignore"

# テンプレートファイル
download_file "_template/bug.md" "$TICKET_DIR/_template/bug.md"
download_file "_template/idea.md" "$TICKET_DIR/_template/idea.md"
download_file "_template/request.md" "$TICKET_DIR/_template/request.md"
download_file "_template/task.md" "$TICKET_DIR/_template/task.md"
download_file "_template/adr.md" "$TICKET_DIR/_template/adr.md"

# 設定ファイル(オプション)
info "Downloading optional config file..."
$DOWNLOAD_CMD "$RAW_URL/config.yml" > "$TICKET_DIR/config.yml" 2>/dev/null || warn "config.yml not found (optional)"

# pm-toolファイル
info "Downloading pm-tool files..."
download_file "_tools/pm-tool" "$TICKET_DIR/_tools/pm-tool"
chmod +x "$TICKET_DIR/_tools/pm-tool"
download_file "_tools/lib/pm-tool/plugins/redmine.mjs" "$TICKET_DIR/_tools/lib/pm-tool/plugins/redmine.mjs"

if [ "$FORCE_INSTALL" = true ]; then
    success "MD-Ticket has been updated in '$TICKET_DIR'!"
    info "Templates and documentation have been updated to the latest version."
    info "Your existing tickets have been preserved."
else
    success "MD-Ticket has been installed to '$TICKET_DIR'!"
fi

# AGENTS.md統合提案
if [ -f "AGENTS.md" ]; then
    echo ""
    warn "AGENTS.md found in current directory."
    info "To enable AI agent integration, add the following section to your AGENTS.md:"
    echo ""
    cat << 'EOF'
チケット管理
-------------------------

このプロジェクトでは軽量なMarkdownベースのチケット管理(MD-Ticket)を使用します。

### 基本ルール

- チケットは`.ticket/`配下の種別ディレクトリに作成
- ファイル名: ケバブケース（例: `fix-login-bug.md`）
- テンプレート（`.ticket/_template/`）に従った構造で記述

### チケット作成フロー

1. ユーザーからチケット作成依頼を受ける
2. `.ticket/config.yml`が存在する場合は設定を参照、なければデフォルト4種別（bug/task/idea/request）を使用
3. 適切な種別ディレクトリを選択
4. `.ticket/_template/`から対応するテンプレートを参照
5. テンプレートに基づいてチケットファイルを作成
6. 作業プランや関連ドキュメントからリンク

### チケット種別

デフォルトで以下の4種別を使用します。

- アイデア(`idea/`): 発想・構想段階のメモ、実現可能性が未検証
- 要望(`request/`): 実現してほしい希望、背景と期待する結果が明確
- タスク(`task/`): 実行すべき作業、前提条件と具体的な内容が定まっている
- バグ(`bug/`): 不具合の報告、再現手順と期待/実際の動作が記載可能

カスタム種別が必要な場合は`.ticket/config.yml`で定義できます。

### 参考資料の管理

- チケット関連ファイル（ドラフト、スクリーンショット等）は`.ticket/_files/`に配置
- ファイル名: `{チケット名接頭辞}-{サフィックス}.{拡張子}`
- チケットから相対パスでリンク（例: `[ドラフト](_files/add-feature-draft.md)`）

詳細なルールとテンプレートは[チケット管理ガイド](.ticket/AGENTS.md)を参照してください。
EOF
    echo ""
fi

# 次のステップ
echo ""
info "Next steps:"
echo "  1. Read the documentation: ${TICKET_DIR}/README.md"
echo "  2. Create your first ticket: cp ${TICKET_DIR}/_template/task.md ${TICKET_DIR}/task/my-first-task.md"
echo "  3. (Optional) Add ticket management section to your AGENTS.md"
echo ""
info "Documentation: $REPO_URL"
