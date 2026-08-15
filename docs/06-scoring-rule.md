# Custom Score System Specification

## Goal

Custom Score System helps users evaluate Granblue Fantasy Artifacts based on practical selection logic.

The score should reflect:

- How close the artifact is to an ideal skill composition.
- Whether the artifact has high-value skills.
- Whether the artifact has high effect table values.

The first implementation should be practical and explainable, not a free-form formula editor.

## User Inputs

Phase 1 requires the user to define:

1. Ideal skill composition
2. Per-skill scores for slots 1–2, slot 3, and slot 4

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
  - table-rank penalties for concretely matched skills
```

### Matching Rules

* Select the single configuration matching the artifact attribute and weapon kind.
* Configuration attribute and weapon-kind ranges must not overlap.
* Slots 1 and 2 are matched as an unordered pair.
* Slots 3 and 4 are matched against their corresponding artifact slots.
* An unselected skill slot is a wildcard and counts as a match.
* Wildcard matches do not receive a table-rank penalty.
* Selected skills are matched using stable keys and normalized API labels.
* Match levels:

  * 1/4
  * 2/4
  * 3/4
  * 4/4

## Route 2: Priority Route

The priority route measures general value using a user-defined score for every skill in each slot group.

```text
priorityRouteScore =
  sum of max(0, per-skill score - table-rank penalty)
```

### Per-Skill Scores

Users assign an integer score from 0 to 25 to every available skill in these groups:

* Slots 1–2
* Slot 3
* Slot 4

The four skill scores sum to a maximum base score of 100 before table-rank penalties. Unwanted-skill metadata does not affect score calculation.

## Effect Table Rank

Many skills have an effect table rank from `a` to `e`.

Rules:

* Rank `a` receives the largest penalty and rank `e` the smallest.
* Users configure integer penalties from 0 to 25 with `a >= b >= c >= d >= e`.
* Scores are floored at zero after subtraction.

Example:

```text
important skill d: max(0, 25 - 1) = 24
minor skill e:     max(0, 10 - 0) = 10
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
* Table-rank penalties are subtracted from concretely matched skills, and the route score is floored at zero.

### Table-rank Penalties

```ts
const DEFAULT_TABLE_RANK_PENALTIES = {
  a: 4,
  b: 3,
  c: 2,
  d: 1,
  e: 0,
} as const;
```

Reasoning:

* Table quality matters.
* Skill identity should matter more than table quality.
* Users may choose integer penalties from 0 to 25 while preserving `a >= b >= c >= d >= e`.
* Unknown ranks, slot 4, and ideal-route wildcards receive no penalty.

## Conceptual Types

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
  firstSecondSlotSkillKeys: [string | null, string | null];
  thirdSlotSkillKey: string | null;
  fourthSlotSkillKey: string | null;
};

type SkillScoreEntry = {
  skillKey: string;
  score: number;
};

type SkillScores = {
  firstSecondSlot: SkillScoreEntry[];
  thirdSlot: SkillScoreEntry[];
  fourthSlot: SkillScoreEntry[];
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
    | "table_penalty";
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

  * Calculates the sum of configured per-skill scores after table-rank penalties.
* `scoreExplanation.ts`

  * Produces UI-friendly explanation reasons.

## Storage Direction

Do not store calculated score directly in `Artifact` as the primary source of truth.

Store:

* Custom score settings
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
2. Skill score editor
3. Score preview
4. Score explanation

### Ideal Skill Composition Editor

* Add, edit, and delete multiple ideal configurations.
* Select multiple attributes and weapon kinds; new configurations select all by default.
* Select two unordered skills for slots 1 and 2, plus one skill each for slots 3 and 4.
* Leave a skill unselected to accept any skill in that slot.
* Display current match count in explanations.

### Skill Score Editor

* Switch between slots 1–2, slot 3, and slot 4 with tabs.
* Show every available skill in the selected group.
* Adjust each integer score from 0 to 25 with a slider.

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
