# API Contract

## 対象API

DevTools Network で確認されたアーティファクト一覧 API を利用する。

```txt
GET https://game.granbluefantasy.jp/rest/artifact/list/{page}?_={timestamp}&t={timestamp}&uid={uid}
```

例:

```txt
https://game.granbluefantasy.jp/rest/artifact/list/1?_=1779596370826&t=1779596370826&uid=10829940
```

## 重要な注意

`uid`, `_`, `t` はハードコードしない。

- `uid`: ユーザー固有値
- `_`: キャッシュ回避用と推定
- `t`: 時刻系パラメータと推定

初期実装では、現在ページで発生している情報、またはページ内の既存情報から取得する方針とする。

## レスポンス概要

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
  equip_npc_info: [] | RawEquipNpcInfo;
};
```

## Raw Score Info

```ts
type RawScoreInfo = {
  attack_score: number;
  defense_score: number;
  special_score: number;
  total_score: number;
};
```

## Raw Skill

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

## Raw Equip NPC Info

```ts
type RawEquipNpcInfo = {
  user_npc_id: number;
  image: string;
  name: string;
};
```

## ページング

レスポンスには以下が含まれる。

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

設計方針:

- `current`: 現在ページ
- `last`: 最終ページ
- `next`: 次ページ
- `count`: 総件数
- 自動で `next` を辿らない
- ユーザーが手動でページ遷移した後、そのページをスキャンする

## options

`options` はソート・フィルタ・所持数などを含む。

初期実装では以下のみ利用候補とする。

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

## バリデーション方針

API レスポンスは外部入力として扱う。

最低限確認すること:

- `list` が配列である
- `current`, `last`, `count` が number である
- 各 artifact に `id`, `artifact_id`, `name`, `score_info` がある
- skill1〜4 が存在する

不正データは保存前に除外、またはエラーとして扱う。
