# Engineering Principles

- Prefer explicit and maintainable code.
- Avoid unnecessary abstractions.
- Keep diffs minimal and focused.
- Prioritize readability and debuggability.
- Prefer simple data flow over clever framework usage.
- Do not introduce broad architecture changes unless they are needed for the requested feature.

# Project Context

This repository is a Chrome Extension project for managing Granblue Fantasy Artifacts.

The extension is an observation-only local management tool.

The core policy is:

- Observe GBF page network responses.
- Normalize and persist artifact data locally.
- Provide local management, review, display, statistics, export, and scoring features.
- Never control the game.

# Hard Constraints

Do not implement any feature that does the following:

- Controls the GBF game screen.
- Mutates or rewrites the GBF DOM.
- Sends extension-owned GBF artifact API requests.
- Adds automatic game operations.
- Adds page navigation.
- Adds polling or retry loops that increase game-side traffic.
- Sends user artifact data to an external server.
- Performs POST / PUT / DELETE or other state-changing requests to GBF.

Allowed data source:

```text
/rest/artifact/list/{page}
````

Allowed acquisition method:

```text
GBF page's own network response
-> page-context fetch/XHR observer
-> content bridge
-> background service worker
-> IndexedDB
```

# Current Architecture

* Chrome Extension Manifest V3
* React + TypeScript + Vite
* Zustand
* Zod
* IndexedDB
* Side Panel UI
* Dashboard page
* Background service worker
* Content script bridge
* Page-context fetch/XHR observer

Popup has been migrated to Chrome Side Panel and should not be reintroduced unless explicitly requested.

# App Modes

The Side Panel has two explicit modes. Local artifact management belongs to the separate Dashboard:

* `scan`
* `display`

## scan

Responsible for observation-only artifact collection.

Responsibilities:

* Start/stop artifact list observation.
* Track scan session lifecycle.
* Update artifact presence.
* Detect possibly deleted artifacts after completed full scan.
* Keep scan-specific persistence separate from user reviews.

## display

Responsible for Side Panel companion display for the currently observed GBF artifact page.

Responsibilities:

* Show current observed GBF artifact page.
* Show 5-column artifact grid.
* Show rating.
* Show memo tooltip.

Display mode must not update artifact persistence or lifecycle state.

# Data Separation

Keep these concepts separate:

* Observed artifact data.
* Artifact lifecycle / presence data.
* User review metadata.
* Display state.
* Custom score profile / scoring policy.
* Calculated score result.

Do not store user review data inside scan session data.

Do not make rescans erase review metadata.

Do not persist calculated statistics unless explicitly requested.

# Current Domain Concepts

Important model concepts include:

* `Artifact`
* `ArtifactSkill`
* `ArtifactPresence`
* `ScanSession`
* `ArtifactUserReview`
* `DisplayState`
* `GameScore`
* `CustomScore`

Current user review metadata:

* `rating: 0-5`
* `memo`

# Custom Score System Direction

The next major feature is Custom Score System.

Do not start with a fully free-form formula editor.

Implement in phases.

## Phase 1

Rule/profile based scoring.

User-configurable inputs:

* Ideal skill configurations and match-count scores.
* Per-skill scores for slots 1–2, slot 3, and slot 4.
* Shared table-rank penalties.

The evaluator should calculate two positive routes and use the higher one.

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
  - table-rank penalties for concretely matched skills
```

Rules:

* Match count is evaluated as 1/4, 2/4, 3/4, or 4/4.
* Slots 1–2 are matched as an unordered pair; slots 3 and 4 match their corresponding slots.
* Unselected slots are wildcard matches and receive no table-rank penalty.
* The route score is floored at zero.

### priorityRouteScore

Evaluates general skill value.

```text
priorityRouteScore =
  sum of max(0, per-skill score - table-rank penalty)
```

Rules:

* Every available skill receives an integer score from 0 to 25 in its slot group.
* Unwanted-skill metadata does not affect scoring.
* Slot 4 and unknown table ranks receive no table-rank penalty.

### Effect Table Handling

Many skills have an effect table rank from `a` to `e` at the same skill level.

Rules:

* Rank `a` receives the largest penalty and rank `e` the smallest.
* A desired skill with rank `d` should score higher than a low-value skill with rank `e`.
* Users configure integer penalties from 0 to 25 while preserving `a >= b >= c >= d >= e`.
* The default penalties are `4 / 3 / 2 / 1 / 0`.

Example:

```text
important skill d: max(0, 25 - 1) = 24
minor skill e:     max(0, 10 - 0) = 10
```

### Skill Level Handling

Phase 1 scoring evaluates skills as Lv1 baseline.

Reason:

* Skill levels can be reset in-game.
* Current skill level and future artifact value should not be mixed in the initial scoring model.

# Custom Score Data Design Guidance

Prefer separating scoring policy from observed artifact data.

Recommended conceptual split:

```text
Artifact
-> observed normalized data

ScoreProfile
-> user-defined scoring policy

ScoreEvaluator
-> pure evaluation logic

ScoreResult
-> calculated result for UI
```

Avoid permanently baking calculated custom scores into artifact records unless there is a clear caching need.

If cache is introduced, it must be invalidated when:

* Score profile changes.
* Score evaluator version changes.
* Skill normalization logic changes.

# Skill Normalization Guidance

Expected future normalized skill shape:

```ts
type ArtifactSkill = {
  rawName: string;
  normalizedKey: string;
  slot: 1 | 2 | 3 | 4;
  level?: number;
  value?: number;
  unit?: string;
  tableRank?: "a" | "b" | "c" | "d" | "e";
  category?: string;
};
```

Keep normalization separate from score evaluation.

Do not let scoring rules depend on fragile raw text matching when a normalized key can be used.

Avoid a single large, hard-to-maintain normalization function.

Prefer data tables and small helper functions.

# Score Explanation Requirement

Custom score results should be explainable.

Prefer returning a structure like:

```ts
type ScoreResult = {
  total: number;
  selectedRoute: "ideal" | "priority";
  idealRouteScore: number;
  priorityRouteScore: number;
  reasons: ScoreReason[];
};
```

A score reason should be suitable for UI display.

Example explanation:

```text
Score: 87
+ 3/4 ideal match
+ 通常攻撃ダメージ上限 rank e
+ 自属性攻撃力 rank d
- 不要スキル 1件
```

# Workflow

Before modifying files:

* Explain the plan.
* Identify the files that will change.
* Keep the change focused.

After modifying files:

* Show the relevant diff or summary.
* Explain validation performed.
* Mention any validation that could not be performed.

Do not modify unrelated files.

# Formatting

* Respect `.editorconfig`.
* Respect Biome configuration.
* Preserve existing naming conventions.
* Use explicit TypeScript types at module boundaries.
* Prefer discriminated unions for message types and result types when it improves safety.

# Testing and Validation

Before finalizing changes, run the relevant checks when possible:

```bash
npm run check
npm run build
```

If checks cannot be run, explain why.

Never remove failing tests without explanation.

# Chrome Extension Notes

When changing extension behavior, check:

* `public/manifest.json`
* background service worker messages
* content script bridge messages
* page observer injection
* Side Panel behavior
* Dashboard behavior

Be careful with MV3 service worker lifecycle.

Do not assume background state is permanently alive.
