pm-tool プラグイン開発ガイド
=========================

このドキュメントは、pm-toolの新規プラグインを開発する開発者向けのガイドです。

**利用者向けのドキュメントは[USAGE.md](../../USAGE.md)を参照してください。**

概要
-------------------------

pm-toolは、MD-Ticketとプロジェクト管理ツール(Redmine、Backlog、GitHub Issue等)を連携するためのCLIツールです。
プラグイン方式により、複数のプロジェクト管理ツールに対応可能な拡張性の高い設計になっています。

対応ツール
-------------------------

- [x] [Redmine](https://www.redmine.org/)
- [x] [Backlog](https://backlog.com/)
- [ ] [GitHub Issue](https://github.co.jp/)
- [ ] [Jira](https://www.atlassian.com/ja/software/jira)

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
      │  ├ redmine/    # Redmineプラグイン
      │  │  ├ index.js # プラグインエントリーポイント
      │  │  ├ fetch.js # チケット取得
      │  │  ├ update.js# チケット更新
      │  │  └ README.md# プラグインドキュメント
      │  └ backlog/    # Backlogプラグイン
      │     ├ index.js # プラグインエントリーポイント
      │     ├ fetch.js # 課題取得
      │     ├ update.js# 課題更新
      │     └ README.md# プラグインドキュメント
      └ README.md      # このファイル
```

### プラグイン方式

各プロジェクト管理ツールは独立したプラグインとして実装されます。
プラグインは共通インターフェースを実装することで、CLIから統一的に呼び出せます。

プラグイン共通インターフェース:

```javascript
export default {
    name: 'tool-name',        // プラグイン名(config.ymlのtypeと一致)
    label: 'Tool Name',       // 表示名
    
    /**
     * チケット情報を取得
     * @param {Object} config - ツール固有の設定(config.ymlから取得)
     * @param {string} ticketId - チケットID
     * @param {Object} options - 取得オプション(--stdout, --json等)
     * @returns {Promise<{meta: Object, body: string, title: string}>}
     */
    async fetch(config, ticketId, options) {
        // チケット取得処理
        return { 
            meta: { /* YAMLフロントマター用のメタデータ */ },
            body: '本文内容',
            title: 'チケットタイトル'
        };
    },
    
    /**
     * チケット情報を更新
     * @param {Object} config - ツール固有の設定
     * @param {string} ticketId - チケットID
     * @param {Object} updateData - 更新データ(CLIオプションから生成)
     * @returns {Promise<{success: boolean, message: string, updated: Object}>}
     */
    async update(config, ticketId, updateData) {
        // チケット更新処理
        return { 
            success: true, 
            message: '更新成功',
            updated: { /* 更新された項目 */ }
        };
    },
    
    /**
     * 設定を検証
     * @param {Object} config - ツール固有の設定
     * @returns {Promise<{valid: boolean, errors: string[]}>}
     */
    async validate(config) {
        // 設定検証(必須項目チェック等)
        return { valid: true, errors: [] };
    },
    
    /**
     * フロントマターからチケットIDを抽出
     * @param {Object} frontmatter - YAMLフロントマター
     * @returns {string|null} チケットID
     */
    extractTicketId(frontmatter) {
        // プラグイン固有のフィールド名からIDを抽出
        return frontmatter.id || frontmatter.issue_key || null;
    }
};
```

### 共通ユーティリティ

プラグイン実装では、以下の共通ユーティリティを活用できます。

#### API呼び出し(`common/api.js`)

```javascript
import { callApi } from '../../common/api.js';

// 基本的な使い方
const response = await callApi(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
});

// 自動リトライ付き
const response = await callApi(url, options, {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
});
```

#### リトライ処理(`common/retry.js`)

```javascript
import { withRetry } from '../../common/retry.js';

// 任意の処理にリトライを適用
const result = await withRetry(
    async () => {
        // リトライ対象の処理
        return await someApiCall();
    },
    {
        maxRetries: 3,
        shouldRetry: (error) => error.statusCode === 429 || error.statusCode >= 500
    }
);
```

#### エラークラス(`common/error.js`)

```javascript
import {
    ConfigError,
    AuthenticationError,
    ApiError,
    NetworkError,
    ValidationError
} from '../../common/error.js';

// 適切なエラークラスを使用
if (!config.api_key) {
    throw new ConfigError('APIキーが設定されていません');
}

if (response.status === 401) {
    throw new AuthenticationError('認証に失敗しました');
}

if (response.status === 404) {
    throw new ApiError('チケットが見つかりません', 404);
}
```

#### ロギング(`common/logger.js`)

```javascript
import { debug, info, warn, error } from '../../common/logger.js';

// 環境変数PM_TOOL_LOG_LEVELで制御可能
debug('詳細なデバッグ情報', { ticketId, config });
info('チケット取得開始', { ticketId });
warn('非推奨APIを使用しています');
error('チケット取得に失敗', { error });
```

プラグイン開発手順
-------------------------

### 1. ディレクトリ作成

```bash
mkdir -p .ticket/_tools/lib/pm-tool/plugins/{tool-name}
cd .ticket/_tools/lib/pm-tool/plugins/{tool-name}
```

### 2. プラグインファイル作成

以下のファイルを作成します。

- `index.js`: エントリーポイント(共通インターフェース実装)
- `fetch.js`: チケット取得ロジック
- `update.js`: チケット更新ロジック
- `README.md`: プラグイン固有ドキュメント

### 3. index.jsの実装

```javascript
#!/usr/bin/env zx

import { fetchTicket } from './fetch.js';
import { updateTicket } from './update.js';
import { debug } from '../../common/logger.js';
import { ConfigError } from '../../common/error.js';

export default {
    name: 'your-tool',
    label: 'Your Tool',
    
    async fetch(config, ticketId, options) {
        debug(`${this.label}プラグイン: チケット取得開始`, { ticketId });
        return await fetchTicket(config, ticketId, options);
    },
    
    async update(config, ticketId, updateData) {
        debug(`${this.label}プラグイン: チケット更新開始`, { ticketId });
        return await updateTicket(config, ticketId, updateData);
    },
    
    async validate(config) {
        const errors = [];
        
        if (!config.url) {
            errors.push('URLが設定されていません');
        }
        if (!config.api_key && !config.token) {
            errors.push('認証情報が設定されていません');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    extractTicketId(frontmatter) {
        // プラグイン固有のID抽出ロジック
        return frontmatter.id || frontmatter.issue_key || null;
    }
};
```

### 4. fetch.jsの実装

```javascript
import { callApi } from '../../common/api.js';
import { info, debug } from '../../common/logger.js';
import { ApiError, AuthenticationError } from '../../common/error.js';

export async function fetchTicket(config, ticketId, options) {
    info('チケット取得', { ticketId });
    
    const url = `${config.url}/api/v1/issues/${ticketId}`;
    const headers = {
        'Authorization': `Bearer ${config.api_key}`,
        'Content-Type': 'application/json'
    };
    
    try {
        const response = await callApi(url, { method: 'GET', headers });
        const issue = await response.json();
        
        // YAMLフロントマター用のメタデータを構築
        const meta = {
            id: issue.id,
            project: issue.project.name,
            status: issue.status.name,
            priority: issue.priority.name,
            author: issue.author.name,
            // ... 他のフィールド
        };
        
        // Markdown本文を構築
        const body = issue.description || '';
        
        // タイトルを抽出
        const title = issue.subject;
        
        return { meta, body, title };
    } catch (error) {
        if (error.statusCode === 401 || error.statusCode === 403) {
            throw new AuthenticationError('認証に失敗しました');
        }
        if (error.statusCode === 404) {
            throw new ApiError(`チケット ${ticketId} が見つかりません`, 404);
        }
        throw error;
    }
}
```

### 5. update.jsの実装

```javascript
import { callApi } from '../../common/api.js';
import { info, debug } from '../../common/logger.js';
import { ApiError } from '../../common/error.js';

export async function updateTicket(config, ticketId, updateData) {
    info('チケット更新', { ticketId, updateData });
    
    const url = `${config.url}/api/v1/issues/${ticketId}`;
    const headers = {
        'Authorization': `Bearer ${config.api_key}`,
        'Content-Type': 'application/json'
    };
    
    // プロジェクト管理ツール固有の形式に変換
    const payload = {
        issue: {
            notes: updateData.comment,
            status_id: updateData.status,
            // ... 他のフィールドマッピング
        }
    };
    
    const response = await callApi(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
    });
    
    return {
        success: response.ok,
        message: response.ok ? 'チケットを更新しました' : '更新に失敗しました',
        updated: updateData
    };
}
```

### 6. README.mdの作成

プラグイン固有の情報を記載します。

- API仕様とエンドポイント
- 認証方式
- フィールドマッピング
- 制限事項や注意点

参考: [RedmineプラグインのREADME](plugins/redmine/README.md)、[BacklogプラグインのREADME](plugins/backlog/README.md)

### 7. Rolldownビルド設定

`.ticket/rolldown.config.mjs`にプラグインのバンドル設定を追加します。

```javascript
export default defineConfig([
    // ... 既存の設定 ...
    
    // 新規プラグイン(独立バンドル)
    {
        input: '_tools/lib/pm-tool/plugins/your-tool/index.js',
        output: {
            file: '_tools/lib/pm-tool/plugins/your-tool.mjs',
            format: 'esm',
        },
        external: ['zx'],
        resolve: {
            extensions: ['.js'],
        },
    },
]);
```

### 8. テストとデバッグ

```bash
# デバッグログを有効化
export PM_TOOL_LOG_LEVEL=DEBUG

# ビルド
cd .ticket
npm run build

# 動作確認
pm-tool fetch 1234
pm-tool update ticket-1234.md --comment "テスト"
```

エラーハンドリング
-------------------------

### エラータイプ

プラグイン実装では、適切なエラークラスを使用してください。

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

コーディング規約
-------------------------

### 基本方針

- zxの組み込みモジュール(`fs`, `path`, `chalk`等)は明示的にインポートしない
- `fs.readFileSync()`, `path.resolve()`のように`fs.`、`path.`プレフィックスを使用
- エラーメッセージは日本語で明確に
- ログ出力は`common/logger.js`を使用
- 非同期処理は必ずasync/awaitを使用

### ファイル構成

```javascript
#!/usr/bin/env zx

// 外部モジュールのインポート(zx組み込み以外)
import somePackage from 'some-package';

// 相対インポート
import { helper } from './helper.js';
import { callApi } from '../../common/api.js';
import { info } from '../../common/logger.js';

// 関数定義
export async function myFunction() {
    // 実装
}
```

デバッグ
-------------------------

### デバッグログの有効化

```bash
PM_TOOL_LOG_LEVEL=DEBUG pm-tool fetch 1234
```

### よくある問題

#### プラグインが読み込まれない

- `.ticket/config.yml`の`type`とプラグインの`name`が一致しているか確認
- ビルドが正常に完了しているか確認(`cd .ticket && npm run build`)

#### API呼び出しエラー

- 環境変数が正しく設定されているか確認
- URLの形式が正しいか確認(末尾のスラッシュ等)
- APIキーの権限が適切か確認

参考資料
-------------------------

### 既存プラグイン

- [Redmineプラグイン](plugins/redmine/): REST API v2対応、APIキー/Basic認証
- [Backlogプラグイン](plugins/backlog/): REST API v2対応、APIキー認証

### 外部ドキュメント

- [zx公式ドキュメント](https://google.github.io/zx/): zxの使い方
- [Rolldown](https://rolldown.rs/): バンドラーの使い方

ライセンス
-------------------------

このツールはMD-Ticketプロジェクトの一部です。
