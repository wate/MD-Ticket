GitHub Issue連携
=========================

[課題管理ツール連携ガイド](../issue-tracker-integration.md)の取り決めを、GitHubのIssueに当てはめるときの内容です。
対象はIssueだけで、プルリクエストは対象外です。

識別子の形式
-------------------------

- `system`: `github`
- `id`: `{owner}/{repo}#{Issue番号}`(例: `'example-org/example-repo#45'`)
- `url`: `https://github.com/{owner}/{repo}/issues/{Issue番号}`

Issue番号はリポジトリの中でだけ一意のため、`id`にはオーナーとリポジトリを含めます。
sub-issuesと依存関係の操作では、Issue番号ではなくIssueの数値のIDを指定します。

更新日時
-------------------------

Issueの`updated_at`(ISO 8601)を、`external`の`updated_at`に記録します。
反映前の競合の確認では、連携先の`updated_at`と`external`の`updated_at`を比べます。
反映後は、連携先の`updated_at`を取得し直して記録します。

項目の対応
-------------------------

### 説明欄の記法

説明欄の記法はGitHub Flavored Markdownです。
MD-Ticketの本文は、変換せずにそのまま反映できます。

### 管理項目

- ステータス: `state`(`open`・`closed`)
- 担当者: `assignees`(複数人を指定できます)
- 優先度: 標準の項目はなく、ラベルやProjectsのフィールドで代替します
- 期日: 標準の項目はなく、マイルストーンやProjectsのフィールドで代替します
- 種別: ラベル、またはOrganizationで設定したissue types

優先度・期日・種別をどの仕組みで表すかは、リポジトリの運用に合わせて利用者が決めます。

### 終了扱い

`state`が`closed`のIssueを、終了扱いとします。
終了の理由は、`state_reason`(`completed`・`not_planned`・`duplicate`)で表します。
`duplicate`で終了するときは、重複先のIssueも指定します。
MD-Ticketからクローズを反映するときは、どの理由にするかをユーザーへ確認します。

コメント
-------------------------

コメントは、Issueのコメントとして取得と追記ができます。
状態の変更とコメントの追記は、別々の操作として行います。

関連と親子
-------------------------

- 親子: sub-issuesで表します(1つの親に100件まで、8階層まで)
- 依存関係: issue dependenciesの「blocked by」「blocking」で表します

GitHubには汎用の関連がないため、MD-Ticketの関連種別は次のように対応させます。

- 関連: 対応する種別がないため、説明欄またはコメントに関連先のIssueへのリンクを書きます
- 前提:「blocked by」(関連先の完了を待つ)で表します
- 派生: 対応する種別がないため、説明欄またはコメントに派生元のIssueへのリンクを書きます
- 重複: `state_reason`を`duplicate`にして終了し、重複先を指定します

添付ファイル
-------------------------

添付ファイルのためのAPIはありません。
ファイルは、GitHubの画面やCLIで説明欄・コメントへ添付し、URLとして本文に埋め込まれます。
取り込むときは、説明欄やコメントに埋め込まれたURLからファイルを取得します。
容量の上限は、画像10MB、動画10MB(有料プランでは100MB)、その他のファイル25MBです。

公開リポジトリでは、添付したファイルを認証なしで誰でも閲覧できます。
公開リポジトリへ添付するときは、機密情報を含まないことを確かめます。

接続情報
-------------------------

- 接続先: オーナーとリポジトリ(`{owner}/{repo}`)を、設定ファイルに書きます
- 秘密情報: personal access tokenまたはGitHub Appの認証情報を、環境変数または連携手段の認証の仕組みに置きます

GitHub Enterprise Serverを使う場合は、APIのURLも設定ファイルに書きます。
personal access tokenは、Issueの読み書きに必要な権限だけを付けて発行します。

参考情報
-------------------------

GitHubの提供元が公開している手段です。
保守が続く保証はないため、例として載せています。

- [REST API endpoints for issues](https://docs.github.com/en/rest/issues/issues): Issueの取得・作成・更新、`state_reason`
- [REST API endpoints for issue comments](https://docs.github.com/en/rest/issues/comments): コメントの取得・追加
- [REST API endpoints for sub-issues](https://docs.github.com/en/rest/issues/sub-issues): sub-issuesの取得・追加
- [REST API endpoints for issue dependencies](https://docs.github.com/en/rest/issues/issue-dependencies): 依存関係の取得・追加
- [Attaching files](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files): 添付ファイルと容量の上限
- [GitHub MCP Server](https://github.com/github/github-mcp-server): MCPクライアントからIssue・コメント・sub-issuesを操作するMCPサーバー
- [GitHub CLI](https://cli.github.com/): GitHubをコマンドラインで操作するCLI
