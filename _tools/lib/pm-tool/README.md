pm-tool
=========================

MD-Ticketとプロジェクト管理ツールを連携するためのCLIツールです。

pm-toolは、MD-Ticketとプロジェクト管理ツール(Redmine、Backlog、GitHub Issue等)をつなぐブリッジツールです。
プラグイン方式により、複数のプロジェクト管理ツールに対応可能な拡張性の高い設計になっています。

機能
-------------------------

- **fetch**: プロジェクト管理ツールからチケット情報を取得
- **update**: プロジェクト管理ツールのチケット情報を更新
- 自動リトライ(指数バックオフ)
- エラーハンドリング(認証エラー、ネットワークエラー、レート制限等)
- 環境変数による設定管理

対応ツール
-------------------------

- [x] [Redmine](https://www.redmine.org/)
- [ ] [Backlog](https://backlog.com/)
- [ ] [GitHub Issue](https://github.co.jp/)
- [ ] [Jira](https://www.atlassian.com/ja/software/jira)

インストール
-------------------------

### 前提条件

- [zx](https://google.github.io/zx/setup)がグローバルにインストールされていること

```bash
npm install -g zx
```

### セットアップ

PATHを設定する。

```bash
export PATH="$PATH:$(pwd)/.ticket/_tools"
```

`.bashrc`や`.zshrc`に追加することを推奨します。

環境変数を設定する。

Redmineの場合:

```bash
export REDMINE_URL=https://redmine.example.com
# APIキー認証の場合(推奨)
export REDMINE_API_KEY=your_api_key_here
# Basic認証の場合(APIキーが発行できない環境)
export REDMINE_USERNAME=your_username
export REDMINE_PASSWORD=your_password
```

環境変数の管理方法は自由です(direnv、.env、シェル設定ファイル等)。

設定ファイルを確認する。

`.ticket/config.yml`を開き、連携設定を確認してください。

```yaml
integration:
  pm_tool:
    type: redmine
    redmine:
      url: ${REDMINE_URL}
      # APIキー認証の場合(推奨)
      api_key: ${REDMINE_API_KEY}
      # Basic認証の場合(APIキーが発行できない環境)
      # username: ${REDMINE_USERNAME}
      # password: ${REDMINE_PASSWORD}
```

使用方法
-------------------------

### 基本コマンド

#### チケット情報の取得

```bash
pm-tool fetch <チケット番号またはURL> [オプション]
```

例:

```bash
# チケット番号で取得
pm-tool fetch 1234

# URLで取得(ブラウザからコピペ)
pm-tool fetch https://redmine.example.com/issues/1234
pm-tool fetch https://redmine.example.com/issues/1234#note-5  # アンカー付きも可

# 標準出力に表示(ファイル保存なし)
pm-tool fetch 1234 --stdout

# JSON形式で保存
pm-tool fetch 1234 --json

# JSON形式で標準出力
pm-tool fetch 1234 --json --stdout

# 保存先ディレクトリを指定
pm-tool fetch 1234 --dir ./docs

# ファイル名のプレフィックスを指定
pm-tool fetch 1234 --prefix issue-
```

取得オプション:

- `--stdout`: 標準出力に表示(ファイル保存なし)
- `--json`: JSON形式で保存/出力
- `--dir <path>`: 保存先ディレクトリ(デフォルト: カレントディレクトリ)
- `--prefix <text>`: ファイル名のプレフィックス(デフォルト: `ticket-`)

#### チケット情報の更新

```bash
pm-tool update <チケット番号またはURL> [オプション]
```

例:

```bash
# チケット番号でコメントを追加
pm-tool update 1234 --comment "実装完了"

# URLでステータスを更新
pm-tool update https://redmine.example.com/issues/1234 --status 3

# 複数項目を同時に更新
pm-tool update 1234 --comment "実装完了" --status 3 --done-ratio 100
```

### ヘルプ表示

```bash
pm-tool help
```

### バージョン表示

```bash
pm-tool --version
```

### オプション

更新時に使用できるオプション(ツールにより異なります)。

Redmineの場合:

- `--comment`: コメント
- `--status`: ステータスID
- `--assigned-to`: 担当者ID
- `--done-ratio`: 進捗率(0-100)
- `--estimated-hours`: 予定工数
- `--start-date`: 開始日(YYYY-MM-DD)
- `--due-date`: 期日(YYYY-MM-DD)
- `--priority`: 優先度ID
- `--category`: カテゴリID

### 環境変数

`PM_TOOL_LOG_LEVEL`: ログレベル(DEBUG, INFO, WARN, ERROR)

- デフォルト: INFO
- デバッグ時は`DEBUG`に設定

```bash
PM_TOOL_LOG_LEVEL=DEBUG pm-tool fetch 1234
```

アーキテクチャ
-------------------------

### ディレクトリ構造

```
.ticket/_tools/
├ pm-tool              # CLIエントリーポイント(shebang、拡張子なし)
└ lib/                 # 共通ライブラリディレクトリ
   └ pm-tool/          # pm-tool専用ライブラリ
      ├ config.js      # 設定管理(YAML読み込み、環境変数展開)
      ├ cli.js         # CLIメイン処理(引数パース、コマンドルーティング)
      ├ common/        # 共通ユーティリティ
      │  ├ api.js      # API呼び出しラッパー(fetch、リトライ)
      │  ├ error.js    # エラーハンドリング(エラークラス定義)
      │  ├ logger.js   # ログ出力(レベル別ログ)
      │  └ retry.js    # リトライ処理(指数バックオフ)
      ├ plugins/       # ツール別プラグイン
      │  └ redmine/    # Redmineプラグイン
      │     ├ index.js # プラグインエントリーポイント
      │     ├ fetch.js # チケット取得
      │     ├ update.js# チケット更新
      │     └ README.md# プラグインドキュメント
      └ README.md      # このファイル
```

### プラグイン方式

各プロジェクト管理ツールは独立したプラグインとして実装されます。
プラグインは共通インターフェースを実装することで、CLIから統一的に呼び出せます。

プラグイン共通インターフェース:

```javascript
export default {
    name: 'tool-name',
    label: 'Tool Name',
    
    async fetch(config, ticketId, options) {
        // チケット取得処理
        return { meta, body, title };
    },
    
    async update(config, ticketId, updateData) {
        // チケット更新処理
        return { success, message, updated };
    },
    
    async validate(config) {
        // 設定検証
        return { valid, errors };
    }
};
```

エラーハンドリング
-------------------------

### エラータイプ

- **ConfigError**: 設定エラー(設定ファイル、環境変数)
- **AuthenticationError**: 認証エラー(APIキー、トークン)
- **ApiError**: APIエラー(サーバーエラー、クライアントエラー)
- **NetworkError**: ネットワークエラー(接続失敗、タイムアウト)
- **ValidationError**: バリデーションエラー(入力値エラー)

### リトライ戦略

一時的なエラーに対して自動的にリトライします。

- レート制限(429): 自動リトライ
- サーバーエラー(5xx): 自動リトライ
- ネットワークエラー: 自動リトライ
- 認証エラー(401/403): リトライしない
- クライアントエラー(4xx): リトライしない

デフォルトのリトライ設定:

- 最大リトライ回数: 3回
- 初回待機時間: 1秒
- 最大待機時間: 10秒
- バックオフ倍率: 2倍(指数バックオフ)

開発者向け情報
-------------------------

### 新規プラグインの開発

詳細は別ドキュメント(開発者ガイド)を参照してください。

基本的な手順です。

- `.ticket/_tools/lib/pm-tool/plugins/{tool-name}/`ディレクトリを作成
- `index.js`に共通インターフェースを実装
- `fetch.js`、`update.js`に各機能を実装
- `README.md`にプラグインドキュメントを作成

### デバッグ

デバッグログを有効にします。

```bash
PM_TOOL_LOG_LEVEL=DEBUG pm-tool fetch 1234
```

トラブルシューティング
-------------------------

### コマンドが見つからない

```
bash: pm-tool: command not found
```

対処方法です。

PATHが設定されているか確認します。

```bash
echo $PATH | grep ".ticket/_tools"
```

PATHを設定します。

```bash
export PATH="$PATH:$(pwd)/.ticket/_tools"
```

### 設定ファイルが見つからない

```
エラー: 設定ファイルが見つかりません
```

対処方法です。

- `.ticket/config.yml`が存在するか確認
- カレントディレクトリがプロジェクトルートか確認

### 環境変数が展開されない

```
エラー: 認証に失敗しました
```

対処方法です。

環境変数が設定されているか確認します。

```bash
echo $REDMINE_URL
echo $REDMINE_API_KEY
```

環境変数を設定します。

```bash
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=your_api_key_here
```

### URLが設定と一致しない

```
エラー: URLが設定と一致しません
```

対処方法です。

- config.ymlのURLと指定したURLが一致しているか確認
- プロトコル(http/https)、ホスト、ポートが完全一致する必要がある
- 異なるRedmineサーバーのURLを指定していないか確認

```bash
# 正しい例(config.ymlと一致)
pm-tool fetch https://redmine.example.com/issues/1234

# エラー例(config.ymlと不一致)
pm-tool fetch https://other-redmine.com/issues/1234
```

ライセンス
-------------------------

このツールはMD-Ticketプロジェクトの一部です。
