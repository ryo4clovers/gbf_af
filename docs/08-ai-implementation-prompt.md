# AI Implementation Prompt

> Note: Score profile references below are historical. Current implementations must use one `CustomScoreSettings` record and must not add profile creation, selection, or deletion.

Use this prompt when asking Codex or Claude Code to implement changes in this repository.

```md
You are implementing GBF Artifact Tool, a Chrome Extension for managing Granblue Fantasy Artifacts.

Read these files first:

- AGENTS.md
- .codex/AGENTS.md
- .claude/CLAUDE.md
- docs/00-project-overview.md
- docs/01-requirements.md
- docs/02-architecture.md
- docs/03-api-contract.md
- docs/04-data-model.md
- docs/05-ui-design.md
- docs/06-custom-score.md
- docs/07-implementation-plan.md

## Project Summary

GBF Artifact Tool is an observation-only Chrome Extension.

It observes Granblue Fantasy artifact list responses from the GBF page and stores normalized artifact data locally.

The extension must never control the game.

The extension must never send its own GBF artifact API requests.

Allowed data source:

```text
/rest/artifact/list/{page}
````

Allowed acquisition flow:

```text
GBF page's own fetch/XHR response
-> page-context observer
-> content bridge
-> background service worker
-> IndexedDB
```

## Critical Safety Constraints

Do not implement behavior that does any of the following:

* Controls the GBF game screen.
* Mutates the GBF DOM.
* Injects UI into the GBF page.
* Sends extension-owned GBF artifact API requests.
* Builds and fetches `/rest/artifact/list/{page}` URLs.
* Uses `uid`, `_`, or `t` query parameters to recreate GBF requests.
* Automates page navigation.
* Automates pagination.
* Adds polling or retry loops that increase GBF-side traffic.
* Sends POST / PUT / DELETE or other state-changing requests to GBF.
* Sends artifact data to external services.
* Reintroduces Popup as the main UI.

The user manually navigates GBF pages.

The extension only observes responses that the GBF page itself receives.

## Current Architecture

The project already has these major pieces implemented:

* Manifest V3 Chrome Extension
* React + TypeScript + Vite
* Zustand
* Zod
* IndexedDB
* Side Panel UI
* Dashboard page
* Background service worker
* Content script bridge
* Page-context fetch/XHR observer
* Observation-only scan mode
* Display mode
* Rating / memo
* Lifecycle tracking
* Statistics
* CSV export
* Content bridge recovery

Popup has been migrated to Chrome Side Panel.

Do not rebuild the old Popup-based architecture.

## Application Modes

The Side Panel has two explicit modes. The Dashboard remains the separate local-management surface:

```ts
type AppMode = "scan" | "display";
```

### scan

Scan mode observes GBF page artifact list responses and persists artifacts.

Scan mode may update:

* artifacts
* scan metadata
* scan sessions
* artifact presence

Scan mode must not:

* send GBF API requests
* navigate pages
* mutate DOM

### display

Display mode is a Side Panel companion view for the currently observed GBF artifact page.

Display mode may show:

* current observed page
* 5-column artifact grid
* rating
* memo tooltip

Display mode must not update:

* artifact persistence
* scan session
* artifact presence
* lifecycle state

## Data Separation Rules

Keep these concepts separate:

* Observed artifact data
* Scan session lifecycle
* Artifact presence / lifecycle
* User review metadata
* Display state
* Game score
* Custom score profile / scoring policy
* Calculated custom score result
* Statistics result

Do not make rescans erase rating or memo.

Do not store user review data inside scan session data.

Do not persist calculated statistics unless explicitly requested.

Do not treat calculated custom score as the primary source of truth in `Artifact`.

Prefer:

```text
Artifact
-> observed normalized data

ScoreProfile
-> user-defined scoring policy

ScoreEvaluator
-> pure calculation logic

ScoreResult
-> calculated result for UI
```

## Current Persistence

IndexedDB database:

```text
gbf-artifact-manager
```

Current stores:

```text
artifacts
scanMetadata
artifactUserReviews
scanSessions
artifactPresence
```

Future stores may include:

```text
scoreProfiles
scoreSettings
```

## Current Main Task: Custom Score System

The next major feature is Custom Score System.

Do not start with a fully free-form formula editor.

Phase 1 is rule/profile based scoring.

User-configurable inputs:

* Ideal skill composition
* Skill priority order
* Unwanted skills

The evaluator must first return `100` for artifacts with `is_quirk: true`. For regular artifacts, it should calculate two routes and use the higher one:

```text
finalScore =
  max(
    idealRouteScore,
    priorityRouteScore
  )
```

### idealRouteScore

Evaluates how close the artifact is to the user's ideal skill composition.

```text
idealRouteScore =
  ideal match score
  - skill-quality penalties for concretely matched skills
```

Rules:

* Evaluate match count as 1/4, 2/4, 3/4, or 4/4.
* Match slots 1–2 as an unordered pair and slots 3–4 against their corresponding slots.
* Treat unselected slots as wildcard matches without skill-quality penalties.

### priorityRouteScore

Evaluates general skill value.

```text
priorityRouteScore =
  sum of max(0, per-skill score - skill-quality penalty)
```

Rules:

* Users assign every skill an integer score from 0 to 25 in its slot group.
* Unwanted-skill metadata does not affect scoring.

### Effect Table Handling

Many skills have a skill quality from `A` to `E`, where `A` is highest.

Rules:

* Quality `A` always receives zero penalty and quality `E` receives the largest penalty.
* A desired skill with quality `D` should score higher than a low-value skill with quality `E`.
* Penalties for `B` through `E` are user-configurable integers from 0 to 25 and satisfy `A(0) <= B <= C <= D <= E`.
* Subtraction is floored at zero.

Example:

```text
important skill D: max(0, 25 - 3) = 22
minor skill E:     max(0, 10 - 4) = 6
```

### Skill Level Handling

Phase 1 scoring evaluates skills as Lv1 baseline.

Reason:

* Skill levels can be reset in-game.
* Current skill level and future artifact value should not be mixed in the initial scoring model.

## Recommended Custom Score Implementation Order

Implement Custom Score in small steps.

Recommended order:

1. Skill catalog / normalization foundation
2. Score model types
3. Score evaluator pure functions
4. Unit tests for evaluator
5. Score profile storage
6. Background messages for score profiles
7. Dashboard score display
8. Score profile editor UI
9. CSV export integration
10. Tuning with real data

Do not start from UI.

Start from domain logic and tests.

## Recommended Files

Skill normalization:

```text
src/domain/skill/
  normalizedSkill.ts
  skillCatalog.ts
  normalizeSkill.ts
  inferTableRank.ts
```

Score domain:

```text
src/domain/score/
  scoreProfile.ts
  scoreResult.ts
  scoreConstants.ts
  evaluateCustomScore.ts
  evaluateIdealRoute.ts
  evaluatePriorityRoute.ts
  scoreExplanation.ts
```

Storage:

```text
src/storage/artifactIndexedDb.ts
src/storage/scoreProfileStorage.ts
```

Messages:

```text
src/shared/messages.ts
src/background/index.ts
```

Dashboard:

```text
src/dashboard/
src/dashboard/score/
```

CSV:

```text
src/csv/
```

## Suggested Types

```ts
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

```ts
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
  selectedRoute: "quirk" | "ideal" | "priority";
  idealRouteScore: number;
  priorityRouteScore: number;
  reasons: ScoreReason[];
};

export type ScoreReason = {
  type:
    | "ideal_match"
    | "priority_skill"
    | "table_penalty";
  skillKey?: NormalizedSkillKey;
  label: string;
  delta: number;
};
```

## Initial Constants

Use these as initial candidates. They may be tuned later.

```ts
export const IDEAL_MATCH_SCORE = {
  1: 0,
  2: 0,
  3: 75,
  4: 100,
} as const;

export const DEFAULT_TABLE_RANK_PENALTIES = {
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  e: 4,
} as const;

```

## Skill Normalization Guidance

Prefer stable matching by `skillId` and normalized skill key.

Do not rely primarily on raw skill name substring matching.

Good:

```text
skillId -> normalizedKey -> score profile matching
```

Acceptable fallback:

```text
unknown skillId -> fallback normalized key from raw name
```

Avoid:

```text
skill.name.includes("...")
```

Avoid a single huge normalization function.

Prefer:

* skill catalog data
* small helper functions
* explicit fallback behavior

## Skill Quality Guidance

Initial skill quality inference may use `skill_quality`.

Candidate mapping:

```ts
const QUALITY_TO_SKILL_QUALITY = {
  1: "E",
  2: "D",
  3: "C",
  4: "B",
  5: "A",
} as const;
```

Be careful:

* Slot 4 may not follow the same A-E quality model.
* Do not overvalue slot 4 using this mapping without validation.
* If skill quality is unknown, use penalty `0`.

## Score Explanation Requirement

Custom score results must be explainable.

A user should be able to understand why an artifact got its score.

Example:

```text
Score: 87
Route: ideal
+ 3/4 ideal match
+ 通常攻撃ダメージ上限 quality E
+ 自属性攻撃力 quality D
```

Example:

```text
Score: 64
Route: priority
+ 通常攻撃ダメージ上限 quality E
+ 自属性攻撃力 quality D
- 不要スキル 1件
```

## Implementation Rules

Before modifying files:

* Explain the implementation plan.
* Identify the files that will change.
* Keep the change focused.

When modifying code:

* Prefer explicit TypeScript.
* Keep module boundaries clear.
* Avoid unnecessary abstractions.
* Keep domain logic outside React components.
* Keep Chrome API access outside pure domain functions.
* Keep IndexedDB access outside evaluator functions.
* Use Zod at external data boundaries where appropriate.
* Use discriminated unions for message types where useful.
* Preserve existing naming conventions.
* Respect `.editorconfig` and Biome.

After modifying files:

* Summarize changed files.
* Explain validation performed.
* Mention validation that could not be performed.

## Validation

Run these when possible:

```bash
npm run check
npm run build
```

If a test script exists, run it too:

```bash
npm test
```

If validation cannot be run, explain why.

Do not remove failing tests without explanation.

## Safety Checklist Before Finalizing

Confirm that the change:

* Does not mutate GBF DOM.
* Does not inject UI into GBF page.
* Does not send extension-owned GBF API requests.
* Does not build or fetch GBF artifact list URLs.
* Does not automate pagination.
* Does not automate page navigation.
* Does not add polling / retry loops.
* Does not send user data externally.
* Does not reintroduce Popup as the main UI.
* Does not make display mode update artifact persistence or lifecycle.
* Does not erase rating / memo during rescan.
* Keeps score policy separate from calculated score result.
* Keeps evaluator logic pure and testable.

## Preferred First Custom Score Task

Start with the smallest useful implementation:

1. Add normalized skill model/types.
2. Add skill quality inference helper.
3. Add score model/types.
4. Add evaluator pure functions.
5. Add small tests or sample-based validation.

Do not implement the Dashboard editor UI until the evaluator is stable.


## Notes

This prompt should be updated whenever the architecture changes.

Especially update it if:

- data acquisition policy changes
- Side Panel / Dashboard responsibility changes
- IndexedDB schema changes
- Custom Score formula changes
- score profile storage changes
