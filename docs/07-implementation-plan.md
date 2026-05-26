# Implementation Plan

## 目的

このドキュメントは、GBF Artifact Tool の現在の実装状況を前提に、次に実装する Custom Score System までの作業計画を整理する。

現在のプロジェクトは初期実装段階ではなく、以下の基盤はすでに実装済みである。

- Manifest V3 Chrome Extension
- React + TypeScript + Vite
- Zustand
- Zod
- IndexedDB
- Side Panel UI
- Dashboard
- observation-only scan
- display mode
- rating / memo
- lifecycle tracking
- statistics
- CSV export
- content bridge recovery

今後の中心作業は Custom Score System である。

## 最重要制約

実装中は常に以下を守る。

- GBF game screen を操作しない
- GBF DOM を変更しない
- GBF page に UI を挿入しない
- 拡張機能独自の GBF artifact API request を送信しない
- 自動ページ遷移を実装しない
- polling / retry で GBF 側通信を増やさない
- POST / PUT / DELETE など状態変更 request を送信しない
- 外部サーバーへ artifact data を送信しない

Artifact data source は以下のみ。

```text
GBF page's own /rest/artifact/list/{page} response
````

Allowed flow:

```text id="4k9vug"
GBF page's own fetch/XHR response
-> page-context observer
-> content bridge
-> background service worker
-> IndexedDB
```

## 現在の実装済みフェーズ

### Completed Phase A: Project Foundation

実装済み:

* TypeScript project
* Vite build
* React
* Biome
* Manifest V3
* Background service worker
* Content script
* Dashboard page
* Side Panel page

現在は Popup ではなく Side Panel がメイン UI。

### Completed Phase B: API Response Type / Validation / Normalization

実装済み:

* artifact list response types
* Zod schema validation
* RawArtifact -> Artifact normalization
* effect_value parser
* game score normalization
* skill 1〜4 normalization
* raw response preservation

### Completed Phase C: Observation-only Scan

実装済み:

* page-context fetch/XHR observer
* `/rest/artifact/list/{page}` response observation
* content bridge
* background handling of observed artifact list
* scan start / stop
* no extension-owned artifact API request

### Completed Phase D: IndexedDB Storage

実装済み stores:

* `artifacts`
* `scanMetadata`
* `artifactUserReviews`
* `scanSessions`
* `artifactPresence`

実装済み:

* artifact save / load
* scan metadata save / load
* user review save / load
* scan session save / load
* artifact presence save / load
* clear artifact data
* clear review data

### Completed Phase E: Lifecycle Tracking

実装済み:

* `ScanSession`
* `ArtifactPresence`
* active scan session recovery
* completed full scan detection
* possiblyDeleted marking
* legacy presence backfill

### Completed Phase F: Dashboard

実装済み:

* artifact list
* filtering
* sorting
* CSV export
* statistics summary
* rating
* memo
* lifecycle filtering

### Completed Phase G: Display Mode

実装済み:

* Side Panel companion view
* current observed GBF artifact page
* 5-column grid
* rating display
* memo tooltip
* no persistence / lifecycle update in display mode

### Completed Phase H: Content Bridge Stability

実装済み:

* `ensureContentBridge(tabId)`
* `PING_CONTENT_BRIDGE`
* idempotent content bridge injection
* stale content-script recovery after extension reload
* page observer injection

## 次の主要実装: Custom Score System

Custom Score System は以下の順で実装する。

実装方針:

* まず pure domain logic を作る
* UI は後から接続する
* scoring policy と calculated result を分離する
* Artifact 本体に calculated score を primary source として焼き込まない
* score explanation を最初から返せる設計にする

## Phase 0: Docs 整理

### 目的

実装前に、古い Popup / API GET 取得 / 旧 ScoreRule 前提を除去する。

### 作業

* `00-project-overview.md` を現状仕様へ更新
* `01-requirements.md` を現状仕様へ更新
* `02-architecture.md` を現状仕様へ更新
* `03-api-contract.md` を observed response contract として更新
* `04-data-model.md` を現状モデルへ更新
* `05-ui-design.md` を Side Panel / Dashboard / Custom Score UI 前提へ更新
* `06-scoring-rule.md` を削除
* `custom-score.md` を `06-custom-score.md` へリネーム
* `07-implementation-plan.md` を本計画へ更新
* `08-ai-implementation-prompt.md` を現状仕様へ更新
* `.claude/CLAUDE.md` を更新
* `.codex/AGENTS.md` を更新
* root `AGENTS.md` を更新
* `README.md` を更新
* sample files を `fixtures/` または `test/fixtures/` へ移動

### 成果物

```text id="opg3md"
docs/
├─ 00-project-overview.md
├─ 01-requirements.md
├─ 02-architecture.md
├─ 03-api-contract.md
├─ 04-data-model.md
├─ 05-ui-design.md
├─ 06-custom-score.md
├─ 07-implementation-plan.md
└─ 08-ai-implementation-prompt.md

fixtures/
├─ sample_artifacts_page.html
└─ sample_API_response.json
```

### Validation

* 古い `Popup` 前提が残っていない
* 古い `API retrieval` 前提が残っていない
* 古い `ScoreRule` 前提が残っていない
* observation-only 方針が全docsで一致している
* Custom Score の式が全docsで一致している

## Phase 1: Skill Catalog / Normalization Foundation

### 目的

Custom Score が raw skill name の部分一致に強く依存しないようにする。

### 作業

* normalized skill key の型を定義する
* known skill catalog の初期構造を作る
* `skillId -> normalizedKey` の変換を実装する
* raw name fallback を用意する
* skill category の初期分類を定義する
* table rank 推定の最小実装を作る

### 推奨ファイル

```text id="d5yci7"
src/domain/skill/
  normalizedSkill.ts
  skillCatalog.ts
  normalizeSkill.ts
  inferTableRank.ts
```

### 型候補

```ts id="8qdzys"
export type NormalizedSkillKey = string;

export type TableRank = "a" | "b" | "c" | "d" | "e";

export type SkillCategory =
  | "normal_attack"
  | "ougi"
  | "ability"
  | "defense"
  | "healing"
  | "utility"
  | "drop"
  | "unknown";

export type NormalizedArtifactSkill = {
  rawName: string;
  normalizedKey: NormalizedSkillKey;
  slot: 1 | 2 | 3 | 4;
  skillId: number;
  level: number;
  value?: number;
  unit?: "percent" | "flat" | "times" | "count" | "unknown";
  tableRank?: TableRank;
  category: SkillCategory;
};
```

### table rank 方針

初期実装:

```ts id="z8p28e"
const QUALITY_TO_TABLE_RANK = {
  1: "a",
  2: "b",
  3: "c",
  4: "d",
  5: "e",
} as const;
```

注意:

* 第4スキルは a〜e table rank として扱わない可能性が高い
* slot 4 は `tableRank: undefined` または別扱いにする
* 実データ検証後に補正する

### Validation

* known skillId が stable normalizedKey に変換される
* unknown skillId でも fallback key が生成される
* slot 1〜3 の quality が tableRank に変換される
* slot 4 の tableRank を誤って高評価しない
* `npm run check` が通る

## Phase 2: Score Model Definition

### 目的

scoring policy と calculated result を分離する。

### 作業

* `ScoreProfile` を定義する
* `SkillPriorityEntry` を定義する
* `UnwantedSkillConfig` を定義する
* `ScoreResult` を定義する
* `ScoreReason` を定義する
* score constants を定義する

### 推奨ファイル

```text id="zc6uhk"
src/domain/score/
  scoreProfile.ts
  scoreResult.ts
  scoreConstants.ts
```

### 型候補

```ts id="xgzfhi"
export type ScoreProfile = {
  id: string;
  name: string;
  idealSkillKeys: NormalizedSkillKey[];
  skillPriority: SkillPriorityEntry[];
  createdAt: string;
  updatedAt: string;
};

export type SkillPriorityEntry = {
  skillKey: NormalizedSkillKey;
  rank: number;
};

export type UnwantedSkillConfig = {
  skillKeys: NormalizedSkillKey[];
  updatedAt: string;
};

export type ScoreResult = {
  total: number;
  selectedRoute: "ideal" | "priority";
  idealRouteScore: number;
  priorityRouteScore: number;
  reasons: ScoreReason[];
};

export type ScoreReason = {
  type:
    | "ideal_match"
    | "priority_skill"
    | "table_multiplier"
    | "unwanted_penalty";
  skillKey?: NormalizedSkillKey;
  label: string;
  delta: number;
};
```

### 初期定数候補

```ts id="k938kk"
export const IDEAL_MATCH_SCORE = {
  0: 0,
  1: 20,
  2: 45,
  3: 75,
  4: 110,
} as const;

export const TABLE_RANK_MULTIPLIER = {
  a: 1.0,
  b: 1.05,
  c: 1.1,
  d: 1.15,
  e: 1.25,
} as const;

export const UNWANTED_SKILL_PENALTY = {
  0: 0,
  1: 25,
  2: 60,
  3: 100,
  4: 150,
} as const;
```

### Validation

* 型が UI / storage / evaluator から再利用できる
* calculated result と profile が混ざっていない
* constants が1か所に集約されている
* `npm run check` が通る

## Phase 3: Score Evaluator Pure Functions

### 目的

Custom Score の中核計算を UI / storage から独立した pure function として実装する。

### 作業

* `evaluateCustomScore` を実装する
* `evaluateIdealRoute` を実装する
* `evaluatePriorityRoute` を実装する
* `countIdealMatches` を実装する
* `applyTableMultiplier` を実装する
* `calculateUnwantedPenalty` を実装する
* score reasons を生成する

### 推奨ファイル

```text id="sgnx2y"
src/domain/score/
  evaluateCustomScore.ts
  evaluateIdealRoute.ts
  evaluatePriorityRoute.ts
  scoreExplanation.ts
```

### 評価式

```text id="rk5jwl"
finalScore =
  max(
    idealRouteScore,
    priorityRouteScore
  )
```

### Ideal Route

```text id="ealmsg"
idealRouteScore =
  ideal match score
  + table multiplier for matched ideal skills
```

仕様:

* 1/4, 2/4, 3/4, 4/4 の4段階で一致判定
* slot position は見ない
* unwanted skill penalty は重視しない
* matched ideal skill の table rank を反映する

### Priority Route

```text id="ijbsh9"
priorityRouteScore =
  skill priority score
  + table multiplier
  - unwanted skill penalty
```

仕様:

* skill priority の上位ほど高い base score
* table rank は base score に対する multiplier
* unwanted skill は減点
* 1つで大きく減点
* 複数で段階的に減点

### score explanation

例:

```text id="ke0v44"
Score: 87
Route: ideal
+ 3/4 ideal match
+ 通常攻撃ダメージ上限 rank e
+ 自属性攻撃力 rank d
```

または:

```text id="9qphbu"
Score: 64
Route: priority
+ 通常攻撃ダメージ上限 rank e
+ 自属性攻撃力 rank d
- 不要スキル 1件
```

### Validation

* evaluator が pure function である
* IndexedDB や chrome API に依存しない
* React component に依存しない
* same input returns same output
* score reason が UI表示可能
* `npm run check` が通る

## Phase 4: Unit Tests for Score Evaluator

### 目的

スコア仕様の退行を防ぐ。

### テスト対象

* ideal 1/4 match
* ideal 2/4 match
* ideal 3/4 match
* ideal 4/4 match
* slot position ignored
* priority order affects score
* unwanted skill penalty
* multiple unwanted skills progressive penalty
* table rank multiplier
* desired skill rank d beats minor skill rank e
* final score chooses ideal route
* final score chooses priority route
* score reasons are generated

### 推奨ファイル

```text id="goifw8"
src/domain/score/
  evaluateCustomScore.test.ts
  evaluateIdealRoute.test.ts
  evaluatePriorityRoute.test.ts

src/domain/skill/
  normalizeSkill.test.ts
  inferTableRank.test.ts
```

### Validation

* test data is small and readable
* tests do not require Chrome APIs
* tests do not require IndexedDB
* `npm run check` が通る
* test command が存在する場合は test も通る

## Phase 5: Score Profile Storage

### 目的

ユーザー定義の score profile / unwanted skill config を IndexedDB に保存できるようにする。

### 作業

* IndexedDB version を上げる
* `scoreProfiles` store を追加する
* `scoreSettings` store または `unwantedSkillConfig` store を追加する
* CRUD functions を実装する
* default profile / default settings を用意する

### 推奨ファイル

```text id="qvfyvh"
src/storage/artifactIndexedDb.ts
src/storage/scoreProfileStorage.ts
```

または既存方針に合わせて `artifactIndexedDb.ts` に集約してもよい。

### Stores

```text id="vcyiv3"
scoreProfiles
scoreSettings
```

### 保存対象

```ts id="4xi3xy"
ScoreProfile
UnwantedSkillConfig
```

### 方針

* calculated score result は保存しない
* score profile と artifact data を分離する
* profile 更新時に artifact record を更新しない
* cache が必要になるまでは都度計算する

### Validation

* DB migration が既存データを壊さない
* existing stores が保持される
* score profile が保存 / 読込 / 更新 / 削除できる
* unwanted config が保存 / 読込できる
* `npm run check` が通る
* `npm run build` が通る

## Phase 6: Background Messages for Score Profiles

### 目的

Dashboard UI から score profile storage を扱えるようにする。

### 作業

`shared/messages.ts` に message type を追加する。

候補:

```text id="5619zi"
GET_SCORE_PROFILES
SAVE_SCORE_PROFILE
DELETE_SCORE_PROFILE
GET_UNWANTED_SKILL_CONFIG
SAVE_UNWANTED_SKILL_CONFIG
```

background handler を追加する。

### 方針

* message type は discriminated union で安全に扱う
* validation を行う
* unsupported message type を明確に扱う
* score calculation 自体は background に寄せすぎない
* Dashboard 側で local artifacts + profile から計算してもよい

### Validation

* messages が型安全
* background handler が既存messageを壊さない
* unsupported message error が維持される
* `npm run check` が通る
* `npm run build` が通る

## Phase 7: Dashboard Score Display

### 目的

保存済み artifact に対して custom score を表示できるようにする。

### 作業

* Dashboard で score profiles を読み込む
* selected profile を保持する
* artifacts に対して score result を計算する
* table に custom score column を追加する
* selected route を表示する
* score reason summary を表示する
* custom score sort を追加する
* custom score filter を追加するか検討する

### UI候補

```text id="481nbg"
Artifact Table
├─ Game Total Score
├─ Custom Score
├─ Custom Route
└─ Score Reason Summary
```

### 方針

* 最初は表示とsortを優先
* filterは後続でもよい
* score reason は簡易表示 + tooltip でよい
* game score と custom score を明確に分ける

### Validation

* profile 未作成時の empty state がある
* score calculation error で画面全体が壊れない
* existing filters / sorts が壊れない
* CSV export が壊れない
* `npm run check` が通る
* `npm run build` が通る

## Phase 8: Score Profile Editor UI

### 目的

ユーザーが custom score profile を編集できるようにする。

### 作業

* profile selector
* create profile
* rename profile
* delete profile
* ideal skill composition editor
* skill priority editor
* unwanted skill editor
* score preview
* score explanation

### 推奨コンポーネント

```text id="sujfh5"
src/dashboard/score/
  ScoreProfileSelector.tsx
  IdealSkillCompositionEditor.tsx
  SkillPriorityEditor.tsx
  UnwantedSkillEditor.tsx
  ScorePreview.tsx
  ScoreExplanation.tsx
```

### Ideal Skill Composition Editor

仕様:

* 最大4スキル
* slot order は評価に影響しない
* duplicate skill の扱いを明確にする
* normalized skill key を保存する

初期UI:

* select + add button
* selected skill chips
* remove button

### Skill Priority Editor

仕様:

* 上位ほど高評価
* numeric weight をユーザーに直接入力させない
* rank から内部scoreを計算する

初期UI:

* list
* up button
* down button
* remove button
* add skill

drag and drop は後回しでよい。

### Unwanted Skill Editor

仕様:

* Phase 1 では global config
* priority route に減点として適用
* ideal route では重視しすぎない

初期UI:

* selected skill chips
* add skill
* remove button

### Score Preview

仕様:

* sample artifact または selected artifact で preview
* final score
* selected route
* ideal route score
* priority route score
* reasons

### Validation

* profile name empty を防ぐ
* ideal skill composition は最大4
* skill key duplication の扱いが明確
* save / reload 後に設定が維持される
* `npm run check` が通る
* `npm run build` が通る

## Phase 9: CSV Export Integration

### 目的

Custom Score を CSV に含められるようにする。

### 作業

* selected score profile がある場合に score を計算する
* CSV columns に custom score を追加する
* selected route を追加する
* route scores を追加するか検討する
* score reasons summary を追加するか検討する

### カラム候補

```text id="qxl0g8"
customScore
customScoreRoute
idealRouteScore
priorityRouteScore
customScoreReasons
```

### 方針

* CSV export はローカル完結
* profile 未選択時は空欄
* score calculation failure 時は空欄または error marker
* 既存CSV互換性を極力壊さない

### Validation

* CSV export が成功する
* custom score 有無で export が壊れない
* rating / memo / lifecycle columns が維持される
* `npm run check` が通る
* `npm run build` が通る

## Phase 10: Tuning / Real Data Validation

### 目的

実データに対して score が選別感覚に合うか検証する。

### 作業

* sample API response で evaluator を確認する
* 実際の保存済み artifacts で score distribution を確認する
* ideal match score を調整する
* table multiplier を調整する
* unwanted penalty を調整する
* skill priority base score を調整する
* score reasons が理解しやすいか確認する

### 確認観点

* 3/4 ideal match が十分高く評価されるか
* 4/4 ideal match が明確に上位になるか
* 不要スキル1個で過剰に落ちすぎないか
* priority route で不要スキルが効いているか
* desired skill d が minor skill e より高いか
* game score と custom score の違いが理解しやすいか

### Validation

* score top results がユーザー感覚と大きくズレない
* score reasons から判断根拠が分かる
* constants 調整が容易
* UIが重くならない

## Phase 11: Preset Profiles

### 目的

ユーザーが最初から使いやすい preset を提供する。

### Preset候補

* normal attack
* ougi
* ability damage
* defense
* general use

### 方針

* Phase 1 の user-defined profile が安定してから追加する
* preset は編集可能な profile として複製できるとよい
* preset と user profile を区別できるようにする

### Validation

* preset profile が保存済み user profile を壊さない
* preset を複製して編集できる
* import / export は後回しでもよい

## Phase 12: Advanced Formula Editor

### 目的

必要になった場合のみ、より自由度の高い custom scoring を提供する。

### 方針

初期実装では行わない。

追加条件:

* skill normalization が安定している
* score explanations が安定している
* rule/profile based scoring では不足する具体的要望がある
* formula editor の安全性とデバッグ性を確保できる

### 注意

* eval は使わない
* arbitrary code execution を避ける
* expression parser を使う場合も allowed fields を制限する
* UIで式の意味と結果を説明できること

## 推奨実装順

Custom Score の実装は以下の順で進める。

```text id="tb9n6k"
1. docs整理
2. skill catalog / normalization
3. score model
4. evaluator pure functions
5. evaluator tests
6. score profile storage
7. background messages
8. dashboard score display
9. score profile editor UI
10. CSV integration
11. tuning
12. presets
13. advanced formula editor
```

最初に UI から作らない。

理由:

* score仕様が UI に引っ張られる
* 評価ロジックのテストがしにくくなる
* storage schema が固まる前に複雑になる
* score explanation の設計が後回しになりやすい

## Validation Checklist

各 phase の完了時に確認する。

```bash id="u6e7e2"
npm run check
npm run build
```

test command がある場合:

```bash id="p85ox1"
npm test
```

またはプロジェクトの test script に従う。

### 共通チェック

* TypeScript error がない
* lint / format が通る
* build が通る
* observation-only 制約を破っていない
* GBF API request を追加していない
* DOM mutation を追加していない
* page navigation を追加していない
* scan / manage / display の責務が混ざっていない
* user review metadata が rescan で消えない
* custom score policy と artifact data が分離されている

## Files Likely to Change

### Docs

```text id="82fh2j"
README.md
AGENTS.md
.claude/CLAUDE.md
.codex/AGENTS.md
docs/*.md
```

### Custom Score Domain

```text id="ejxvw3"
src/domain/skill/
src/domain/score/
```

### Storage

```text id="v2it4m"
src/storage/artifactIndexedDb.ts
src/storage/scoreProfileStorage.ts
```

### Messages

```text id="0e7tve"
src/shared/messages.ts
src/background/index.ts
```

### Dashboard

```text id="lmmkk2"
src/dashboard/
```

### CSV

```text id="ue8d21"
src/csv/
```

## Files That Should Not Be Reintroduced

```text id="yry6e3"
src/popup/
popup.html
default_popup
```

Popup was migrated to Side Panel.

Do not reintroduce Popup unless explicitly requested.

## Risk Management

### Risk: accidentally returning to API fetch architecture

Mitigation:

* docs must say observation-only
* AGENTS / CLAUDE instructions must forbid extension-owned GBF requests
* no `fetchArtifactList` style implementation should be added for GBF API calls

### Risk: score logic becomes coupled to UI

Mitigation:

* evaluator is pure domain function
* UI only renders `ScoreResult`
* tests cover evaluator

### Risk: skill normalization becomes too large

Mitigation:

* use skill catalog data
* use small helper functions
* avoid a single giant conditional function

### Risk: calculated score becomes stale

Mitigation:

* do not persist score result initially
* calculate from Artifact + ScoreProfile
* cache only with explicit versioning if needed

### Risk: unwanted skill penalty hides ideal match value

Mitigation:

* final score uses max of ideal route and priority route
* unwanted penalty is applied mainly in priority route
* ideal route focuses on closeness to desired composition

### Risk: table rank overpowers skill priority

Mitigation:

* table rank is multiplier, not large independent additive score
* tune multipliers conservatively
* test desired skill rank d > minor skill rank e

## Done Criteria for Custom Score Phase 1

Phase 1 is complete when:

* user can define ideal skill composition
* user can define skill priority
* user can define unwanted skills
* evaluator calculates final score using `max(idealRouteScore, priorityRouteScore)`
* ideal route supports 1/4〜4/4 match
* slot position is ignored for ideal match
* priority route applies unwanted skill penalty
* table rank multiplier is applied
* Lv1 baseline policy is documented and reflected
* score result includes explanation reasons
* Dashboard can display custom score
* Dashboard can sort by custom score
* score profile is persisted locally
* no GBF API request is added
* no GBF DOM mutation is added
* `npm run check` passes
* `npm run build` passes
