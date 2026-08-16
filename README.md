# GBF Artifact Tool

Granblue Fantasy のアーティファクト(AF)管理を目的とした Chrome Extension プロジェクトです。

この拡張機能は、GBF の画面やゲーム進行を操作せず、GBF ページ自身が取得したアーティファクト一覧レスポンスを観測し、ローカルで管理・評価・表示するための補助ツールです。

## 重要な方針

このツールは observation-only の補助ツールです。

禁止事項:

- ゲーム画面を操作しない
- GBF DOM を変更しない
- GBF API に対して拡張機能独自のリクエストを送信しない
- 自動周回、自動売却、自動強化、自動ページ遷移などを行わない
- POST / PUT / DELETE など、ゲーム状態を変更する通信を行わない
- 外部サーバーへユーザーデータを送信しない

許可されること:

- GBF ページ自身が発行した `/rest/artifact/list/{page}` のレスポンスを観測する
- 観測したレスポンスを content bridge 経由で background service worker に渡す
- 正規化したアーティファクト情報を IndexedDB に保存する
- ローカルデータを Side Panel / Dashboard で表示、検索、並び替え、JSON出力・移行する
- ユーザが付与した rating / memo / custom score settings をローカル保存する

## 現在の構成

- Chrome Extension Manifest V3
- React
- TypeScript
- Vite
- Zustand
- Zod
- IndexedDB
- Chrome Side Panel
- Dashboard page
- Biome

## 画面構成

### Side Panel

拡張機能のメイン入口です。

- mode controls
- scan controls / scan status
- display companion view
- dashboard open action

Popup は現在使用していません。

### Dashboard

ローカルに保存されたアーティファクトを管理する画面です。

- アーティファクト一覧
- フィルタ
- ソート
- Versioned JSON export and import for local artifact data migration
- statistics summary
- rating
- memo
- lifecycle filtering

## モード

Side Panelには明示的な2つのモードがあります。保存済みデータの管理は独立したDashboardで行います。

### scan

GBFページ自身の通信を観測し、アーティファクト一覧を収集します。

主な責務:

- `/rest/artifact/list/{page}` の観測
- scan session lifecycle 管理
- artifact presence 更新
- full scan 完了後の possiblyDeleted 判定
- legacy ArtifactPresence backfill

### display

GBF の現在表示中アーティファクトページに対応する Side Panel companion view です。

主な責務:

- 現在観測された GBF artifact page の表示
- 5-column grid 表示
- rating 表示
- memo tooltip 表示

display mode では、artifact persistence / lifecycle update は行いません。

## データ取得フロー

Artifact data source:

```text
GBF page network response
/rest/artifact/list/{page}
````

Observation flow:

```text
page-context fetch/XHR observer
-> content bridge
-> background service worker
-> IndexedDB persistence
```

この拡張機能は、GBF API に対して独自に artifact list request を送信しません。

## データ分離方針

Artifact 本体、lifecycle、user review metadata は分離して扱います。

主なモデル:

* `Artifact`
* `ArtifactPresence`
* `ScanSession`
* `ArtifactUserReview`
* `DisplayState`

Review metadata:

* `rating: 0-5`
* `memo`

Review metadata は再スキャン後も維持されます。

## IndexedDB

現在の主な store:

* `artifacts`
* `scanMetadata`
* `artifactUserReviews`
* `scanSessions`
* `artifactPresence`

統計情報は IndexedDB に保存せず、Dashboard 表示時に in-memory で計算します。

## Statistics

現在実装済み:

* overall counts
* rating distribution
* attribute distribution
* kind distribution
* skill summary

## Content Bridge Stability

extension reload や stale content script に備えて、content bridge は再注入可能な設計です。

実装済みの考え方:

* `ensureContentBridge(tabId)`
* `PING_CONTENT_BRIDGE`
* idempotent content bridge injection
* stale content-script recovery after extension reload

## Custom Score System

次に実装予定の主要機能です。

### 目的

ユーザがアーティファクトを選別する際の思考を、ローカルな custom score として表現します。

評価観点:

* 属性・武器種ごとの理想スキル構成にどれだけ近いか
* 使用頻度の高い、または強いスキルを持っているか
* 同じスキルでも効果量テーブルが高いか

### 前提

Phase 1 では、完全な自由数式エディタは作りません。

まずは、ユーザが以下を設定できる rule-based scoring を実装します。

* 複数の理想スキル構成（属性・武器種・枠別スキル）
* 1～2枠・3枠・4枠ごとの全スキルの点数（0～25）

### スコア評価方針

`is_quirk: true` のクァーキーアーティファクトは、他の判定や減点を行わず最終スコアを `100` とします。

通常のアーティファクトは、次の2つの評価ルートのうち高い方を採用します。

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
  理想構成一致スコア
  - 一致した具体的なスキルのスキルクオリティ減点合計
```

一致判定:

* 1/4 一致
* 2/4 一致
* 3/4 一致
* 4/4 一致

1～2枠は順不同、3枠と4枠はそれぞれ対応する枠で判定します。未選択枠は一致として扱います。

#### priorityRouteScore

個々のスキル価値を評価します。

```text
priorityRouteScore =
  max(0, 枠別スキルスコア - スキルクオリティ減点) の合計
```

各枠の全スキルへ0～25点を設定します。不要スキル情報はスコアへ影響しません。

#### スキルクオリティ補正

アーティファクトの第1〜第3スキルの多くは、同じ skill level でも A〜E のスキルクオリティ差があります。Aが最高品質、Eが最低品質です。

基本方針:

* A は減点`0`で固定し、E の減点を最も大きくする
* `A(0) <= B <= C <= D <= E` の順序を維持する
* B～Eの減点幅は0～25でユーザーが調整し、`A(0) ≦ B ≦ C ≦ D ≦ E`を維持する
* 初期値は`0 / 1 / 2 / 3 / 4`とし、各ルートのスコアは0未満にしない

例:

```text
important skill D: max(0, 25 - 3) = 22
minor skill E:     max(0, 10 - 4) = 6
```

#### Lv評価

スキルレベルはリセット可能なため、Phase 1 の custom score は Lv1 想定で評価します。

現在のAFレベルや現在のskill levelをそのまま将来価値と混ぜないようにします。

### 将来フェーズ

#### Phase 1

* rule-based scoring
* ideal skill set
* per-skill scores by slot group
* configurable skill-quality penalties
* score explanation

#### Phase 2

* advanced/custom formula editor
* import/export score settings
* more detailed skill categorization

## Custom Score 実装方針

Custom score は、Artifact本体へ永続的に焼き込まない方針を優先します。

理由:

* score settings は後から変わる
* スコア算出ロジックも調整される
* artifact data と user scoring policy を分離した方が保守しやすい

推奨される責務分離:

```text
Artifact
-> observed normalized data

CustomScoreSettings
-> user-defined scoring policy

ScoreEvaluator
-> pure evaluation logic

ScoreResult
-> calculated result for UI
```

## 開発セットアップ

```bash
npm install
```

開発:

```bash
npm run dev
```

build:

```bash
npm run build
```

品質チェック:

```bash
npm run check
```

整形:

```bash
npm run format
```

## Chrome への読み込み

1. `npm run build` を実行する
2. Chrome で `chrome://extensions` を開く
3. Developer mode を有効にする
4. Load unpacked で `dist/` を選択する

## 開発時の注意

このプロジェクトでは、機能追加時に以下を必ず確認してください。

* GBF DOM を変更していないか
* GBF API へ独自リクエストを送っていないか
* page navigation を発生させていないか
* polling / retry によってゲーム側通信を増やしていないか
* scan / display mode とDashboard管理の責務が混ざっていないか
* Artifact / lifecycle / user review / scoring policy のデータ分離を壊していないか
