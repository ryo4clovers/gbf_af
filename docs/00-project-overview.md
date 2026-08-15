# Project Overview

## 概要

GBF Artifact Tool は、Granblue Fantasy のアーティファクト(AF)をローカルで管理・評価するための Chrome Extension です。

この拡張機能は、GBF のゲーム画面を操作せず、GBF ページ自身が取得したアーティファクト一覧レスポンスを観測します。

観測したデータは拡張機能内で正規化し、IndexedDB に保存します。  
保存済みデータは Side Panel と Dashboard から確認・管理できます。

## 最重要方針

このツールは observation-only の補助ツールです。

以下は絶対に行いません。

- ゲーム画面を操作しない
- GBF DOM を変更しない
- GBF ページへ UI を挿入しない
- 拡張機能独自の GBF artifact API request を送信しない
- 自動ページ遷移を行わない
- 自動周回、自動売却、自動強化、自動装備を行わない
- POST / PUT / DELETE など状態変更系リクエストを行わない
- 外部サーバーへユーザーのアーティファクトデータを送信しない

許可されるデータ取得方法は、GBF ページ自身が発行した network response の観測のみです。

```text
GBF page network response
/rest/artifact/list/{page}
````

## データ取得方針

この拡張機能は、GBF API へ独自に artifact list request を送信しません。

データ取得フローは以下です。

```text
GBF page's own fetch/XHR response
-> page-context observer
-> content bridge
-> background service worker
-> IndexedDB
-> Side Panel / Dashboard
```

ユーザーは GBF ページを手動で操作・遷移します。
拡張機能は、その結果として GBF ページ側で発生した `/rest/artifact/list/{page}` のレスポンスを観測します。

## 現在の技術構成

* Chrome Extension Manifest V3
* React
* TypeScript
* Vite
* Zustand
* Zod
* IndexedDB
* Chrome Side Panel
* Dashboard page
* Biome

## 現在の画面構成

### Side Panel

拡張機能のメイン入口です。

Side Panel では以下を扱います。

* mode controls
* scan controls
* scan status
* display companion view
* dashboard entry

Popup は Side Panel へ移行済みです。
今後、明示的な理由がない限り Popup は再導入しません。

### Dashboard

保存済みアーティファクトを管理する専用ページです。

Dashboard では以下を扱います。

* アーティファクト一覧
* フィルタ
* ソート
* CSV export
* statistics summary
* rating
* memo
* lifecycle filtering
* 将来の custom score 表示・設定

## アプリケーションモード

このツールには、明示的に3つのモードがあります。

```ts
type AppMode = "scan" | "manage" | "display";
```

### scan

GBF ページ自身の artifact list response を観測し、アーティファクト情報を収集します。

主な責務:

* observation-only artifact collection
* `/rest/artifact/list/{page}` response の観測
* response validation
* artifact normalization
* IndexedDB persistence
* `ScanSession` lifecycle tracking
* `ArtifactPresence` tracking
* completed full scan 後の `possiblyDeleted` detection
* legacy `ArtifactPresence` backfill

禁止:

* GBF API への独自 request
* DOM mutation
* page navigation
* polling / retry による追加通信
* ゲーム操作

### manage

ローカル保存済みアーティファクトを管理します。

主な責務:

* artifact list
* filtering
* sorting
* CSV export
* statistics summary
* rating
* memo
* lifecycle filtering

### display

GBF の現在表示中アーティファクトページに対応する Side Panel companion view です。

主な責務:

* current observed GBF artifact page の表示
* 5-column grid 表示
* rating display
* memo tooltip

display mode では以下を行いません。

* artifact persistence
* lifecycle update
* scan session update
* presence update

## データ分離方針

Artifact 本体、lifecycle、user review metadata、display state、custom score policy は分離して扱います。

主なデータ概念:

* `Artifact`
* `ArtifactSkill`
* `ArtifactPresence`
* `ScanSession`
* `ArtifactUserReview`
* `DisplayState`
* `GameScore`
* `CustomScoreSettings`
* future `ScoreResult`

現在の user review metadata:

* `rating: 0-5`
* `memo`

rating / memo は再スキャン後も維持します。
再スキャンによって user review metadata を消してはいけません。

## IndexedDB

現在の主な store:

* `artifacts`
* `scanMetadata`
* `artifactUserReviews`
* `scanSessions`
* `artifactPresence`

統計情報は永続化せず、Dashboard 表示時に in-memory で計算します。

## Statistics

現在実装済みの統計:

* overall counts
* rating distribution
* attribute distribution
* kind distribution
* skill summary

## Content Bridge 方針

Content bridge は extension reload や stale content script に耐える必要があります。

現在の重要な考え方:

* `ensureContentBridge(tabId)`
* `PING_CONTENT_BRIDGE`
* idempotent content bridge injection
* stale content-script recovery after extension reload

MV3 service worker は常駐しないため、background memory が常に維持される前提で実装してはいけません。

## Custom Score System

次に実装予定の主要機能です。

### 目的

ユーザーがアーティファクトを選別する際の判断を、ローカルな custom score として表現します。

評価観点:

* 欲しいスキルの組み合わせにどれだけ近いか
* 使用頻度の高い、または強いスキルを持っているか
* 同じスキルでも効果量テーブルが高いか

### Phase 1 方針

最初から完全な自由数式エディタは作りません。

Phase 1 では、rule-based scoring を実装します。

ユーザーが設定するもの:

* 理想スキル構成
* 1～2枠・3枠・4枠ごとの全スキルの点数（0～25）

### Score Evaluation

最終スコアは、以下2つの評価ルートのうち高い方を採用します。

```text
finalScore =
  max(
    idealRouteScore,
    priorityRouteScore
  )
```

#### idealRouteScore

理想構成にどれだけ近いかを評価します。

```text
idealRouteScore =
  ideal match score
  - table-rank penalties for concretely matched skills
```

一致判定:

* 1/4 match
* 2/4 match
* 3/4 match
* 4/4 match

1～2枠は順不同、3枠と4枠は対応する枠で判定し、未選択枠は一致として扱います。

#### priorityRouteScore

個々のスキル価値を評価します。

```text
priorityRouteScore =
  sum of max(0, per-skill score - table-rank penalty)
```

各枠グループの全スキルへ0～25点を設定し、不要スキル情報は計算へ使用しません。

#### Effect Table Rank

第1〜第3スキルの多くは、同じスキルLvでも a〜e の効果量テーブル差があります。

基本方針:

* `a` の減点を最も大きく、`e` の減点を最も小さくする
* ただし「欲しいスキルの d」は「微妙なスキルの e」より高く評価する
* 減点幅は0～25でユーザーが調整し、`a >= b >= c >= d >= e`を維持する
* 理想構成ルートでも、具体的に一致したスキルの減点を基礎スコアから差し引く

例:

```text
important skill d: max(0, 25 - 1) = 24
minor skill e:     max(0, 10 - 0) = 10
```

#### Skill Level Baseline

Phase 1 の custom score は Lv1 想定で評価します。

理由:

* スキルレベルはリセット可能
* 現在のスキルLvと長期的なAF価値を混ぜると、スコアの意味が曖昧になるため

## 推奨リポジトリ構成

現在の大まかな構成:

```text
gbf_af/
├─ README.md
├─ package.json
├─ public/
│  └─ manifest.json
├─ docs/
├─ fixtures/
├─ src/
│  ├─ api/
│  ├─ background/
│  ├─ content/
│  ├─ csv/
│  ├─ dashboard/
│  ├─ domain/
│  ├─ page-observer/
│  ├─ panel/
│  ├─ shared/
│  ├─ sidepanel/
│  ├─ state/
│  └─ storage/
├─ .codex/
│  └─ AGENTS.md
└─ .claude/
   └─ CLAUDE.md
```

## 開発時の注意

機能追加時は、必ず以下を確認します。

* GBF DOM を変更していないか
* GBF API へ拡張機能独自の request を送っていないか
* page navigation を発生させていないか
* polling / retry によってゲーム側通信を増やしていないか
* scan / manage / display mode の責務が混ざっていないか
* Artifact / lifecycle / user review / display / scoring policy の分離を壊していないか
* MV3 service worker lifecycle を考慮しているか

## 現時点の開発方針

次の大きな作業は Custom Score System です。

実装前に以下の docs を現状仕様へ更新します。

* `00-project-overview.md`
* `01-requirements.md`
* `02-architecture.md`
* `03-observed-api-contract.md`
* `04-data-model.md`
* `05-ui-design.md`
* `06-custom-score.md`
* `07-implementation-plan.md`
* `08-ai-implementation-prompt.md`
