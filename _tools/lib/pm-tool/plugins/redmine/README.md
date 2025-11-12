Redmineプラグイン
=========================

MD-TicketとRedmineを連携するためのプラグインです。

機能
-------------------------

- **fetch**: Redmineチケット情報を取得し、YAMLフロントマター形式で返す
- **update**: Redmineチケット情報を更新する
- **validate**: Redmine設定の妥当性を検証する

設定
-------------------------

`.ticket/config.yml`に以下の設定を追加してください。

### APIキー認証（推奨）

Redmine個人設定でAPIキーが発行できる場合はこちらを使用してください。

```yaml
integration:
    pm_tool:
        type: redmine
        redmine:
            url: ${REDMINE_URL}
            api_key: ${REDMINE_API_KEY}
```

環境変数を設定してください。

```bash
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=your_api_key_here
```

### Basic認証

APIキーが発行できない環境（Redmine本家など）ではBasic認証を使用できます。

```yaml
integration:
    pm_tool:
        type: redmine
        redmine:
            url: ${REDMINE_URL}
            username: ${REDMINE_USERNAME}
            password: ${REDMINE_PASSWORD}
```

環境変数を設定してください。

```bash
export REDMINE_URL=https://www.redmine.org
export REDMINE_USERNAME=your_username
export REDMINE_PASSWORD=your_password
```

注意: APIキーとBasic認証の両方が設定されている場合、APIキーが優先されます。

使用方法
-------------------------

### チケット情報の取得

```bash
pm-tool fetch 1234
```

### チケット情報の更新

```bash
# コメントを追加
pm-tool update 1234 --comment "実装完了"

# ステータスを更新
pm-tool update 1234 --status 3

# 複数項目を同時に更新
pm-tool update 1234 --comment "実装完了" --status 3 --done-ratio 100
```

### 更新可能な項目

- `--comment`: コメント（notes）
- `--status`: ステータスID
- `--assigned-to`: 担当者ID
- `--done-ratio`: 進捗率（0-100）
- `--estimated-hours`: 予定工数
- `--start-date`: 開始日（YYYY-MM-DD）
- `--due-date`: 期日（YYYY-MM-DD）
- `--priority`: 優先度ID
- `--category`: カテゴリID

エラーハンドリング
-------------------------

以下のエラーが発生する可能性があります。

- **ConfigError**: 設定エラー（URL未設定、認証情報未設定）
- **AuthenticationError**: 認証エラー（APIキーまたはusername/passwordが無効）
- **ApiError**: APIエラー（チケットが存在しない、権限不足等）
- **NetworkError**: ネットワークエラー（接続失敗、タイムアウト等）
- **ValidationError**: バリデーションエラー（不正な入力値）

APIリファレンス
-------------------------

### fetch(config, ticketId, options)

Redmineチケット情報を取得する。

パラメータ:

- `config`: Redmine設定オブジェクト
    - `url`: Redmine URL
    - `api_key`: Redmine APIキー
- `ticketId`: チケットID（文字列または数値）
- `options`: オプション（現在未使用）

戻り値:

```javascript
{
    meta: {
        pm_tool: {
            type: 'redmine',
            issue_id: 1234,
            project: { id: 1, name: 'Project Name' },
            // ... その他のメタデータ
        }
    },
    body: 'チケットの説明文',
    title: 'チケットのタイトル'
}
```

### update(config, ticketId, updateData)

Redmineチケット情報を更新する。

パラメータ:

- `config`: Redmine設定オブジェクト
- `ticketId`: チケットID
- `updateData`: 更新データオブジェクト
    - `comment`: コメント
    - `status`: ステータスID
    - `assigned_to`: 担当者ID
    - `done_ratio`: 進捗率
    - `estimated_hours`: 予定工数
    - `start_date`: 開始日
    - `due_date`: 期日
    - `priority`: 優先度ID
    - `category`: カテゴリID

戻り値:

```javascript
{
    success: true,
    message: 'チケット #1234 を更新しました',
    updated: { /* 更新されたフィールド */ }
}
```

トラブルシューティング
-------------------------

### 認証エラー

```
エラー: 認証に失敗しました。APIキーまたはトークンを確認してください
```

対処方法:

1. 環境変数`REDMINE_API_KEY`が正しく設定されているか確認
2. RedmineのAPIキーが有効か確認（Redmine管理画面で再生成）
3. RedmineでREST APIが有効になっているか確認

### ネットワークエラー

```
エラー: ネットワークエラーが発生しました
```

対処方法:

1. Redmine URLが正しいか確認
2. Redmineサーバーにアクセス可能か確認
3. ファイアウォール設定を確認

### チケットが見つからない

```
APIエラー: Not Found
```

対処方法:

1. チケットIDが正しいか確認
2. チケットが削除されていないか確認
3. チケットへのアクセス権限があるか確認
