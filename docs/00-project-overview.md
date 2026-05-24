# Project Overview

## 概要

GBF Artifact Tool は、Granblue Fantasy のアーティファクトを管理するための Chrome Extension です。

アーティファクト一覧 API から取得した JSON をローカルに保存し、管理画面で集計・評価・CSV 出力を行います。

## 基本方針

### 採用

- API 取得方式
- ユーザー操作によるページ遷移
- 拡張機能による読み取り専用 GET
- 専用管理画面 `dashboard.html`
- ローカル保存

### 非採用

- DOM 中心のスクレイピング
- 自動ページ送り
- ゲーム画面への UI 挿入
- ゲーム画面操作
- 外部サーバー送信

## アプリケーションモード

### scan

ユーザーが GBF のアーティファクトページを手動で遷移し、拡張機能が現在ページの API レスポンスを取得します。

責務:

- 現在ページの取得
- 取得済みページの記録
- アーティファクトデータの保存
- スキャン進捗の表示

禁止:

- ページ遷移の自動操作
- next を自動で辿る処理
- ゲーム画面のクリックや入力

### manage

ローカル保存済みアーティファクトを管理します。

責務:

- 一覧表示
- フィルタ
- ソート
- スコアルール設定
- 独自スコア計算
- 必要 / 不要チェック
- CSV 出力

## 推奨リポジトリ構成

```txt
gbf-artifact-tool/
├─ README.md
├─ package.json
├─ manifest.json
├─ docs/
│  ├─ 00-project-overview.md
│  ├─ 01-requirements.md
│  ├─ 02-architecture.md
│  ├─ 03-api-contract.md
│  ├─ 04-data-model.md
│  ├─ 05-ui-design.md
│  ├─ 06-scoring-rule.md
│  └─ 07-implementation-plan.md
├─ src/
│  ├─ background/
│  ├─ content/
│  ├─ popup/
│  ├─ dashboard/
│  ├─ storage/
│  ├─ api/
│  ├─ domain/
│  ├─ csv/
│  └─ shared/
├─ tests/
├─ .codex/
│  └─ AGENTS.md
└─ .claude/
   └─ CLAUDE.md
```
