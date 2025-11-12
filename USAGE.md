MD-Ticket 運用ガイド
=========================

このドキュメントでは、MD-Ticketの運用パターンと実践例を説明します。

運用パターン
-------------------------

### パターン1: スタンドアロン運用

MD-Ticketのみで完結する運用方法です。  
小規模プロジェクトや個人開発に適しています。

#### 特徴

- 軽量・シンプル
- プロジェクト管理ツール不要
- Git管理でチケット履歴を追跡
- AIエージェントとの協業に最適

#### 基本的なワークフロー

1. テンプレートからチケット作成
2. 作業進捗に応じてチケット更新
3. 完了後は削除(必要なものはアーカイブ)

詳細は[README.md](README.md)の「運用方法」セクションを参照してください。

### パターン2: ハイブリッド運用(推奨)

プロジェクト管理ツール(Redmine等)と組み合わせて運用する方法です。

#### 特徴

- 粗粒度管理: プロジェクト管理ツールで大きな機能要件を管理
- 細粒度管理: MD-Ticketで実装タスクの細分化と進捗管理
- チケットログの最適化: 実装詳細はMD-Ticketで管理し、プロジェクト管理ツールは要約のみ
- 不確実性への対処: 段階的な細分化により、変化に柔軟に対応

#### ハイブリッド運用のワークフロー

1. プロジェクト管理ツールから粗粒度チケットを取得
2. 作業プランで実装方針を検討
3. MD-Ticketで詳細タスクに細分化
4. 実装完了後、プロジェクト管理ツールに結果を反映

詳細は後述の「プロジェクト管理ツール連携」セクションを参照してください。

プロジェクト管理ツール連携
-------------------------

### 対応ツール

現在の対応状況:

- Redmine: 完全対応(fetch、update)
- 他ツール: 将来対応予定(プラグイン方式で拡張可能)

### 連携の仕組み

`pm-tool`コマンドを使用して、プロジェクト管理ツールとMD-Ticketを連携します。

#### 主要コマンド

- `pm-tool fetch <チケットID>`: プロジェクト管理ツールからチケット情報を取得
- `pm-tool update <ファイルパス>`: MD-Ticketの内容をプロジェクト管理ツールに反映

### 環境設定

#### 前提条件

`pm-tool`コマンドの実行には[zx](https://google.github.io/zx/setup)が必要です。

```bash
# zxのインストール
npm install -g zx
```

#### 1. 環境変数の設定

認証情報を環境変数で設定します。

```bash
# Redmineの場合
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=your_api_key_here

# Basic認証を使用する場合(APIキーが発行できない場合)
# export REDMINE_USERNAME=your_username
# export REDMINE_PASSWORD=your_password
```

**設定を永続化する場合**:

シェルの設定ファイル(`~/.bashrc`または`~/.zshrc`)に追記します。

```bash
# bashの場合
echo 'export REDMINE_URL=https://redmine.example.com' >> ~/.bashrc
echo 'export REDMINE_API_KEY=your_api_key_here' >> ~/.bashrc

# zshの場合
echo 'export REDMINE_URL=https://redmine.example.com' >> ~/.zshrc
echo 'export REDMINE_API_KEY=your_api_key_here' >> ~/.zshrc
```

**注**: プロジェクトごとに環境変数を設定したい場合は、[direnv](https://direnv.net/)などのツールを利用してください。

#### 2. config.ymlの設定

`.ticket/config.yml`に連携設定を追加します。

```yaml
integration:
  pm_tool:
    type: redmine
    redmine:
      url: ${REDMINE_URL}
      ## 認証方式1: APIキー(推奨)
      api_key: ${REDMINE_API_KEY}
      ## 認証方式2: Basic認証(APIキーが発行できない場合)
      # username: ${REDMINE_USERNAME}
      # password: ${REDMINE_PASSWORD}
```

**注意**: APIキーとBasic認証の両方が設定されている場合、APIキーが優先されます。

#### 3. PATHの設定(推奨)

`pm-tool`を直接実行できるようにPATHを設定します。

```bash
# 現在のシェルセッションのみ有効
export PATH="$PATH:.ticket/_tools"

# 永続化する場合は~/.bashrcまたは~/.zshrcに追記
echo 'export PATH="$PATH:.ticket/_tools"' >> ~/.bashrc
```

### Redmine連携の実践例

#### チケット情報の取得

```bash
# チケットIDを指定して取得
pm-tool fetch 1234

# URLを直接指定(ブラウザからコピペ可能)
pm-tool fetch https://redmine.example.com/issues/1234

# カレントディレクトリにticket-1234.mdが作成される
```

**取得されるファイル形式**:

```markdown
---
id: 1234
project: my-project
tracker: タスク
status: 新規
priority: 通常
author: 山田太郎
assigned_to: 佐藤花子
start_date: 2025-11-01
due_date: 2025-11-15
done_ratio: 0
created_on: 2025-10-25T10:00:00Z
updated_on: 2025-11-01T15:30:00Z
---
ユーザー認証機能の実装
=========================

## 概要

ログイン機能とセッション管理を実装する。

## 要件

- メールアドレスとパスワードでログイン
- セッションの有効期限は24時間
- ログアウト機能
```

**注**:

h1見出し(`ユーザー認証機能の実装`)はプロジェクト管理ツールの`subject`フィールドから生成されます。  
`subject`はYAMLフロントマターには含まれません。

#### チケット情報の更新

```bash
# ファイルパスを指定して更新
pm-tool update ticket-1234.md

# コメントを追加
pm-tool update ticket-1234.md --comment "実装完了しました"

# ドライラン(実際には更新せず、送信内容を確認)
pm-tool update ticket-1234.md --comment "テストコメント" --dry-run
```

**更新される内容**:

YAMLフロントマターから以下のフィールドを抽出して更新します。

- `status`: ステータス(新規、進行中、完了等)
- `assigned_to`: 担当者
- `done_ratio`: 進捗率
- `start_date`: 開始日
- `due_date`: 期日
- `priority`: 優先度
- `notes`: コメント(`--comment`オプションで指定)

本文(h1見出し以降)は`description`として更新されます。

### ハイブリッド運用の実践手順

#### 粗粒度チケットの取得

```bash
# Redmineから大きな機能要件を取得
pm-tool fetch 1234
# → ticket-1234.md が作成される
```

#### 作業プランの作成(推奨)

```bash
# 作業プランファイルを作成
# プロジェクトルートに配置することを推奨
touch workplan-ticket-1234.md

# AIエージェントに作業プランを作成してもらう、または
# 自分で実装方針を箇条書きでまとめる
# - 技術調査
# - タスク分解
# - 設計判断
```

**注**: 作業プランの作成と管理はMD-Ticketの範囲外です。
プロジェクトの必要に応じて自由に管理してください。

#### 詳細タスクへの細分化

```bash
# MD-Ticketのタスクディレクトリに詳細タスクを作成
cp .ticket/_template/task.md .ticket/task/implement-login.md
cp .ticket/_template/task.md .ticket/task/implement-session.md
cp .ticket/_template/task.md .ticket/task/implement-logout.md

# 各タスクに詳細な作業内容を記述
```

#### 実装と進捗管理

```bash
# 各タスクを実装しながら更新
# Git commitでチケット履歴を追跡
```

#### 結果の反映

```bash
# ticket-1234.mdを更新
# - 作業プランの内容を元に実装内容のまとめを追記
# - 完了状態に変更

# プロジェクト管理ツールにチケットの更新内容を反映
pm-tool update ticket-1234.md --comment "実装完了しました"
```

#### クリーンアップ

```bash
# 不要になった詳細タスクファイルを削除
rm .ticket/task/implement-login.md
rm .ticket/task/implement-session.md
rm .ticket/task/implement-logout.md

# 作業プランも役目を終えたため削除
rm workplan-ticket-1234.md
```

参考資料の管理
-------------------------

チケットに関連するファイル(ドラフト、スクリーンショット、設計資料等)は`_files/`ディレクトリで管理します。

### ファイル命名規則

`{チケット名}-{サフィックス}.{拡張子}`形式を推奨します。

例:

- `add-feature-draft.md`: 機能追加チケットのドラフト
- `fix-login-screenshot.png`: ログイン修正のスクリーンショット
- `implement-api-design.drawio`: API実装の設計図

### チケットからのリンク

相対パスでリンクします。

```markdown
## 参考資料

- [要件ドラフト](../_files/add-feature-draft.md)
- [画面モックアップ](../_files/add-feature-mockup.png)
- [設計図](../_files/add-feature-design.drawio)
```

アーカイブ運用
-------------------------

### アーカイブの基本方針

- 基本: チケット完了後は削除
- 例外: 対応内容や参考資料を残したい場合のみアーカイブ
- 保管期間: 2ヶ月程度を目安
- 目的: ゴミファイルの蓄積を避ける

### アーカイブ手順

1. アーカイブ対象チケットを特定
2. チケット種別をプレフィックスとして付与
3. `_archive/YYYY-MM/`に移動
4. 関連する参考資料を`_archive/_files/`に移動

```bash
# 年月ディレクトリを作成(現在の年月で自動生成)
mkdir -p .ticket/_archive/$(date +%Y-%m)

# チケットのアーカイブ
mv .ticket/idea/new-feature.md .ticket/_archive/$(date +%Y-%m)/idea-new-feature.md

# 参考資料のアーカイブ
mv .ticket/_files/new-feature-* .ticket/_archive/_files/
```

### アーカイブ後のディレクトリ構造

```
.ticket/
├ _archive/
│   ├ 2025-10/          (年月別ディレクトリ)
│   │   ├ idea-feature-a.md
│   │   └ bug-login-fix.md
│   ├ 2025-11/
│   │   ├ idea-new-feature.md
│   │   └ task-api-update.md
│   └ _files/           (アーカイブ済みチケットの参考資料)
│       ├ new-feature-screenshot.png
│       └ api-update-spec.md
├ _files/               (アクティブなチケットの参考資料)
├ bug/
├ task/
├ idea/
└ request/
```

### リンクパスの不変性

チケット内の参考資料への相対パス `../_files/xxx` はアーカイブ後も変わりません。

- アーカイブ前: `idea/new-feature.md` → `../_files/new-feature-screenshot.png`
- アーカイブ後: `_archive/2025-11/idea-new-feature.md` → `../_files/new-feature-screenshot.png`

どちらも同じ相対パスで参照可能なため、リンクの書き換えは不要です。

ADR(Architecture Decision Record)の活用
-------------------------

重要な技術的決定や設計判断は、ADRとして記録します。

### ADRの作成

```bash
# テンプレートからADRを作成
cp .ticket/_template/adr.md .ticket/_shared/adr/001-database-selection.md
```

### ADRの構造

```markdown
ADR-001: データベース選択
=========================

ステータス
-------------------------

採用

コンテキスト
-------------------------

新規プロジェクトでのデータベース選択が必要。

決定
-------------------------

PostgreSQLを採用する。

理由
-------------------------

- ACID特性の完全なサポート
- JSONBによる柔軟なデータ構造
- 豊富な拡張機能

結果
-------------------------

- 開発効率の向上
- データ整合性の保証
- 将来の拡張性確保
```

### チケットからADRへのリンク

```markdown
## 関連ADR

- [ADR-001: データベース選択](../_shared/adr/001-database-selection.md)
```

トラブルシューティング
-------------------------

### チケットが見つからない(404エラー)

```
チケット #999999 が見つかりません (404 Not Found)
```

対処方法:

- チケットIDが正しいか確認
- チケットが削除されていないか確認

### 認証に失敗する(401エラー)

```
認証に失敗しました。APIキーまたはトークンを確認してください
```

対処方法:

- APIキーが正しいか確認
- 環境変数が正しく設定されているか確認
- 環境変数を再設定: `export REDMINE_API_KEY=your_api_key_here`

### pm-toolが見つからない

```bash
# PATHを確認
echo $PATH

# PATHに.ticket/_toolsを追加
export PATH="$PATH:.ticket/_tools"

# 永続化する場合は~/.bashrcまたは~/.zshrcに追記
echo 'export PATH="$PATH:.ticket/_tools"' >> ~/.bashrc
```

### 環境変数が読み込まれない

```bash
# 環境変数を設定
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=your_api_key_here

# 環境変数を確認
echo $REDMINE_URL
echo $REDMINE_API_KEY

# 永続化する場合は~/.bashrcまたは~/.zshrcに追記
echo 'export REDMINE_URL=https://redmine.example.com' >> ~/.bashrc
echo 'export REDMINE_API_KEY=your_api_key_here' >> ~/.bashrc
```

### APIキーが無効

```bash
# APIキーを確認
# Redmine: 個人設定 → APIアクセスキー

# 環境変数を更新
export REDMINE_API_KEY=new_api_key_here
```

ベストプラクティス
-------------------------

### チケット管理

- チケットは小さく保つ(1-2日で完了する粒度)
- 関連チケットは明示的にリンク
- 完了後は速やかに削除またはアーカイブ

### プロジェクト管理ツール連携

- fetchは必要最小限に(頻繁に取得しない)
- updateは実装完了時に1回だけ
- コメントは簡潔に(詳細は作業プランに記録)

### 参考資料管理

- ファイル名は規則的に(チケット名をプレフィックス)
- 不要になったファイルは削除
- アーカイブ時は関連ファイルも一緒に移動

### AIエージェント協業

- プロジェクトルートの`AGENTS.md`にチケット管理情報を統合
- テンプレートを活用してチケット作成を依頼
- 作業プランでAIとの協業を記録

詳細は[AGENTS.md](AGENTS.md)を参照してください。

参考リンク
-------------------------

- [README.md](README.md): 導入方法と基本的な運用方法
- [AGENTS.md](AGENTS.md): AIエージェント向けガイドライン
- [LICENSE](LICENSE): MITライセンス
- [GitHub Repository](https://github.com/wate/MD-Ticket): 最新版とissue報告
