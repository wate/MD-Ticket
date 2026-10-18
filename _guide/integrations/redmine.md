Redmine連携
=========================

[課題管理ツール連携ガイド](../issue-tracker-integration.md)の取り決めを、Redmineに当てはめるときの内容です。

識別子の形式
-------------------------

- `system`: `redmine`
- `id`: チケット番号(例: `'123'`)
- `url`: `{RedmineのURL}/issues/{チケット番号}`

チケット番号はRedmine全体で一意のため、`id`にプロジェクトを含める必要はありません。

更新日時
-------------------------

チケットの`updated_on`(ISO 8601)を、`external`の`updated_at`に記録します。
反映前の競合の確認では、連携先の`updated_on`と`updated_at`を比べます。
反映後は、`updated_on`を取得し直して記録します。

項目の対応
-------------------------

### 説明欄の記法

説明欄の記法は、管理画面の「テキスト書式」の設定で決まります。
Markdown系の書式が設定されている場合は、MD-Ticketの本文をそのまま反映できます。
Textileが設定されている場合は、反映前にTextileへ変換するか、変換せずに反映してよいかをユーザーへ確認します。

### 管理項目

- ステータス: `status`(更新時は`status_id`)
- 担当者: `assigned_to`(更新時は`assigned_to_id`)
- 優先度: `priority`(更新時は`priority_id`)
- 期日: `due_date`
- 種別: トラッカー`tracker`(更新時は`tracker_id`)

トラッカーとMD-Ticketの種別との対応は、プロジェクトのトラッカーの設定に合わせて利用者が決めます。

### 終了扱い

ステータスごとの「終了したチケット」の設定(APIでは`is_closed`)が有効なステータスを、終了扱いとします。
Redmineは終了の理由を別の項目で持たず、完了・却下など終了扱いのステータスを使い分けて表します。
MD-Ticketからクローズを反映するときは、終了扱いのステータスのうちどれにするかをユーザーへ確認します。

コメント
-------------------------

Redmineのコメントは、チケットの履歴(journals)に記録される注記(`notes`)です。
取得するときは、チケットを履歴付きで取得し、`notes`が空でない履歴をコメントとして扱います。
追記するときは、チケットの更新で`notes`を指定します。
ステータスの変更とコメントの追記は、1回の更新で同時に行えます。

関連と親子
-------------------------

- 親子: 親チケット(`parent_issue_id`)で表します
- 関連: 関連するチケット(relations)で表します

MD-Ticketの関連種別は、次の関連に対応させます。

- 関連: `relates`
- 前提: 作業の順番を表す場合は`follows`(関連先の後に行う)、完了の条件を表す場合は`blocked`(関連先の完了を待つ)
- 派生: 関連先をコピーして作った場合は`copied_from`
- 重複: `duplicates`

Redmineは4つの関連種別すべてに対応する関連を持つため、代替の書き方は要りません。
`precedes`・`follows`を設定すると、Redmineの設定によっては開始日や期日が自動で調整されます。
日付を反映した後は、Redmine側の確定した値を取得し直します。

添付ファイル
-------------------------

添付ファイルは、取得と追加の両方ができます。
添付ファイルの一覧はチケットと一緒に取得でき、各ファイルはダウンロード用のURLから取得します。
追加するときは、ファイルをアップロードして得たトークンを、チケットの作成・更新時に指定します。
容量の上限は管理画面の「添付ファイルサイズの上限」で決まり、既定は5120KiBです。

接続情報
-------------------------

- 接続先: RedmineのURLと既定のプロジェクト識別子を、設定ファイルに書きます
- 秘密情報: APIキーを、環境変数または連携手段の認証の仕組みに置きます

APIを使うには、管理画面でREST APIを有効にする必要があります。
APIキーは、各ユーザーの個人設定の画面で確認できます。
APIキーは、HTTPヘッダー`X-Redmine-API-Key`で渡すのが基本です。

参考情報
-------------------------

連携手段の例です。
保守が続く保証はないため、本文の手順はこれらに依存させていません。

### Redmine公式

- [Rest api](https://www.redmine.org/projects/redmine/wiki/Rest_api): REST APIの概要、認証、添付ファイルのアップロード
- [Rest Issues](https://www.redmine.org/projects/redmine/wiki/Rest_Issues): チケットの取得・作成・更新
- [Rest IssueRelations](https://www.redmine.org/projects/redmine/wiki/Rest_IssueRelations): 関連の取得・作成
- [Rest IssueStatuses](https://www.redmine.org/projects/redmine/wiki/Rest_IssueStatuses): ステータスの一覧と`is_closed`
- [Rest Attachments](https://www.redmine.org/projects/redmine/wiki/Rest_Attachments): 添付ファイルの取得

2026年10月時点で、Redmine公式のMCPサーバーやCLIは確認できていません。

### サードパーティー製

Redmineはオープンソースで、本体の開発チームはMCPサーバーやCLIを提供していません。
そのため、継続して保守されているサードパーティー製のプラグインを例として載せています。

- [`redmine_ai_helper`](https://github.com/haru/redmine_ai_helper): RedmineをMCPサーバーとして公開できるプラグインで、チケットの取得・検索・作成・更新とコメントの追記に対応します(サードパーティー製)
    - 前提: Redmine 6.0以上で、Redmineのサーバーへの導入と管理画面での「MCP Server」の有効化が必要です
    - 認証: MCPクライアントからRedmineのAPIキーを`X-Redmine-API-Key`ヘッダーで渡します
    - 注意: LLMを使う機能も含むため、導入前に組織のAI利用のルールと照らし合わせます
