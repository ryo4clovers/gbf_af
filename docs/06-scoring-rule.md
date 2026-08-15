# Custom Score System Specification

## Goal

Custom Score System helps users evaluate Granblue Fantasy Artifacts based on practical selection logic.

The score should reflect:

- How close the artifact is to an ideal skill composition.
- Whether the artifact has high-value skills.
- Whether the artifact has unwanted skills.
- Whether the artifact has high effect table values.

The first implementation should be practical and explainable, not a free-form formula editor.

## User Inputs

Phase 1 requires the user to define:

1. Ideal skill composition
2. Skill priority order
3. Unwanted skills

## Artifact Evaluation Model

An artifact has 4 skills.

The score is calculated using two routes:

```text
finalScore =
  max(
    idealRouteScore,
    priorityRouteScore
  )
````

The route with the higher score becomes the final score route.

## Route 1: Ideal Route

The ideal route measures how close the artifact is to the user's ideal composition.

```text
idealRouteScore =
  ideal match score
  + table multiplier for matched ideal skills
```

### Matching Rules

* Slot position is ignored.
* Matching is based on normalized skill keys.
* Match levels:

  * 1/4
  * 2/4
  * 3/4
  * 4/4

### Why Unwanted Skills Are Not Central Here

An artifact close to the ideal skill composition can still be valuable even if it has one unwanted skill.

Reason:

* Some in-game items can change a skill.
* Therefore, ideal closeness is more important than unwanted skill penalty in this route.

## Route 2: Priority Route

The priority route measures general value based on skill priority.

```text
priorityRouteScore =
  skill priority score
  + table multiplier
  - unwanted skill penalty
```

### Skill Priority

Users define skill priority as an ordered list.

Example:

```text
通常攻撃ダメージ上限
> 自属性攻撃力
> トリプルアタック確率
> 攻撃力
```

Higher-ranked skills produce higher base score.

### Unwanted Skills

Unwanted skills are global.

They are not profile-specific in Phase 1.

Penalty behavior:

* 0 unwanted skills: no penalty
* 1 unwanted skill: large penalty
* 2 or more unwanted skills: progressive penalty

## Effect Table Rank

Many skills have an effect table rank from `a` to `e`.

Rules:

* `e` is best.
* `a` is worst.
* Table rank modifies skill score by multiplier.
* Table rank should not overpower skill priority.

Example:

```text
important skill d: 30 * 1.15 = 34.5
minor skill e:     10 * 1.25 = 12.5
```

## Skill Level Baseline

Phase 1 evaluates skills as Lv1 baseline.

Reason:

* Skill levels can be reset.
* Current skill level should not be mixed with long-term artifact value.

## Recommended Initial Settings

Ideal match scores are stored in the single custom score settings record and can be tuned by the user.

### Ideal Match Score

```ts
const DEFAULT_IDEAL_MATCH_SCORES = {
  1: 0,
  2: 0,
  3: 75,
  4: 100,
} as const;
```

Reasoning:

* 3/4 match should be highly valuable.
* 4/4 match should receive the maximum base score.
* 1/4 and 2/4 matches should not receive a base score.
* Table rank multipliers are applied after the configurable base score and may produce a final route score above 100.

### Table Multipliers

```ts
const TABLE_RANK_MULTIPLIER = {
  a: 1.0,
  b: 1.05,
  c: 1.1,
  d: 1.15,
  e: 1.25,
} as const;
```

Reasoning:

* Table quality matters.
* Skill identity should matter more than table quality.

### Unwanted Penalty

```ts
const UNWANTED_SKILL_PENALTY = {
  0: 0,
  1: 25,
  2: 60,
  3: 100,
  4: 150,
} as const;
```

Reasoning:

* One unwanted skill is significant but not fatal.
* Multiple unwanted skills should quickly reduce general value.

## Conceptual Types

```ts
type CustomScoreSettings = {
  idealSkillKeys: string[];
  idealMatchScores: IdealMatchScores;
  skillPriority: SkillPriorityEntry[];
  updatedAt: string;
};

type SkillPriorityEntry = {
  skillKey: string;
  rank: number;
};

type UnwantedSkillConfig = {
  skillKeys: string[];
};

type ScoreResult = {
  total: number;
  selectedRoute: "ideal" | "priority";
  idealRouteScore: number;
  priorityRouteScore: number;
  reasons: ScoreReason[];
};

type ScoreReason = {
  type:
    | "ideal_match"
    | "priority_skill"
    | "table_multiplier"
    | "unwanted_penalty";
  skillKey?: string;
  label: string;
  delta: number;
};
```

## Responsibility Separation

Recommended modules:

```text
src/domain/score/
  customScoreSettings.ts
  scoreResult.ts
  scoreConstants.ts
  evaluateCustomScore.ts
  evaluateIdealRoute.ts
  evaluatePriorityRoute.ts
  scoreExplanation.ts

src/domain/skill/
  skillCatalog.ts
  normalizeSkill.ts
  inferTableRank.ts
```

Responsibilities:

* `skillCatalog.ts`

  * Defines known skills and normalized keys.
* `normalizeSkill.ts`

  * Converts observed skill names into normalized skill keys.
* `inferTableRank.ts`

  * Infers a/b/c/d/e from skill key, Lv1 baseline, and observed value where possible.
* `evaluateCustomScore.ts`

  * Combines ideal route and priority route.
* `evaluateIdealRoute.ts`

  * Calculates ideal composition score.
* `evaluatePriorityRoute.ts`

  * Calculates priority score and unwanted penalties.
* `scoreExplanation.ts`

  * Produces UI-friendly explanation reasons.

## Storage Direction

Do not store calculated score directly in `Artifact` as the primary source of truth.

Store:

* Custom score settings
* Unwanted skill config
* Optional evaluator version

Calculate:

* Score result
* Route scores
* Reasons

If caching is later introduced, cache invalidation must consider:

* Score setting changes
* Evaluator version changes
* Skill normalization changes
* Artifact data changes

## UI Direction

Phase 1 UI should avoid formula editing.

Recommended UI sections:

1. Ideal skill composition editor
2. Skill priority editor
3. Unwanted skill editor
4. Score preview
5. Score explanation

### Ideal Skill Composition Editor

* Select up to 4 skills.
* Slot order is not relevant.
* Display current match count in explanations.

### Skill Priority Editor

Preferred UX:

* Drag and drop
* Or explicit up/down buttons

Avoid requiring users to input numeric weights at first.

### Unwanted Skill Editor

* Checkbox or multi-select.
* Global setting.
* Explain that unwanted skills affect priority route more than ideal route.

## Future Phases

### Phase 2: Presets

Add preset profiles:

* Normal attack
* Ougi
* Ability damage
* Defense
* General use

### Phase 3: Advanced Formula Editor

Optional future feature.

Should only be added after:

* normalized skill catalog is stable
* score explanations are stable
* users need more flexibility than profiles provide
