# Data Model

## 方針

API レスポンス型とアプリ内部型を分ける。

理由:

- API 仕様変更の影響範囲を狭める
- UI 側で扱いやすくする
- スコア計算や CSV 出力を API 形式に依存させない

## 内部モデル

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

## ArtifactKind

API の `kind` は string として返るため、内部では明示的に扱う。

```ts
type ArtifactKind = {
  raw: string;
  label: string;
};
```

初期実装では raw 値を保持し、label は暫定で以下のように扱う。

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
  "10": "kind-10"
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

初期ラベル案:

```ts
const ATTRIBUTE_LABELS: Record<string, string> = {
  "1": "火",
  "2": "水",
  "3": "土",
  "4": "風",
  "5": "光",
  "6": "闇"
};
```

## UserArtifactMark

管理画面上のユーザー判定。

```ts
type UserArtifactMark = "none" | "keep" | "trash" | "review";
```

ゲーム側の `is_unnecessary` とは分離する。

理由:

- ゲーム内状態とツール内判断を混同しない
- このツールからゲーム状態を変更しない
- CSV 出力時に両方を確認できる

## GameScore

```ts
type GameScore = {
  attack: number;
  defense: number;
  special: number;
  total: number;
};
```

## CustomScore

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

## ArtifactSkill

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

## ParsedEffectValue

```ts
type ParsedEffectValue = {
  value: number;
  unit: "percent" | "flat" | "times" | "count" | "unknown";
};
```

例:

- `+10.4%` -> `{ value: 10.4, unit: "percent" }`
- `+1320` -> `{ value: 1320, unit: "flat" }`
- `10倍` -> `{ value: 10, unit: "times" }`
- `8回` -> `{ value: 8, unit: "count" }`

## ScoreCategory

```ts
type ScoreCategory = "attack" | "defense" | "special" | "unknown";
```

API の `score_category` 対応:

```ts
const SCORE_CATEGORY_MAP: Record<string, ScoreCategory> = {
  "1": "attack",
  "2": "defense",
  "3": "special"
};
```

## EquippedCharacter

```ts
type EquippedCharacter = {
  userNpcId: number;
  image: string;
  name: string;
};
```

`equip_npc_info` が空配列の場合は `null` とする。

## ScanState

```ts
type ScanState = {
  currentPage: number | null;
  lastPage: number | null;
  totalCount: number | null;
  scannedPages: number[];
  lastScannedAt: string | null;
};
```

## AppMode

```ts
type AppMode = "scan" | "manage";
```

## AppState

```ts
type AppState = {
  mode: AppMode;
  scan: ScanState;
};
```

管理データは Artifact / Rule / UI Preference として別管理する。
