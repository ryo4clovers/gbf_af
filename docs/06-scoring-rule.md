# Scoring Rule

## 目的

ゲーム内スコアとは別に、ユーザー独自の評価軸でアーティファクトを評価する。

## 方針

- ゲーム内スコアは保持する。
- 独自スコアは別フィールドで計算する。
- スコアルールはユーザーが編集可能にする。
- 初期実装ではルールをシンプルに保つ。

## ScoreRule

```ts
type ScoreRule = {
  id: string;
  enabled: boolean;
  name: string;
  match: ScoreRuleMatch;
  score: ScoreRuleScore;
  note?: string;
};
```

## ScoreRuleMatch

```ts
type ScoreRuleMatch = {
  skillId?: number;
  skillNameIncludes?: string;
  scoreCategory?: "attack" | "defense" | "special";
  minQuality?: number;
  isMaxQuality?: boolean;
};
```

## ScoreRuleScore

```ts
type ScoreRuleScore = {
  base: number;
  perValue?: number;
  attack?: number;
  defense?: number;
  special?: number;
};
```

## 計算方針

1. Artifact の各 Skill を確認する。
2. 有効な ScoreRule と照合する。
3. 条件一致したルールを加点 / 減点する。
4. Artifact 単位で合計する。
5. 理由を `reasons` に保存する。

## 初期ルール例

```ts
const DEFAULT_SCORE_RULES: ScoreRule[] = [
  {
    id: "attack-power",
    enabled: true,
    name: "攻撃力を評価",
    match: {
      skillNameIncludes: "攻撃力"
    },
    score: {
      base: 5,
      attack: 5
    }
  },
  {
    id: "damage-cap",
    enabled: true,
    name: "ダメージ上限系を評価",
    match: {
      skillNameIncludes: "ダメージ上限"
    },
    score: {
      base: 10,
      attack: 10
    }
  },
  {
    id: "max-quality",
    enabled: true,
    name: "最大品質を評価",
    match: {
      isMaxQuality: true
    },
    score: {
      base: 3
    }
  }
];
```

## 注意点

### スキル名依存のリスク

スキル名の部分一致は実装しやすいが、表記変更に弱い。

できるだけ `skill_id` ベースのルールを優先する。

### 値パースのリスク

`effect_value` は文字列で返る。

例:

- `+10.4%`
- `+1320`
- `10倍`
- `8回`

単位を誤るとスコア計算が壊れるため、初期実装ではパース結果を UI で確認できるとよい。

## 将来拡張

- ルールの JSON インポート / エクスポート
- キャラ別おすすめ評価
- 属性別評価
- 種類別評価
- 複合条件
- 除外ルール
- プリセット切替
