# Data Model

## 方針

GBF Artifact Tool では、以下のデータを明確に分離する。

- 観測された API response
- アプリ内部で扱う normalized artifact
- scan session
- artifact presence / lifecycle
- user review metadata
- display mode state
- game score
- custom score settings / scoring policy
- calculated custom score result
- statistics result

理由:

- API 仕様変更の影響範囲を狭める
- UI 側で扱いやすくする
- 再スキャンで user review metadata を失わないようにする
- display mode が persistence / lifecycle を誤って更新しないようにする
- custom score の評価方針変更に artifact data が巻き込まれないようにする
- statistics や calculated score を必要に応じて再計算できるようにする

## 全体像

```text
Observed API Response
  -> RawArtifact
  -> Artifact

Scan lifecycle:
  -> ScanSession
  -> ArtifactPresence

User metadata:
  -> ArtifactUserReview

Display mode:
  -> DisplayState

Custom score:
  -> CustomScoreSettings
  -> ScoreEvaluator
  -> ScoreResult
````

## API Response Type と Domain Model の分離

API response type は、GBF ページ自身が取得した response の形を表す。

Domain model は、拡張機能内で扱いやすいように正規化した形を表す。

方針:

* API response type を UI で直接使わない
* CSV / filtering / sorting / scoring は domain model を使う
* raw data は debugging のため保持してよい
* response validation は保存前に行う
* response validation failure 時は persistence / lifecycle update を行わない

## Raw Models

Raw models は observed response の形を表す。

### ArtifactListResponse

```ts
type ArtifactListResponse = {
  list: RawArtifact[];
  first: number;
  last: number;
  prev: number;
  next: number;
  count: number;
  current: number;
  options: ArtifactListOptions;
  default_selector: unknown;
  has_default_selector: boolean;
};
```

### RawArtifact

```ts
type RawArtifact = {
  artifact_id: number;
  max_level: number;
  name: string;
  comment: string;
  rarity: string;
  is_quirk: boolean;
  score_info: RawScoreInfo;
  skill1_info: RawArtifactSkill;
  skill2_info: RawArtifactSkill;
  skill3_info: RawArtifactSkill;
  skill4_info: RawArtifactSkill;
  id: number;
  level: string;
  kind: string;
  attribute: string;
  next_exp: number;
  remain_next_exp: number;
  exp_width: number;
  is_locked: boolean;
  is_unnecessary: boolean;
  equip_npc_info: [] | RawEquipNpcInfo | RawEquipNpcInfo[];
};
```

### RawScoreInfo

```ts
type RawScoreInfo = {
  attack_score: number;
  defense_score: number;
  special_score: number;
  total_score: number;
};
```

### RawArtifactSkill

```ts
type RawArtifactSkill = {
  skill_id: number;
  skill_quality: number;
  level: number;
  name: string;
  is_max_quality: boolean;
  effect_value: string;
  icon_image: string;
  score_category: string;
};
```

### RawEquipNpcInfo

```ts
type RawEquipNpcInfo = {
  user_npc_id: number;
  image: string;
  name: string;
};
```

## Artifact

アプリ内部で扱う正規化済み artifact model。

```ts
type Artifact = {
  ownedId: number;
  artifactTypeId: number;
  name: string;
  rarity: number;
  level: number;
  maxLevel: number;
  kind: ArtifactKind;
  attribute: Attribute;
  isLocked: boolean;
  isMarkedUnnecessaryInGame: boolean;
  userMark: UserArtifactMark;
  gameScore: GameScore;
  customScore: CustomScore | null;
  skills: ArtifactSkill[];
  equippedCharacter: EquippedCharacter | null;
  raw: RawArtifact;
  scannedAt: string;
};
```

### 注意: `customScore`

現状の `Artifact` には `customScore` が存在する。

ただし、今後の Custom Score System では、calculated score を artifact record の primary source of truth として扱わない方針を優先する。

推奨方針:

```text
Artifact
-> observed normalized data

CustomScoreSettings
-> user-defined scoring policy

ScoreEvaluator
-> pure calculation logic

ScoreResult
-> calculated result for UI
```

`customScore` を cache として利用する場合は、以下の invalidation が必要。

* custom score settings が変わった
* evaluator version が変わった
* skill normalization logic が変わった
* artifact data が変わった

Phase 1 では、原則として `Artifact + CustomScoreSettings` から都度 `ScoreResult` を計算する。

## Artifact ID

### `ownedId`

```ts
ownedId: number;
```

GBF response の `id` に対応する。

ユーザーが所持する個別 artifact の識別子。

用途:

* IndexedDB primary key
* user review metadata の紐付け
* artifact presence の紐付け
* CSV出力

### `artifactTypeId`

```ts
artifactTypeId: number;
```

GBF response の `artifact_id` に対応する。

artifact の種別ID。

同種 artifact で共通する可能性があるため、primary key にはしない。

## ArtifactKind

API の `kind` は string として返るため、内部では raw と label を分ける。

```ts
type ArtifactKind = {
  raw: string;
  label: string;
};
```

暫定ラベル:

```ts
const ARTIFACT_KIND_LABELS: Record<string, string> = {
  "1": "kind-1",
  "2": "kind-2",
  "3": "kind-3",
  "4": "kind-4",
  "5": "kind-5",
  "6": "kind-6",
  "7": "kind-7",
  "8": "kind-8",
  "9": "kind-9",
  "10": "kind-10",
};
```

正式名称が判明したら置き換える。

## Attribute

```ts
type Attribute = {
  raw: string;
  label: string;
};
```

ラベル:

```ts
const ATTRIBUTE_LABELS: Record<string, string> = {
  "1": "火",
  "2": "水",
  "3": "土",
  "4": "風",
  "5": "光",
  "6": "闇",
};
```

## UserArtifactMark

ツール内でのユーザー判定。

```ts
type UserArtifactMark = "none" | "keep" | "trash" | "review";
```

注意:

* GBF側の `is_unnecessary` とは分離する
* このツールからゲーム状態を変更しない
* `UserArtifactMark` は将来的に廃止または `ArtifactUserReview` に統合される可能性がある

現在の主要な user review metadata は `rating` / `memo`。

## GameScore

GBF側のスコア。

```ts
type GameScore = {
  attack: number;
  defense: number;
  special: number;
  total: number;
};
```

対応:

```text
score_info.attack_score  -> gameScore.attack
score_info.defense_score -> gameScore.defense
score_info.special_score -> gameScore.special
score_info.total_score   -> gameScore.total
```

注意:

* game score は GBF 側の評価
* custom score とは別物
* UIでは game score と custom score を明確に分けて表示する

## CustomScore

現行 model に存在する calculated custom score 型。

```ts
type CustomScore = {
  total: number;
  attack: number;
  defense: number;
  special: number;
  reasons: CustomScoreReason[];
};
```

```ts
type CustomScoreReason = {
  skillId: number;
  skillName: string;
  delta: number;
  message: string;
};
```

今後の Custom Score System では、より説明可能な `ScoreResult` へ移行する方針。

```ts
type ScoreResult = {
  total: number;
  selectedRoute: "ideal" | "priority";
  idealRouteScore: number;
  priorityRouteScore: number;
  reasons: ScoreReason[];
};
```

## ArtifactSkill

アプリ内部で扱う正規化済み skill model。

```ts
type ArtifactSkill = {
  slot: 1 | 2 | 3 | 4;
  skillId: number;
  quality: number;
  level: number;
  name: string;
  isMaxQuality: boolean;
  effectValueText: string;
  parsedValue: ParsedEffectValue | null;
  iconImage: string;
  scoreCategory: ScoreCategory;
};
```

対応:

```text
skill1_info -> slot 1
skill2_info -> slot 2
skill3_info -> slot 3
skill4_info -> slot 4
```

### slot

```ts
slot: 1 | 2 | 3 | 4;
```

用途:

* UI表示
* CSV出力
* 第1〜第4スキルの仕様差を扱う
* 将来の slot-specific scoring に備える

Custom Score Phase 1 の理想構成一致判定では、slot position は見ない。

### skillId

```ts
skillId: number;
```

GBF response の `skill_id`。

用途:

* skill normalization
* custom score settings matching
* raw name fallback の回避
* debugging

### quality

```ts
quality: number;
```

GBF response の `skill_quality`。

用途:

* UI表示
* CSV出力
* skill quality 推定
* debugging

暫定 skill quality 推定:

```ts
type SkillQuality = "A" | "B" | "C" | "D" | "E";

function inferSkillQuality(quality: number): SkillQuality | null {
  switch (quality) {
    case 1:
      return "E";
    case 2:
      return "D";
    case 3:
      return "C";
    case 4:
      return "B";
    case 5:
      return "A";
    default:
      return null;
  }
}
```

注意:

* 第4スキルは A〜E スキルクオリティではない可能性が高い
* `effectValueText` と skill catalog から検証できる場合は併用する
* quality だけに強く依存しすぎない

### level

```ts
level: number;
```

スキルレベル。

注意:

* 表示やCSVには現在値を使う
* Custom Score Phase 1 では Lv1 baseline 評価を行う
* 現在の skill level と長期評価を混ぜない

### name

```ts
name: string;
```

用途:

* UI表示
* CSV出力
* score explanation
* fallback normalization

注意:

* scoring policy は raw name includes に依存しすぎない
* normalized key / skillId を優先する

### effectValueText

```ts
effectValueText: string;
```

raw `effect_value` を保持する。

例:

* `+10.4%`
* `+1320`
* `10倍`
* `8回`
* `最大5000`
* `-`

### parsedValue

```ts
type ParsedEffectValue = {
  value: number;
  unit: "percent" | "flat" | "times" | "count" | "unknown";
};
```

例:

```text
+10.4% -> { value: 10.4, unit: "percent" }
+1320  -> { value: 1320, unit: "flat" }
10倍   -> { value: 10, unit: "times" }
8回    -> { value: 8, unit: "count" }
```

parse できない場合は `null` または `unit: "unknown"` とする。

方針:

* parse failure で artifact 全体を破棄しない
* raw text は保持する
* UI / debugging で確認できるようにする

### scoreCategory

GBF側のスコアカテゴリ。

```ts
type ScoreCategory = "attack" | "defense" | "special" | "unknown";
```

対応:

```ts
const SCORE_CATEGORY_MAP: Record<string, ScoreCategory> = {
  "1": "attack",
  "2": "defense",
  "3": "special",
};
```

注意:

* GBF側カテゴリであり、custom score のカテゴリとは別物
* custom score 用 category は skill catalog で別定義する可能性がある

## EquippedCharacter

```ts
type EquippedCharacter = {
  userNpcId: number;
  image: string;
  name: string;
};
```

`equip_npc_info` が空配列の場合は `null` とする。

## ArtifactUserReview

ユーザーが artifact に付与する review metadata。

```ts
type ArtifactUserReview = {
  ownedId: number;
  rating: ArtifactRating;
  memo: string;
  updatedAt: string;
};
```

```ts
type ArtifactRating = 0 | 1 | 2 | 3 | 4 | 5;
```

方針:

* `ownedId` で artifact と紐付ける
* `Artifact` 本体とは別 store に保存する
* 再スキャンで消さない
* display mode / dashboard の両方から参照できる
* GBF側の `is_unnecessary` と混同しない

## ScanSession

スキャン単位を表す model。

```ts
type ScanSession = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  observedPages: number[];
  expectedLastPage: number | null;
  status: ScanSessionStatus;
  errorMessage?: string;
};
```

```ts
type ScanSessionStatus =
  | "active"
  | "completed"
  | "cancelled"
  | "error";
```

用途:

* scan lifecycle tracking
* full scan 判定
* possiblyDeleted 判定の根拠
* extension reload 後の状態復元
* debugging

方針:

* active session を復元できること
* full scan 完了前に deletion 判定を行わない
* error 状態を区別する

## ArtifactPresence

artifact の存在状態を表す lifecycle model。

```ts
type ArtifactPresence = {
  ownedId: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastSeenScanSessionId: string;
  status: ArtifactPresenceStatus;
  possiblyDeletedAt?: string;
};
```

```ts
type ArtifactPresenceStatus = "active" | "possiblyDeleted";
```

用途:

* 現在も存在する artifact の判定
* 削除された可能性がある artifact の判定
* lifecycle filtering
* CSV出力

方針:

* completed full scan 後にのみ `possiblyDeleted` 判定する
* partial scan だけで `possiblyDeleted` にしない
* `ArtifactUserReview` は削除しない
* legacy artifact に対して backfill できること

## ScanMetadata

直近スキャンの概要。

```ts
type ScanMetadata = {
  id: "lastScan";
  scannedPage: number;
  scannedAt: string;
  artifactCount: number;
};
```

用途:

* Side Panel scan status
* Dashboard summary
* debugging

注意:

* 詳細な lifecycle は `ScanSession` / `ArtifactPresence` を使う
* `ScanMetadata` だけで deletion 判定しない

## DisplayState

display mode の状態。

```ts
type DisplayState = {
  isActive: boolean;
  currentPage: number | null;
  lastObservedAt: string | null;
  artifacts: DisplayArtifactItem[];
  error: DisplayError | null;
};
```

```ts
type DisplayArtifactItem = {
  artifact: Artifact;
  review: ArtifactUserReview | null;
};
```

```ts
type DisplayError = {
  code: string;
  message: string;
};
```

方針:

* Side Panel companion view のための状態
* current observed GBF artifact page を表す
* persistence / lifecycle update には使わない
* rating / memo は local review metadata から参照する

## AppMode

```ts
type AppMode = "scan" | "display";
```

### scan

artifact observation and persistence mode.

### display

side-panel companion display mode.

display mode は persistence / lifecycle を更新しない。

## AppState

```ts
type AppState = {
  mode: AppMode;
  scan: ScanState;
  display: DisplayState;
};
```

```ts
type ScanState = {
  isObserving: boolean;
  currentPage: number | null;
  lastPage: number | null;
  totalCount: number | null;
  scannedPages: number[];
  lastScannedAt: string | null;
  error: ScanError | null;
};
```

```ts
type ScanError = {
  code: ScanErrorCode;
  message: string;
};
```

## IndexedDB Stores

IndexedDB database:

```text
gbf-artifact-manager
```

現在の主な stores:

```text
artifacts
scanMetadata
artifactUserReviews
scanSessions
artifactPresence
```

将来追加候補:

```text
scoreSettings
scoreSettings
```

### artifacts

保存対象:

```ts
Artifact
```

key:

```text
ownedId
```

### scanMetadata

保存対象:

```ts
ScanMetadata
```

key:

```text
id
```

### artifactUserReviews

保存対象:

```ts
ArtifactUserReview
```

key:

```text
ownedId
```

### scanSessions

保存対象:

```ts
ScanSession
```

key:

```text
id
```

### artifactPresence

保存対象:

```ts
ArtifactPresence
```

key:

```text
ownedId
```

## Statistics

Statistics は永続化しない。

保存済み artifact と user review metadata から in-memory で計算する。

```ts
type ArtifactStatistics = {
  totalCount: number;
  activeCount: number;
  possiblyDeletedCount: number;
  lockedCount: number;
  equippedCount: number;
  ratingDistribution: Record<ArtifactRating, number>;
  attributeDistribution: Record<string, number>;
  kindDistribution: Record<string, number>;
  skillSummary: SkillSummaryItem[];
};
```

```ts
type SkillSummaryItem = {
  skillId: number;
  name: string;
  count: number;
};
```

方針:

* Dashboard 表示時に計算する
* performance issue が出るまでは永続化しない
* statistics result を source of truth にしない

## Custom Score Models

Custom Score System は今後実装予定。

Phase 1 では、自由数式エディタではなく rule/profile based scoring とする。

### CustomScoreSettings

```ts
type CustomScoreSettings = {
  idealSkillConfigurations: IdealSkillConfiguration[];
  idealMatchScores: IdealMatchScores;
  skillScores: SkillScores;
  tableRankPenalties: TableRankPenalties;
  updatedAt: string;
};

type IdealSkillConfiguration = {
  id: string;
  comment: string;
  attributeKeys: string[];
  kindKeys: string[];
  firstSecondSlotSkillKeys: [NormalizedSkillKey | null, NormalizedSkillKey | null];
  thirdSlotSkillKey: NormalizedSkillKey | null;
  fourthSlotSkillKey: NormalizedSkillKey | null;
};
```

```ts
type SkillScoreEntry = {
  skillKey: NormalizedSkillKey;
  score: number;
};

type SkillScores = {
  firstSecondSlot: SkillScoreEntry[];
  thirdSlot: SkillScoreEntry[];
  fourthSlot: SkillScoreEntry[];
};
```

### UnwantedSkillConfig

将来のUI強調表示用データとして保持できるが、custom score の加点・減点には使用しない。

```ts
type UnwantedSkillConfig = {
  skillKeys: NormalizedSkillKey[];
  updatedAt: string;
};
```

### ScoreResult

```ts
type ScoreResult = {
  total: number;
  selectedRoute: "ideal" | "priority";
  idealRouteScore: number;
  priorityRouteScore: number;
  reasons: ScoreReason[];
};
```

### ScoreReason

```ts
type ScoreReason = {
  type:
    | "ideal_match"
    | "priority_skill"
    | "table_penalty";
  skillKey?: NormalizedSkillKey;
  label: string;
  delta: number;
};
```

### Score Constants

初期候補。

```ts
const DEFAULT_IDEAL_MATCH_SCORES = {
  1: 0,
  2: 0,
  3: 75,
  4: 100,
} as const;
```

```ts
const DEFAULT_TABLE_RANK_PENALTIES = {
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  e: 4,
} as const;
```

これらは実利用で調整する。

## Normalized Skill Model

Custom Score では、raw skill name ではなく normalized skill key を使う。

```ts
type NormalizedSkillKey = string;
```

```ts
type NormalizedArtifactSkill = {
  rawName: string;
  normalizedKey: NormalizedSkillKey;
  slot: 1 | 2 | 3 | 4;
  skillId: number;
  level: number;
  value?: number;
  unit?: "percent" | "flat" | "times" | "count" | "unknown";
  tableRank?: TableRank;
  category?: SkillCategory;
};
```

```ts
type SkillCategory =
  | "normal_attack"
  | "ougi"
  | "ability"
  | "defense"
  | "healing"
  | "utility"
  | "drop"
  | "unknown";
```

方針:

* `skillId` から `normalizedKey` を引けるようにする
* raw name は fallback と UI 表示に使う
* normalization と score evaluation を分離する
* 巨大な normalize 関数にしない
* skill catalog + 小さな helper で構成する

## TableRank

```ts
type TableRank = "a" | "b" | "c" | "d" | "e";
```

推定方法候補:

1. `skill_quality` から推定
2. `skillId` + `level` + `effectValueText` から効果量表と照合
3. 不明な場合は `undefined`

Phase 1 では、まず `skill_quality` ベースを優先し、必要に応じて効果量表照合を追加する。

注意:

* 第4スキルは A〜E quality ではない可能性が高い
* slot別に skill quality の扱いを変える
* rank 不明時は減点`0`として扱う

## Custom Score Evaluation

最終スコア:

```text
finalScore =
  max(
    idealRouteScore,
    priorityRouteScore
  )
```

### Ideal Route

```text
idealRouteScore =
  ideal match score
  - skill-quality penalties for concretely matched skills
```

仕様:

* 1/4, 2/4, 3/4, 4/4 で一致判定
* 1～2枠は順不同、3枠と4枠は対応する枠で判定
* 未選択枠は一致として扱う
* 理想構成に近いかを最重要視する

### Priority Route

```text
priorityRouteScore =
  sum of max(0, per-skill score - skill-quality penalty)
```

仕様:

* 各枠グループの全スキルへ0～25点を設定
* 4枠の基礎点合計は最大100
* unwanted skill metadata はスコアへ影響しない

## Data Ownership Rules

### Artifact

Artifact は observed normalized data を表す。

Artifact に含めてよいもの:

* GBF response 由来の情報
* 正規化した表示情報
* raw response
* scannedAt

Artifact に primary source として含めない方がよいもの:

* user review metadata
* custom score settings
* calculated score result
* statistics result

### ArtifactUserReview

User review はユーザー所有データ。

再スキャンで消してはいけない。

### CustomScoreSettings

Custom score settings はユーザー所有の単一 scoring policy。

Artifact data とは独立させる。

### ScoreResult

Score result は計算結果。

原則として `Artifact + CustomScoreSettings + Evaluator` から都度計算する。

### Statistics

Statistics は計算結果。

原則として保存せず、必要時に計算する。

## Migration / Backfill

### ArtifactPresence Backfill

legacy artifact data に presence record がない場合、backfill を行う。

方針:

* 既存 artifact から `ArtifactPresence` を作成する
* `firstSeenAt` / `lastSeenAt` は可能な範囲で推定する
* user review metadata は変更しない

### Future Score Migration

Custom Score 実装時に `Artifact.customScore` が既に存在する場合でも、settings-based evaluation へ移行する。

方針:

* 既存 `customScore` を source of truth としない
* 新しい `ScoreResult` を UI で優先する
* cache が必要なら version を持たせる

## Validation Rules

### Raw response validation

保存前に行う。

確認:

* root object
* `list` array
* paging fields
* artifact required fields
* skill1〜skill4 required fields
* score_info required fields

### Domain validation

正規化時に行う。

確認:

* `ownedId` が number
* `artifactTypeId` が number
* `skills.length === 4`
* `slot` が 1〜4
* `gameScore.total` が number
* `scannedAt` が ISO string

### User input validation

対象:

* rating
* memo
* custom score settings
* ideal skill configurations
* per-skill scores for every slot group

方針:

* rating は 0〜5
* memo は string
* ideal match scores は 0 から 100 の整数で単調増加にする
* skill keys は known catalog または fallback key
* skill scores は全選択肢を含む0から25の整数にする
* ideal skill configuration の属性×武器種範囲は重複させない

## Naming Guidelines

* GBF response の field 名は raw model で維持する
* domain model では camelCase を使う
* `id` は曖昧なので domain model では `ownedId` とする
* `artifact_id` は `artifactTypeId` とする
* game score と custom score を混同しない
* user review と game-side unnecessary flag を混同しない

## Summary

このデータモデルでは、以下を守る。

* API response と domain model を分離する
* Artifact と user review metadata を分離する
* scan lifecycle と artifact data を分離する
* display state と persistence を分離する
* game score と custom score を分離する
* score policy と calculated score result を分離する
* statistics は原則として保存しない
