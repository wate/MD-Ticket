MD-Ticket
=========================

軽量なテキストベースのチケット管理の仕組みです。  
プロジェクト管理ツールを使うほどでもないアイデアやタスクをMarkdownで記録します。

この仕組みはシンプルさを重視しています。  
チケットを分類し、テンプレートを使い、必要に応じて更新・削除・ADR化することで、
小規模プロジェクトでも継続的に整然とした記録が保てます。

導入方法
-------------------------

### インストール

```bash
# ワンライナーでインストール
curl -fsSL https://raw.githubusercontent.com/wate/MD-Ticket/master/install.sh | bash

# カスタムディレクトリにインストール
TICKET_DIR=.custom curl -fsSL https://raw.githubusercontent.com/wate/MD-Ticket/master/install.sh | bash

# または
curl -fsSL https://raw.githubusercontent.com/wate/MD-Ticket/master/install.sh | bash -s -- --dir=.custom

# 既存環境を最新版に更新(テンプレート・ドキュメントのみ上書き)
curl -fsSL https://raw.githubusercontent.com/wate/MD-Ticket/master/install.sh | bash -s -- --force

# developブランチからインストール
curl -fsSL https://raw.githubusercontent.com/wate/MD-Ticket/master/install.sh | bash -s -- --branch=develop

# 手動インストール
git clone https://github.com/wate/MD-Ticket.git
cp -r MD-Ticket/.ticket /path/to/your/project/
rm -rf MD-Ticket
```

#### オプション

- `--dir=DIR` または `-d DIR`: インストール先ディレクトリ指定 (デフォルト: `.ticket`)
- `--branch=BRANCH` または `-b BRANCH`: ダウンロード元ブランチ指定 (デフォルト: `master`)
- `--force` または `-f`: 既存環境を上書き更新(既存チケットは保持)
- `--help` または `-h`: ヘルプ表示

#### 環境変数

- `TICKET_DIR`: インストール先ディレクトリ (`--dir`オプションで上書き可能)
- `TICKET_BRANCH`: ダウンロード元ブランチ (`--branch`オプションで上書き可能)

### AGENTS.md統合 (重要)

**AIエージェント(GitHub Copilot、Claude、ChatGPTなど)と連携する場合は必須です。**

プロジェクトルートの`AGENTS.md`にチケット管理情報を統合してください。
詳細は後述の「AGENTS.md統合ガイド」を参照してください。

ディレクトリ構造
-------------------------

```
.ticket/
  ├ README.md      => このファイル
  ├ AGENTS.md      => エージェント向けガイドライン
  ├ LICENSE        => MITライセンス
  ├ config.yml     => チケット種別の設定ファイル(任意)
  ├ _archive/      => アーカイブ済みチケットを年月別に保存するディレクトリ
  │  └ _files/        => アーカイブ済みチケットの参考資料を格納するディレクトリ
  ├ _files/        => チケットに関連する参考資料を格納するディレクトリ
  ├ _shared/       => チケット文脈で参照される情報やADRなどの共有リソースを格納するディレクトリ
  │  └ adr/           => ADR(Architecture Decision Record)を格納するサブディレクトリ
  ├ _template/     => 各ファイルのテンプレートを格納するディレクトリ
  │  ├ adr.md         => ADR(Architecture Decision Record)のテンプレートファイル
  │  ├ bug.md         => 不具合報告のテンプレートファイル
  │  ├ idea.md        => アイデアのテンプレートファイル
  │  ├ request.md     => 要望のテンプレートファイル
  │  └ task.md        => タスクのテンプレートファイル
  ├ bug/          => 不具合報告ファイルを格納するディレクトリ
  ├ idea/         => アイデアファイルを格納するディレクトリ
  ├ request/      => 要望ファイルを格納するディレクトリ
  └ task/         => タスクファイルを格納するディレクトリ
```

運用方法
-------------------------

1. チケット作成
   - `_template/` から種別に合ったテンプレートをコピー  
     例: `cp _template/task.md task/add-feature.md`
   - 必須項目を埋め、不明点は記入せず確認する  
   - 内容に応じて以下のディレクトリに保存  
     - アイデア -> `idea/`  
     - 要望 -> `request/`  
     - タスク -> `task/`  
     - バグ -> `bug/`
2. 更新・整理
   - 追加情報があれば既存チケットを直接更新  
   - 状況に応じてディレクトリを移動(例: アイデア→タスク)  
     例: `mv request/add-feature.md task/add-feature.md`
   - 完了・不要になったチケットは削除または必要に応じてアーカイブ  
3. チケットのクローズ
   - 完了したチケットは基本的に削除する
   - 対応内容や参考資料を残したい場合はアーカイブに保存
   - アーカイブは後述の「アーカイブ手順」を参照
4. 関連管理
   - 関連チケットは本文下部にMarkdownリンクで記載  
     例: `関連チケット: [task/add-feature.md](../task/add-feature.md)`
5. ADR・共有情報
   - 重要な判断は `_shared/adr/` にADRとして記録  
   - 共通メモや用語集は `_shared/` に配置  
6. 参考資料の管理
   - チケットに関連するファイル(ドラフト、スクリーンショット、参考資料等)は `_files/` に配置  
   - ファイル名は `{ticket-name}-{suffix}.{ext}` 形式を推奨  
     例: `add-feature-draft.md`, `fix-login-screenshot.png`  
   - 複数ファイルがある場合はサフィックスで区別  
     例: `add-feature-draft-requirements.md`, `add-feature-draft-design.md`  
   - チケット本文から相対パスでリンク  
     例: `[ドラフト](_files/add-feature-draft.md)`  
7. Git管理 (任意)
   - Gitを利用すれば履歴追跡と復元が可能  
   - 個人プロジェクトなどの場合は非Gitでも運用可  

テンプレートを用いてチケットを分類・作成し、成熟度に応じて移動・削除する。  
重要な決定はADR化し、関連チケットを明示して管理する。

種別について
-------------------------

| 種別     | 内容                 | 最低限含む項目                  |
| -------- | -------------------- | ------------------------------- |
| アイデア | 発想・構想段階のメモ | きっかけ・概要                  |
| 要望     | 実現してほしい希望   | 概要・背景                      |
| タスク   | 実行すべき作業       | 前提・内容・背景                |
| バグ     | 不具合の報告         | 現象・再現手順・期待する動作    |

設定ファイル(任意)
-------------------------

チケット種別をカスタマイズしたい場合、`.ticket/config.yml`で管理できます。  
設定ファイルがない場合はデフォルトの4種別(bug/task/idea/request)が使用されます。

詳細な設定方法やカスタム種別の追加例は[AGENTS.md](AGENTS.md)を参照してください。

アーカイブ手順
-------------------------

完了したチケットのうち、残しておきたいものを年月別にアーカイブできます。

### アーカイブのタイミング

- 基本方針: チケット完了後は削除が基本
- アーカイブ対象: 完了後も対応内容や参考資料を残しておきたい場合のみ
- 保管期間目安: 2ヶ月程度まで(長期保存は想定していない)
- オプション的な位置づけ: 必要なものだけをアーカイブし、ゴミファイルの蓄積を避ける

### アーカイブ手順

1. アーカイブ対象チケットを特定
2. チケット種別をプレフィックスとして付与し、チケットファイルを `_archive/YYYY-MM/` に移動
    - 例: `idea/new-feature.md` → `_archive/2024-11/idea-new-feature.md`
3. 関連する参考資料を `_files/` から `_archive/_files/` に移動
4. 必要に応じて年月ディレクトリを作成

### アーカイブ構造

```
.ticket/
├ _archive/
│   ├ 2024-11/          (年月別ディレクトリ)
│   │   ├ idea-new-feature.md
│   │   └ bug-auth-fix.md
│   └ _files/           (アーカイブ済みチケットの参考資料)
│       ├ new-feature-screenshot.png
│       └ auth-fix-log.txt
├ _files/               (アクティブなチケットの参考資料)
├ bug/
├ task/
├ idea/
└ request/
```

### リンクパスの不変性

チケット内の参考資料への相対パス `../_files/xxx` はアーカイブ後も変わりません。

- アーカイブ前: `idea/new-feature.md` → `../_files/new-feature-draft.md`
- アーカイブ後: `_archive/2024-11/idea-new-feature.md` → `../_files/new-feature-draft.md`

どちらも同じ相対パスで参照可能なため、リンクの書き換えは不要です。

AGENTS.md統合ガイド
-------------------------

**重要**: AIエージェント(GitHub Copilot、Claude、ChatGPTなど)がMD-Ticketの存在と使い方を認識できるようにするため、プロジェクトルートの`AGENTS.md`にチケット管理情報を統合することを強く推奨します。

### 統合の必要性

AIエージェント(GitHub Copilot、Claude、ChatGPT等)は、プロジェクトルートの指示ファイルを優先的に参照します。`.ticket/`配下のドキュメントのみでは、AIがMD-Ticketの存在を認識できず、誤った場所にチケットを作成したり、チケット管理機能を利用できない可能性があります。

### 統合方法

プロジェクトルートの`AGENTS.md`に以下のセクションをコピー&ペーストしてください。

```markdown
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
```

### 統合後の確認

1. AIエージェントで動作確認(チケット作成依頼をして正しい場所に作成されるか)
2. 統合した内容がプロジェクトの他のガイドラインと矛盾しないか確認

ライセンス
-------------------------

MIT License - 詳細は[LICENSE](LICENSE)を参照してください。
