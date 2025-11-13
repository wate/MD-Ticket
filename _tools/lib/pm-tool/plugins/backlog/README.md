Backlogプラグイン
=========================

概要
-------------------------

BacklogプロジェクトとMD-Ticketのハイブリッド運用を実現するpm-toolプラグインです。
Backlog REST API v2を使用して課題情報の取得・更新を行います。

機能
-------------------------

- **課題取得(fetch)**: Backlog課題をMarkdownファイルとして保存
- **課題更新(update)**: Markdownファイルの変更をBacklog課題に反映

サポートフィールド
-------------------------

### 取得時(Backlog → YAML)

YAMLフロントマターに以下のフィールドが保存されます。

- `backlog_id`: 課題ID
- `backlog_key`: 課題キー(例: PROJ-123)
- `project_id`: プロジェクトID
- `title`: 件名
- `type`: 課題種別
- `status`: ステータス
- `priority`: 優先度
- `assignee`: 担当者
- `created_at`: 作成日時
- `updated_at`: 更新日時
- `start_date`: 開始日(任意)
- `due_date`: 期限日(任意)
- `estimated_hours`: 予定時間(任意)
- `actual_hours`: 実績時間(任意)

### 更新時(YAML → Backlog)

以下のフィールドが更新可能です。

- `title`: 件名
- `start_date`: 開始日
- `due_date`: 期限日
- `estimated_hours`: 予定時間
- `actual_hours`: 実績時間

制約事項
-------------------------

- **ステータスの更新は未サポート**: ステータス名からIDへのマッピングが必要なため、現在は未実装です。Backlog側で手動更新してください。
- **担当者・優先度の更新は未サポート**: 同様にID変換が必要なため、未実装です。
- **コメントの同期は未サポート**: 将来の拡張で対応予定です。

設定例
-------------------------

`.ticket/config.yml`でBacklog連携を有効化します。

```yaml
integration:
  pm_tool:
    type: backlog
    output_dir: task
    file_prefix: ''
    backlog:
      url: ${BACKLOG_URL}
      api_key: ${BACKLOG_API_KEY}
```

### 環境変数設定

`.env`または`.envrc`で環境変数を設定します。

```bash
# BacklogスペースURL(例: https://your-space.backlog.com)
export BACKLOG_URL="https://your-space.backlog.com"

# Backlog APIキー
export BACKLOG_API_KEY="your-api-key-here"
```

使用例
-------------------------

### 課題取得

```bash
# 課題PROJ-123を取得
pm-tool fetch PROJ-123

# 取得後のファイル: .ticket/task/PROJ-123.md
```

### 課題更新

```bash
# Markdownファイルの変更をBacklogに反映
pm-tool update task/PROJ-123.md
```

エラーハンドリング
-------------------------

以下のエラーに対応しています。

- **401 Unauthorized**: APIキーが無効です。環境変数を確認してください。
- **404 Not Found**: 課題が見つかりません。課題キーを確認してください。
- **Network Error**: ネットワーク接続を確認してください。自動リトライ(最大3回)が実行されます。

技術詳細
-------------------------

### API仕様

- **Base URL**: `{BACKLOG_URL}/api/v2`
- **認証方式**: APIキーをクエリパラメータとして付与(`?apiKey={API_KEY}`)
- **主要エンドポイント**:
    - `GET /issues/{issueKey}`: 課題取得
    - `PATCH /issues/{issueKey}`: 課題更新

### リトライ機構

ネットワークエラー等の一時的な障害に対して、指数バックオフ付きリトライを実行します。

- 最大リトライ回数: 3回(取得時)、2回(更新時)
- 初回待機時間: 1秒
- バックオフ倍率: 2倍
- 最大待機時間: 10秒

参考情報
-------------------------

- [Backlog API Documentation](https://developer.nulab.com/ja/docs/backlog/): 公式APIドキュメント
- [Backlog REST API v2](https://developer.nulab.com/ja/docs/backlog/api/2/): API仕様詳細
