MD-Ticket 運用ガイド
=========================

このドキュメントでは、MD-Ticketの運用パターンと実践例を説明します。

運用パターン
-------------------------

### スタンドアロン運用

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

### プロジェクト管理ツールとの併用

既存のRedmine/Backlog等と併用し、MD-Ticketをローカルの作業層として使うこともできます。
ただし連携方式(MCPサーバー経由、CLI、手動同期など)はプロジェクトごとに異なるため、本ガイドでは具体手順を規定しません。
連携が必要な場合は、方式・設定ともプロジェクト側で定義してください。

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

親子チケットの運用
-------------------------

子チケットが必要になった場合、親チケットと同名のサブディレクトリを作成して子チケットを格納します。
参考資料は子チケットであっても`_files/`で一元管理します。

### ディレクトリ構造の例

```
.ticket/
├ task/
│   ├ migrate-database.md                     # 親チケット
│   ├ migrate-database/                       # 子チケット用サブディレクトリ
│   │   ├ schema-update.md
│   │   ├ data-migration.md
│   │   └ rollback-plan.md
│   └ standalone-task.md                      # 独立チケット(従来通り)
├ _files/
│   ├ migrate-database-design.md              # 親チケットの参考資料
│   └ standalone-task-draft.md
```

### 親チケットからのリンク

親チケットの本文に子チケットへのリンクを記載します。

```markdown
## 子チケット

- [スキーマ更新](migrate-database/schema-update.md)
- [データ移行](migrate-database/data-migration.md)
```

### 子チケットからのリンク

子チケットから親チケットへのリンクを記載します。

```markdown
## 親チケット

- [DB移行](../migrate-database.md)
```

### 参考資料のリンク

子チケットから`_files/`内の参考資料を参照する場合、相対パスは2階層上がります。

```markdown
## 参考資料

- [設計メモ](../../_files/migrate-database-design.md)
```

### 適用基準

- 子チケットが2つ以上ある場合にサブディレクトリ化を推奨します
- 子チケットが1つの場合はフラット配置でも構いません
- 既存チケットは新規作成時から段階的に適用します(一括移行は不要)

アーカイブ運用
-------------------------

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
---------------------------------------

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
