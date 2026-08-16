# API Contract

## 目的

このドキュメントは、GBF Artifact Tool が観測対象とするアーティファクト一覧レスポンスの構造を定義する。

重要:

- この拡張機能は GBF API へ独自に request を送信しない
- この拡張機能は artifact list URL を組み立てない
- この拡張機能は `uid`, `_`, `t` などの query parameter を使って request を再現しない
- 観測対象は、GBF ページ自身が取得した network response のみ

## 観測対象

GBF ページ自身が取得する以下の endpoint shape を観測する。

```text
/rest/artifact/list/{page}
````

実際の network request には query parameter が付く場合がある。

例:

```text
https://game.granbluefantasy.jp/rest/artifact/list/1?_=1779596370826&t=1779596370826&uid=10829940
```

ただし、これらの query parameter は request 再現には使わない。

## 重要な制約

### 禁止

* 拡張機能から `/rest/artifact/list/{page}` へ fetch しない
* URL を組み立てて artifact list を取得しない
* `uid` を抽出して request に使わない
* `_` / `t` を生成して request に使わない
* 自動で `next` を辿らない
* retry / polling により GBF 側通信を増やさない

### 許可

* GBF ページ自身が受け取った response を page-context observer で観測する
* 観測した response URL が `/rest/artifact/list/{page}` に一致するか判定する
* response body を clone / parse して content bridge へ渡す
* background service worker で schema validation する
* validation 後に domain model へ正規化する
* scan mode の場合のみ artifact persistence / lifecycle update を行う
* display mode の場合は現在ページ表示用 state として扱う

## 観測フロー

```text
GBF page's own request
  ↓
GBF page receives response
  ↓
page-context fetch/XHR observer detects /rest/artifact/list/{page}
  ↓
observer clones/parses response
  ↓
content bridge forwards observed payload
  ↓
background service worker validates payload
  ↓
normalizer converts RawArtifact to Artifact
  ↓
scan mode:
  IndexedDB persistence + lifecycle update

display mode:
  DisplayState update only
```

## Endpoint Matching

観測対象の判定は path に基づいて行う。

推奨判定:

```ts
function isArtifactListPath(pathname: string): boolean {
  return /^\/rest\/artifact\/list\/\d+$/.test(pathname);
}
```

URL全体や query parameter に依存しない。

理由:

* `uid`, `_`, `t` はユーザーやタイミングにより変化する
* query parameter は request 再現に使ってはいけない
* path のみで観測対象を識別できる

## Page Number

`/rest/artifact/list/{page}` の `{page}` は、観測された response URL から読み取れる。

ただし、保存・表示に使うページ番号は response body の `current` を優先する。

理由:

* URL path と response body が食い違った場合、response body の方が実データに近い
* validation で `current` が number であることを確認する

## Response Overview

観測される artifact list response は以下の形を想定する。

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

## Paging Fields

```ts
type Paging = {
  first: number;
  last: number;
  prev: number;
  next: number;
  count: number;
  current: number;
};
```

意味:

* `first`: 最初のページ
* `last`: 最終ページ
* `prev`: 前ページ
* `next`: 次ページ
* `count`: 総件数
* `current`: 現在ページ

設計方針:

* `current` は scan session の observed page として使う
* `last` は full scan 判定の参考にする
* `count` は scan status / statistics の参考にする
* `next` は自動ページ遷移や自動取得には使わない
* ユーザーが手動でページ遷移し、その結果を拡張機能が観測する

## Raw Artifact

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

### ID Fields

#### `id`

ユーザーが所持している個別アーティファクトの ID。

内部モデルでは `ownedId` として扱う。

主キーとして使う。

#### `artifact_id`

アーティファクト種別 ID。

内部モデルでは `artifactTypeId` として扱う。

同じ種類のアーティファクトで共通する可能性があるため、主キーにはしない。

## Raw Score Info

```ts
type RawScoreInfo = {
  attack_score: number;
  defense_score: number;
  special_score: number;
  total_score: number;
};
```

内部モデルでは `GameScore` に変換する。

```ts
type GameScore = {
  attack: number;
  defense: number;
  special: number;
  total: number;
};
```

注意:

* `GameScore` はGBF側のスコア
* custom score とは別物
* UIでは game score と custom score を区別して表示する

## Raw Artifact Skill

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

### `skill_id`

スキル識別子。

方針:

* 可能であれば skill normalization の primary key として使う
* raw name の部分一致より安定した判定に使う
* ただし将来の仕様変更に備えて `name` も保持する

### `skill_quality`

スキルの品質値。

想定:

* 第1〜第3スキルでは、スキルクオリティ A〜E の推定に使える
* `1` が低く、`5` が高い品質として扱える可能性がある
* `is_max_quality: true`の場合は数値にかかわらず最高品質`A`として扱う
* 第4スキルは`is_max_quality: true`であり、表示上は`A`として扱う。ただしスコア減点の対象外とする

暫定変換候補:

```ts
type SkillQuality = "A" | "B" | "C" | "D" | "E";

function inferSkillQuality(skillQuality: number): SkillQuality | null {
  switch (skillQuality) {
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

* これは初期仮説であり、実データで検証する
* 第4スキルは A〜E スキルクオリティではない可能性が高いため、slot別に扱う
* `effect_value` と `level` から逆算検証できる場合は、そちらも利用する

### `level`

スキルレベル。

Custom Score Phase 1 では、評価基準は Lv1 baseline とする。

ただし raw value としては保持する。

理由:

* 現在の表示には必要
* CSV出力には有用
* 将来的な現在値評価や期待値評価に利用できる

### `name`

スキル名。

用途:

* UI表示
* CSV出力
* fallback normalization
* score explanation 表示

注意:

* scoring rule の primary matching を raw name includes に依存しすぎない
* できるだけ normalized skill key / skill_id を利用する

### `is_max_quality`

最大品質かどうか。

用途:

* UI表示
* debugging
* skill quality 推定の補助

注意:

* `is_max_quality: true` はスキルクオリティ`A`として扱う。第4枠のみクオリティ減点を適用しない
* 第4スキルでは品質仕様が異なる可能性がある

### `effect_value`

効果量文字列。

例:

```text
+10.4%
+1320
10倍
8回
4%
0.2%
最大5000
-
```

内部モデルでは可能な範囲で parse する。

```ts
type ParsedEffectValue = {
  value: number;
  unit: "percent" | "flat" | "times" | "count" | "unknown";
};
```

parse examples:

```text
+10.4% -> { value: 10.4, unit: "percent" }
+1320  -> { value: 1320, unit: "flat" }
10倍   -> { value: 10, unit: "times" }
8回    -> { value: 8, unit: "count" }
4%     -> { value: 4, unit: "percent" }
```

注意:

* `最大5000` のような表現は `unknown` または専用unitを将来検討する
* `-` は parse 不能として扱う
* parse failure は artifact 全体の保存失敗に直結させない
* raw `effect_value` は必ず保持する

### `icon_image`

スキルアイコン識別子。

用途:

* UI表示
* debugging

### `score_category`

GBF側のスコアカテゴリ。

暫定マッピング:

```ts
type ScoreCategory = "attack" | "defense" | "special" | "unknown";

const SCORE_CATEGORY_MAP: Record<string, ScoreCategory> = {
  "1": "attack",
  "2": "defense",
  "3": "special",
};
```

注意:

* これはGBF側カテゴリであり、custom score settings の分類とは別物
* custom score の skill category は別途 normalized catalog で定義する可能性がある

## Raw Equip NPC Info

`equip_npc_info` は未装備時に空配列、装備時に object または配列で返る可能性を考慮する。

```ts
type RawEquipNpcInfo = {
  user_npc_id: number;
  image: string;
  name: string;
};
```

内部モデルでは以下に正規化する。

```ts
type EquippedCharacter = {
  userNpcId: number;
  image: string;
  name: string;
};
```

未装備の場合:

```ts
equippedCharacter = null;
```

方針:

* `equip_npc_info` が空配列の場合は `null`
* object の場合はそのまま変換
* 配列に要素がある場合は先頭要素を使う、または validation 方針に従う

## Options

`options` はソート・フィルタ・所持数などを含む。

初期利用候補:

```ts
type ArtifactListOptions = {
  max_number: number;
  number: number;
  sort: unknown;
  filter: unknown;
  tpl_type: "artifact" | string;
  status: number;
};
```

方針:

* 初期実装では artifact list の保存に必須ではない
* debugging と将来拡張のために schema で許容する
* 不明な詳細構造に過度に依存しない

## Validation Policy

観測された response は外部入力として扱う。

最低限確認すること:

* response root が object である
* `list` が array である
* `current`, `last`, `count` が number である
* `first`, `prev`, `next` が number である
* 各 artifact に `id`, `artifact_id`, `name`, `score_info` がある
* 各 artifact に `skill1_info`〜`skill4_info` がある
* 各 skill に `skill_id`, `skill_quality`, `level`, `name`, `effect_value`, `score_category` がある

Validation failure の扱い:

* 保存しない
* scan state に error を反映する
* UIには短いエラーを表示する
* console には詳細を出す
* 不正 response をもとに lifecycle update しない

## Normalization Policy

Raw response は domain model に正規化して扱う。

Raw:

```ts
type RawArtifact = {
  id: number;
  artifact_id: number;
  rarity: string;
  level: string;
  kind: string;
  attribute: string;
  is_locked: boolean;
  is_unnecessary: boolean;
  score_info: RawScoreInfo;
  skill1_info: RawArtifactSkill;
  skill2_info: RawArtifactSkill;
  skill3_info: RawArtifactSkill;
  skill4_info: RawArtifactSkill;
};
```

Domain:

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
  gameScore: GameScore;
  skills: ArtifactSkill[];
  equippedCharacter: EquippedCharacter | null;
  raw: RawArtifact;
  scannedAt: string;
};
```

方針:

* raw response は debugging のため保持する
* UIやCSVは domain model を使う
* score calculation は domain model または normalized skill model を使う
* custom score policy が raw response に直接依存しないようにする

## Skill Slot Policy

Artifact は4つの skill を持つ。

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

slot mapping:

```text
skill1_info -> slot 1
skill2_info -> slot 2
skill3_info -> slot 3
skill4_info -> slot 4
```

Custom Score Phase 1 の理想構成一致判定では、slot position は見ない。

ただし、domain model では slot を保持する。

理由:

* UI表示に必要
* CSV出力に必要
* 将来の slot-specific scoring に備える
* 第1〜第4スキルで仕様が異なるため、normalization に必要

## Custom Score Related Contract

Custom Score の初期実装では、以下の raw fields が重要になる。

```text
skill_id
skill_quality
level
name
effect_value
slot
```

### Normalized Skill Key

Scoring は raw `name` への部分一致に依存しすぎない。

推奨:

```ts
type NormalizedSkillKey = string;
```

候補:

* `skill_id` をもとに key を決める
* known skill catalog で `skill_id -> normalizedKey` を定義する
* 不明な skill は fallback key を生成する

例:

```ts
type NormalizedArtifactSkill = {
  rawName: string;
  normalizedKey: string;
  slot: 1 | 2 | 3 | 4;
  skillId: number;
  level: number;
  value?: number;
  unit?: string;
  tableRank?: "a" | "b" | "c" | "d" | "e";
  category?: string;
};
```

### Skill Quality

Phase 1 では Lv1 baseline で評価する。

候補:

* `skill_quality` から skill quality を推定する
* `effect_value` と known effect table から skill quality を検証する
* 第4スキルは A〜E 評価から除外、または別評価にする

## Storage Policy

API response そのものを主データとして扱わず、正規化後の Artifact を保存する。

ただし debugging のため `raw` は保持する。

保存対象:

* normalized artifacts
* scan metadata
* scan sessions
* artifact presence
* user review metadata

保存しないもの:

* observed URL の query parameter
* request recreation data
* external sync data
* calculated statistics

Custom Score について:

* custom score settings / scoring policy は別 store に保存する
* calculated score result は原則として都度計算する
* cache する場合は evaluator version / profile version / normalization version で invalidation する

## Security and Privacy Notes

* `uid` はユーザー固有値の可能性があるため、保存・出力・ログ表示に注意する
* observed URL 全体を不要に保存しない
* artifact data は外部送信しない
* CSV export はユーザー操作によるローカル生成のみ
* console log に個人識別性のあるURLやqueryを出しすぎない

## Example Response Shape

簡略例:

```json
{
  "list": [
    {
      "artifact_id": 301020301,
      "max_level": 5,
      "name": "金華面具",
      "comment": "",
      "rarity": "3",
      "is_quirk": false,
      "score_info": {
        "attack_score": 13,
        "defense_score": 7,
        "special_score": 0,
        "total_score": 20
      },
      "skill1_info": {
        "skill_id": 30113,
        "skill_quality": 3,
        "level": 1,
        "name": "自属性攻撃力",
        "is_max_quality": false,
        "effect_value": "+10.4%",
        "icon_image": "bonus_28",
        "score_category": "1"
      },
      "skill2_info": {
        "skill_id": 30101,
        "skill_quality": 1,
        "level": 1,
        "name": "回復性能",
        "is_max_quality": false,
        "effect_value": "+13.2%",
        "icon_image": "bonus_28",
        "score_category": "2"
      },
      "skill3_info": {
        "skill_id": 30271,
        "skill_quality": 1,
        "level": 1,
        "name": "最大HP上昇/防御力-70%",
        "is_max_quality": false,
        "effect_value": "+8.8%",
        "icon_image": "bonus_29",
        "score_category": "2"
      },
      "skill4_info": {
        "skill_id": 50031,
        "skill_quality": 1,
        "level": 1,
        "name": "回復アビリティ使用時、自分の次に配置されたキャラに自属性追撃効果(1回)",
        "is_max_quality": true,
        "effect_value": "4%",
        "icon_image": "bonus_30",
        "score_category": "1"
      },
      "id": 15345006,
      "level": "1",
      "kind": "2",
      "attribute": "5",
      "next_exp": 30000,
      "remain_next_exp": 30000,
      "exp_width": 0,
      "is_locked": false,
      "is_unnecessary": false,
      "equip_npc_info": []
    }
  ],
  "first": 1,
  "last": 10,
  "prev": 0,
  "next": 2,
  "count": 200,
  "current": 1,
  "options": {
    "max_number": 1000,
    "number": 200,
    "sort": {},
    "filter": {},
    "tpl_type": "artifact",
    "status": 0
  },
  "default_selector": null,
  "has_default_selector": false
}
```

## Implementation Notes

### Observer

Observer should:

* match `/rest/artifact/list/{page}`
* clone response safely
* avoid breaking original response consumption
* send parsed body to content bridge

Observer should not:

* alter request
* alter response
* retry failed request
* initiate request

### Background

Background should:

* validate response
* normalize response
* branch behavior by current mode
* persist only in scan mode
* update display state only in display mode
* report validation / persistence errors

### Tests

Useful test targets:

* schema accepts sample response
* schema rejects invalid response
* `RawArtifact -> Artifact` normalization
* `effect_value` parser
* `skill_quality -> tableRank` inference
* endpoint path matching
* display mode does not call persistence functions
* scan mode updates persistence / presence
