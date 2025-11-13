Redmineプラグイン
=========================

概要
-------------------------

RedmineプロジェクトとMD-Ticketのハイブリッド運用を実現するpm-toolプラグインです。
Redmine REST API v2を使用してチケット情報の取得・更新を行います。

機能
-------------------------

- **チケット取得(fetch)**: RedmineチケットをMarkdownファイルとして保存
- **チケット更新(update)**: Markdownファイルの変更をRedmineチケットに反映

サポートフィールド
-------------------------

### 取得時(Redmine → YAML)

YAMLフロントマターに以下のフィールドが保存されます。

- `id`: チケットID
- `project`: プロジェクト名
- `tracker`: トラッカー名
- `status`: ステータス名
- `priority`: 優先度名
- `author`: 作成者
- `assigned_to`: 担当者(任意)
- `start_date`: 開始日(任意)
- `due_date`: 期日(任意)
- `done_ratio`: 進捗率
- `estimated_hours`: 予定工数(任意)
- `created_on`: 作成日時
- `updated_on`: 更新日時

### 更新時(YAML → Redmine)

以下のフィールドが更新可能です。

- `comment`: コメント
- `status`: ステータスID
- `assigned_to`: 担当者ID
- `done_ratio`: 進捗率(0-100)
- `estimated_hours`: 予定工数
- `start_date`: 開始日
- `due_date`: 期日
- `priority`: 優先度ID
- `category`: カテゴリID

設定例
-------------------------

`.ticket/config.yml`でRedmine連携を有効化します。

### APIキー認証(推奨)

Redmine個人設定でAPIキーが発行できる場合はこちらを使用してください。

```yaml
integration:
  pm_tool:
    type: redmine
    redmine:
      url: ${REDMINE_URL}
      api_key: ${REDMINE_API_KEY}
```

### Basic認証

APIキーが発行できない環境(Redmine本家など)ではBasic認証を使用できます。

```yaml
integration:
  pm_tool:
    type: redmine
    redmine:
      url: ${REDMINE_URL}
      username: ${REDMINE_USERNAME}
      password: ${REDMINE_PASSWORD}
```

**注意**: APIキーとBasic認証の両方が設定されている場合、APIキーが優先されます。

### 環境変数設定

`.env`または`.envrc`で環境変数を設定します。

```bash
# APIキー認証の場合
export REDMINE_URL="https://redmine.example.com"
export REDMINE_API_KEY="your-api-key-here"

# Basic認証の場合
export REDMINE_URL="https://www.redmine.org"
export REDMINE_USERNAME="your-username"
export REDMINE_PASSWORD="your-password"
```

使用例
-------------------------

### チケット取得

```bash
# チケット1234を取得
pm-tool fetch 1234

# URLで取得
pm-tool fetch https://redmine.example.com/issues/1234

# 取得後のファイル: .ticket/task/ticket-1234.md
```

### チケット更新

```bash
# Markdownファイルの変更をRedmineに反映
pm-tool update task/ticket-1234.md

# コメントを追加
pm-tool update task/ticket-1234.md --comment "実装完了"

# 複数項目を同時に更新
pm-tool update task/ticket-1234.md --comment "実装完了" --status 3 --done-ratio 100
```

エラーハンドリング
-------------------------

以下のエラーに対応しています。

- **401 Unauthorized**: APIキーまたは認証情報が無効です。環境変数を確認してください。
- **403 Forbidden**: チケットへのアクセス権限がありません。
- **404 Not Found**: チケットが見つかりません。チケットIDを確認してください。
- **Network Error**: ネットワーク接続を確認してください。自動リトライ(最大3回)が実行されます。

技術詳細
-------------------------

### API仕様

- **Base URL**: `{REDMINE_URL}/`
- **認証方式**:
    - APIキー: `X-Redmine-API-Key`ヘッダー
    - Basic認証: `Authorization`ヘッダー
- **主要エンドポイント**:
    - `GET /issues/{id}.json`: チケット取得
    - `PUT /issues/{id}.json`: チケット更新

### リトライ機構

ネットワークエラー等の一時的な障害に対して、指数バックオフ付きリトライを実行します。

- 最大リトライ回数: 3回(取得時)、2回(更新時)
- 初回待機時間: 1秒
- バックオフ倍率: 2倍
- 最大待機時間: 10秒

参考情報
-------------------------

- [Redmine REST API](https://www.redmine.org/projects/redmine/wiki/Rest_api): 公式APIドキュメント
