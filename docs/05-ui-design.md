# UI Design

## 目的

GBF Artifact Tool の UI は、GBF のゲーム画面を変更せず、ローカルに保存したアーティファクト情報を確認・管理・評価するために提供する。

UI は以下の2つを中心に構成する。

- Side Panel
- Dashboard

Popup は Side Panel へ移行済みのため、現在の主要UIとしては扱わない。

## UI 基本方針

### 行うこと

- Side Panel で現在の mode と scan / display 状態を確認する
- Dashboard で保存済み artifact を管理する
- rating / memo をローカルに保存する
- statistics を表示する
- CSV export を提供する
- custom score の表示・設定を将来的に提供する

### 行わないこと

- GBF DOM を変更しない
- GBF ページへ UI を挿入しない
- GBF画面上にボタンやオーバーレイを追加しない
- ゲーム画面をクリック・入力・遷移しない
- Side Panel / Dashboard から GBF API request を送信しない
- display mode で persistence / lifecycle update を行わない

## UI 全体構成

```text
Chrome Extension UI
├─ Side Panel
│  ├─ Header
│  ├─ Mode Controls
│  ├─ Scan Panel
│  ├─ Display Companion View
│  └─ Dashboard Entry
└─ Dashboard Page
   ├─ Header
   ├─ Summary / Statistics
   ├─ Filter Bar
   ├─ Artifact Table
   ├─ Rating / Memo Editing
   ├─ Lifecycle Filtering
   ├─ CSV Export
   └─ Future Custom Score Settings
````

## Side Panel

Side Panel は拡張機能のメイン入口。

### 目的

* scan / display の mode をブラウザタブ風UIで切り替える
* scan の開始・停止を行う
* scan 状態を確認する
* display mode の companion view を表示する
* Dashboard を開く

### 画面構成

```text
Side Panel
├─ Header
│  ├─ App Title
│  └─ Material Icon付きDashboard Button
├─ Mode Controls
│  ├─ scan
│  └─ display
├─ Scan Panel
│  ├─ Scan / Stop Toggle Button
│  ├─ Status
│  ├─ Observed Artifact Count
│  ├─ 5-column Page Progress
│  └─ Error Message
├─ Display Panel
│  ├─ Current Observed Page
│  ├─ 5-column Artifact Grid
│  ├─ Rating Display
│  └─ Memo Tooltip
└─ Actions
   └─ Open Dashboard
```

## Side Panel: Mode Controls

### scan

scan mode は artifact list response の観測・保存を行う。

表示する情報:

* observing state
* current page
* last page
* total count
* scanned pages
* latest scan session status
* latest error if any

操作:

* start observing
* stop observing

注意:

* scan mode でのみ artifact persistence / lifecycle update を行う
* GBFページの自動遷移は行わない
* GBF APIへの独自requestは送信しない

### Dashboard access

Side Panelのヘッダーは、Material Icon付きのDashboard導線を提供する。

表示する情報:

* stored artifact count
* latest scan metadata
* dashboard open button

操作:

* open dashboard

注意:

* Side Panelには独立したmanage modeを設けない
* 一覧・フィルタ・CSV・詳細管理は Dashboard に集約する

### display

display mode は、GBF の現在表示中 artifact page に対応する companion view を表示する。

表示する情報:

* current observed page
* current page artifact grid
* rating
* memo tooltip
* display error if any

操作:

* start display mode
* stop display mode

注意:

* display mode は persistence / lifecycle update を行わない
* display mode は現在観測されたページの補助表示に限定する

## Display Companion View

### 目的

GBF画面を見ながら、Side Panelで artifact の補助情報を確認できるようにする。

GBF DOM は変更しない。

### 表示内容

```text
Display Companion View
├─ Current Page Info
├─ Artifact Grid
│  ├─ Artifact Card
│  │  ├─ Name
│  │  ├─ Attribute
│  │  ├─ Kind
│  │  ├─ Game Score
│  │  ├─ Rating
│  │  └─ Memo Tooltip
│  └─ ...
└─ Status / Error
```

### Grid

* 5-column grid
* 現在観測された GBF artifact page の artifact のみ表示
* Dashboard の全件一覧とは役割を分ける

### Rating Display

* `ArtifactUserReview.rating` を表示する
* display mode では編集を必須にしない
* 編集導線を入れる場合も、artifact persistence / lifecycle update と混同しない

### Memo Tooltip

* `ArtifactUserReview.memo` がある場合に tooltip 表示する
* memo が空の場合は非表示または empty state とする

### 禁止

* artifact persistence
* scan session update
* artifact presence update
* GBF DOM mutation
* GBF page navigation
* GBF API request

## Dashboard

Dashboard は保存済み artifact の管理画面。

### 目的

* 保存済み artifact を一覧管理する
* filter / sort する
* rating / memo を編集する
* lifecycle 状態を確認する
* statistics を確認する
* CSV export する
* custom score を表示・設定する

### 起動

Dashboard は extension page として開く。

```ts
chrome.tabs.create({
  url: chrome.runtime.getURL("dashboard.html"),
});
```

### 画面構成

```text
Dashboard
├─ Header
│  ├─ Title
│  ├─ Stored Artifact Count
│  ├─ Latest Scan Info
│  └─ CSV Export
├─ Summary Cards
│  ├─ Total Count
│  ├─ Active Count
│  ├─ Possibly Deleted Count
│  ├─ Locked Count
│  ├─ Equipped Count
│  ├─ Rating Distribution
│  ├─ Attribute Distribution
│  └─ Kind Distribution
├─ Filter Bar
│  ├─ Keyword
│  ├─ Attribute
│  ├─ Kind
│  ├─ Skill Name
│  ├─ Locked State
│  ├─ Equipped State
│  ├─ Rating
│  ├─ Lifecycle Status
│  ├─ Game Score
│  └─ Future Custom Score
├─ Artifact Table
│  ├─ Basic Info
│  ├─ Lifecycle
│  ├─ Game Score
│  ├─ Future Custom Score
│  ├─ Skills
│  ├─ Rating
│  ├─ Memo
│  └─ Actions
└─ Future Custom Score Panel
   ├─ Profile Selector
   ├─ Ideal Skill Composition Editor
   ├─ Skill Priority Editor
   ├─ Unwanted Skill Editor
   ├─ Score Preview
   └─ Score Explanation
```

## Dashboard Header

表示候補:

* app title
* stored artifact count
* latest scanned at
* latest scan session status
* CSV export button
* reload local data button

注意:

* reload は IndexedDB からの再読み込み
* GBF API request を送る操作ではない

## Summary / Statistics

現在実装済みまたは想定する統計:

* overall counts
* rating distribution
* attribute distribution
* kind distribution
* skill summary

表示候補:

```text
Summary Cards
├─ Total
├─ Active
├─ Possibly Deleted
├─ Locked
├─ Equipped
├─ Rating 0
├─ Rating 1
├─ Rating 2
├─ Rating 3
├─ Rating 4
└─ Rating 5
```

方針:

* statistics は in-memory で計算する
* 永続化しない
* filter 適用後統計と全体統計を分ける場合はラベルで明示する

## Filter Bar

### 目的

保存済み artifact を素早く絞り込む。

### フィルタ候補

```text
Filter Bar
├─ Keyword
├─ Attribute
├─ Kind
├─ Skill Name
├─ Locked State
├─ Equipped State
├─ Rating
├─ Lifecycle Status
├─ Game Total Score Range
└─ Future Custom Score Range
```

### Keyword

対象候補:

* artifact name
* skill name
* memo
* equipped character name

### Attribute

候補:

* 火
* 水
* 土
* 風
* 光
* 闇

### Kind

初期は raw label でよい。

正式名称が判明したら置き換える。

### Skill Name

* raw skill name に対する部分一致
* 将来的には normalized skill key / skill category filter も追加する

### Lifecycle Status

候補:

* active
* possiblyDeleted
* all

### Rating

候補:

* all
* 0
* 1
* 2
* 3
* 4
* 5

## Sorting

### ソート候補

* ownedId
* name
* attribute
* kind
* level
* gameScore.total
* rating
* scannedAt
* lifecycle status
* future custom score

### 方針

* sort key と sort direction を明示する
* default sort は scannedAt desc または ownedId desc
* custom score 実装後は selected profile の score で sort できるようにする

## Artifact Table

### 目的

保存済み artifact を一覧で比較・管理する。

### カラム候補

```text
Artifact Table
├─ Rating
├─ Memo
├─ Lifecycle
├─ Name
├─ Attribute
├─ Kind
├─ Level
├─ Locked
├─ Equipped
├─ Game Total Score
├─ Custom Score
├─ Skill 1
├─ Skill 2
├─ Skill 3
├─ Skill 4
└─ Actions
```

### Basic Info

表示候補:

* name
* ownedId
* artifactTypeId
* attribute
* kind
* level / maxLevel
* locked
* equipped character

### Game Score

表示候補:

* attack
* defense
* special
* total

注意:

* game score と custom score を混同しない
* `Game Total Score` と `Custom Score` は別カラムにする

### Skills

各 skill に表示する内容:

* slot
* name
* level
* quality
* effect value
* score category
* future table rank
* future normalized key

表示例:

```text
S1 自属性攻撃力 Lv1 q3 +10.4%
S2 回復性能 Lv1 q1 +13.2%
S3 最大HP上昇/防御力-70% Lv1 q1 +8.8%
S4 回復アビリティ使用時... q1 4%
```

### Rating

* 0〜5
* UIは星、select、button group のいずれでもよい
* 初期は単純な select / buttons で十分

### Memo

* 短い memo を inline 表示
* 長文は tooltip または expandable display
* 編集は modal / inline editor / textarea のいずれでもよい

### Lifecycle

表示候補:

* active
* possiblyDeleted
* firstSeenAt
* lastSeenAt

`possiblyDeleted` は削除確定ではなく、full scan 後に観測されなかった状態として表示する。

## Rating / Memo Editing

### Rating

要件:

* 0〜5 を設定できる
* 保存後、Dashboard / Display Mode に反映される
* 再スキャン後も維持される

### Memo

要件:

* 任意文字列を保存できる
* artifact 本体とは分離して保存する
* 再スキャン後も維持される
* display mode で tooltip 表示できる

### 保存方針

* `ArtifactUserReview` として保存する
* `ownedId` で紐付ける
* artifact persistence と分離する

## CSV Export UI

### 目的

保存済み artifact をローカル CSV として出力する。

### UI

```text
CSV Export
├─ Export Button
├─ Optional Column Settings
└─ Export Status
```

初期は単一ボタンで十分。

### 出力候補

* basic artifact info
* lifecycle status
* rating
* memo
* game score
* future custom score
* skill 1〜4

### 禁止

* 外部サーバーへ送信しない
* GBF API request を送らない

## Custom Score UI

Custom Score は次に実装予定の主要機能。

Phase 1 では自由数式エディタを作らない。

### 目的

ユーザーが artifact 選別時に考えている以下の判断を、ローカル score として表現する。

* 欲しいスキルの組み合わせに近いか
* 強いスキルを持っているか
* 不要スキルがあるか
* 効果量テーブルが高いか

### UI 全体

```text
Custom Score Panel
├─ Score Settings
├─ Ideal Skill Composition Editor
├─ Skill Priority Editor
├─ Unwanted Skill Editor
├─ Score Preview
└─ Score Explanation
```

### Score Settings

表示:

* current profile name
* profile list
* create profile
* rename profile
* duplicate profile
* delete profile

Phase 1 では profile 数を絞ってもよい。

### Ideal Skill Composition Editor

目的:

理想スキル構成を設定する。

仕様:

* 複数の理想構成を追加・編集・削除できる
* 属性と武器種は複数選択とし、新規構成では全選択にする
* 1～2枠は順不同の2項目、3枠と4枠はそれぞれ専用の選択肢を表示する
* 未選択のスキル枠はワイルドカードとして一致扱いにする
* 構成同士の属性×武器種の適用範囲は重複させない
* 1構成をテーブルの1行で表示し、削除操作は左端、コメント入力は右端に置く
* 1/4, 2/4, 3/4, 4/4 match の説明を表示する

UI候補:

```text
Ideal Skill Configurations
└─ Configuration
   ├─ Delete
   ├─ Attribute Multi-select
   ├─ Weapon Kind Multi-select
   ├─ Slot 1–2 Select × 2
   ├─ Slot 3 Select
   ├─ Slot 4 Select
   └─ Comment
```

注意:

* 1～2枠だけは順番が評価に影響しない
* 未選択は「どのスキルでも一致」と明示する

### Skill Score Editor

目的:

強い / 使用頻度が高いスキルへ枠グループ別の点数を設定する。

仕様:

* 「1～2枠」「3枠」「4枠」をタブで切り替える
* 選択中の枠グループに属する全スキルを表示する
* 各スキルを0～25の整数スライダーで調整する
* 4枠の基礎点合計は最大100とする

表示例:

```text
Skill Scores
[1～2枠] [3枠] [4枠]
攻撃力              [---------●] 20
HP                  [------●---] 15
```

方針:

* スライダー値を数値でも併記する
* 保存時に全スキルの値をまとめて永続化する

### Shared Table-rank Penalty Settings

目的:

理想構成ルートとスキルスコアルートに共通するテーブルランク減点を設定する。

仕様:

* スコア設定画面の独立した「共通補正」エリアからDialogを開く
* `a`～`e`の減点幅を0～25の整数スライダーで調整する
* `a >= b >= c >= d >= e`を保存時に検証する
* 初期値は`4 / 3 / 2 / 1 / 0`とする
* 減算後の各スコアは0未満にしない
* 4枠、ランク不明、理想構成の未選択枠には減点しない

### Future Unwanted Skill Highlight Settings

目的:

不要スキルを設定する。

仕様:

* custom score の加点・減点には使用しない
* 将来のartifact一覧の強調表示に利用する
* 現在のスコア設定画面には表示しない

UI候補:

* checkbox list
* multi-select
* selected skill chips

説明文の例:

```text
不要スキルはスコアへ影響しません。将来の一覧表示で強調するための情報です。
```

### Score Preview

目的:

設定中の profile が artifact にどう効くか確認する。

表示候補:

* selected artifact
* final score
* selected route
* ideal route score
* priority route score
* top reasons

例:

```text
Score: 87
Route: ideal
Ideal Route: 87
Priority Route: 61
```

### Score Explanation

目的:

なぜその score になったのかを説明する。

表示例:

```text
+ 3/4 ideal match
+ 通常攻撃ダメージ上限 rank e
+ 自属性攻撃力 rank d
```

または:

```text
+ 通常攻撃ダメージ上限 skill score 25
+ 通常攻撃ダメージ上限 rank e
```

方針:

* score reason は UI表示に耐える構造で返す
* debug用 raw detail と user-facing label を分けてもよい
* game score とは別表示にする

## Custom Score Display in Dashboard

Custom Score 実装後、Dashboard に以下を追加する。

### Header / Controls

* custom score settings
* recalculate scores action if needed
* score settings button

### Artifact Table

追加カラム:

* custom score
* selected route
* score reason summary

### Filter

追加候補:

* custom score range
* selected route
* has ideal match count
* contains unwanted skill

### Sort

追加候補:

* custom score desc
* ideal route score desc
* priority route score desc

## Empty States

### No Stored Artifacts

表示例:

```text
No artifacts stored yet.
Start scan mode and manually open artifact pages in GBF.
The extension will observe GBF page responses.
```

### No Review Metadata

表示例:

```text
No rating or memo yet.
Add rating or memo from the Dashboard.
```

### No Display Data

表示例:

```text
No artifact page observed yet.
Start display mode and open an artifact page in GBF.
```

### Score Settings Load Error

表示例:

```text
Custom score settings could not be loaded.
Configure ideal skills and per-skill scores.
```

## Error Display

### 方針

* ユーザー向けには短く表示する
* 詳細は console に出す
* recovery action がある場合は明示する

### エラー例

#### Not on GBF page

```text
Open a GBF page before starting observation.
```

#### Content Bridge Unavailable

```text
Could not connect to the GBF page. Reload the GBF tab and try again.
```

#### Observer Injection Failed

```text
Could not start artifact response observation.
```

#### Validation Failed

```text
Observed artifact response was not in the expected format.
```

#### IndexedDB Error

```text
Could not save local artifact data.
```

## Loading States

### Side Panel

* checking current state
* starting observation
* stopping observation
* loading stored count
* loading display data

### Dashboard

* loading artifacts
* loading reviews
* calculating statistics
* exporting CSV
* future calculating custom scores

## Accessibility / Usability

方針:

* 重要な状態は色だけで表現しない
* button text を明確にする
* error message は短く具体的にする
* table は横スクロールを許容する
* rating は keyboard 操作でも変更できる構成が望ましい
* memo は長文でも壊れない表示にする

## Implementation Guidance

### React Components

UI component に business logic を詰め込みすぎない。

避けること:

* component 内で score calculation を直接実装する
* component 内で CSV文字列を直接組み立てる
* component 内で IndexedDB を直接扱う
* component 内で normalization を行う

推奨:

```text
UI Component
-> ViewModel / hook
-> message / storage adapter
-> domain pure function
```

### Side Panel Components

候補:

```text
src/sidepanel/
  index.tsx
  style.css

src/panel/
  ExtensionPanel.tsx
  ModeControls.tsx
  ScanPanel.tsx
  DisplayPanel.tsx
  DashboardEntry.tsx
```

### Dashboard Components

候補:

```text
src/dashboard/
  index.tsx
  Dashboard.tsx
  ArtifactTable.tsx
  ArtifactFilters.tsx
  ArtifactSummary.tsx
  CsvExportButton.tsx
  ReviewEditor.tsx
  LifecycleBadge.tsx
```

### Future Custom Score Components

候補:

```text
src/dashboard/score/
  ScoreSettingsEditor.tsx
  IdealSkillCompositionEditor.tsx
  SkillScoreEditor.tsx
  ScorePreview.tsx
  ScoreExplanation.tsx
```

## UI Safety Checklist

UI変更時は以下を確認する。

* GBF DOM を変更していないか
* GBFページへUIを挿入していないか
* GBF API request を送信していないか
* page navigation を発生させていないか
* display mode で persistence / lifecycle update をしていないか
* scan / display とDashboard管理の責務が混ざっていないか
* game score と custom score を混同していないか
* rating / memo が再スキャンで消えない設計になっているか
