# Architecture

## Overview

GBF Artifact Tool is a Chrome Extension for local artifact management.

The extension observes artifact list responses from the GBF page and stores normalized artifact data locally.

It must not control the game.

The extension must not:

- control the GBF game screen
- mutate the GBF DOM
- inject UI into the GBF game page
- send extension-owned GBF artifact API requests
- automate page navigation
- automate game operations
- add polling or retry loops that increase GBF-side traffic
- send artifact data to external services

## Core Architecture Policy

The extension is observation-only.

Allowed data source:

```text
/rest/artifact/list/{page}
````

Allowed acquisition method:

```text
GBF page's own fetch/XHR response
-> page-context observer
-> content bridge
-> background service worker
-> IndexedDB
```

The extension does not build artifact API URLs.

The extension does not send its own artifact list request.

The user manually navigates GBF artifact pages.
The extension only observes responses that the GBF page itself receives.

## High-level Structure

```text
Chrome Extension
├─ public/
│  └─ manifest.json
├─ Side Panel
│  ├─ mode controls
│  ├─ scan controls/status
│  ├─ display companion view
│  └─ dashboard entry
├─ Dashboard Page
│  ├─ artifact list
│  ├─ filters
│  ├─ sorting
│  ├─ statistics
│  ├─ rating / memo
│  ├─ lifecycle filtering
│  ├─ JSON export / import
│  └─ future custom score settings
├─ Background Service Worker
│  ├─ app mode state
│  ├─ scan/display orchestration
│  ├─ content bridge injection
│  ├─ page observer injection
│  ├─ observed response validation
│  ├─ normalization
│  └─ IndexedDB persistence
├─ Content Script Bridge
│  ├─ extension message bridge
│  ├─ page-context message bridge
│  └─ stale bridge recovery target
├─ Page-context Observer
│  ├─ fetch observer
│  └─ XHR observer
├─ Storage
│  └─ IndexedDB
└─ Domain
   ├─ API response schema
   ├─ normalization
   ├─ artifact model
   ├─ lifecycle model
   ├─ statistics
   ├─ JSON serialization / validation
   └─ future custom score evaluator
```

## Chrome Extension Components

### Manifest V3

The extension uses Manifest V3.

Important responsibilities:

* register background service worker
* register content script for GBF pages
* enable Side Panel
* allow script injection required for page observer / bridge
* restrict host permissions to GBF

Expected concepts:

```text
manifest_version: 3
background.service_worker
content_scripts
side_panel.default_path
permissions:
  - storage
  - tabs
  - scripting
  - sidePanel
host_permissions:
  - https://game.granbluefantasy.jp/*
```

### Background Service Worker

The background service worker coordinates extension behavior.

Responsibilities:

* maintain current app mode while alive
* open Side Panel
* start / stop scan observation
* start / stop display mode
* ensure content bridge availability
* inject page observer
* receive observed artifact list responses
* validate response with schema
* normalize raw artifact data
* persist artifacts during scan mode
* update `ScanSession`
* update `ArtifactPresence`
* serve stored artifacts to Dashboard
* save / load user review metadata
* open Dashboard page

Important note:

Manifest V3 service workers are not permanently alive.
Do not rely on background memory as durable state.

Durable state must be restored from IndexedDB when needed.

### Content Script Bridge

The content script bridge connects the isolated extension world and the GBF page context.

Responsibilities:

* receive extension messages from background
* forward observer control messages to page context
* receive observed responses from page context
* forward observed data to background
* respond to ping messages
* support safe reinjection after extension reload

The bridge must be idempotent.

It must be safe to inject again if the previous content script became stale.

### Page-context Observer

The page-context observer wraps fetch / XHR in the GBF page context.

Responsibilities:

* observe GBF page network responses
* detect `/rest/artifact/list/{page}` responses
* read response data without modifying the request
* send observed data to the content bridge

The observer must not:

* change request URLs
* change request payloads
* block requests
* retry requests
* initiate new GBF requests
* mutate DOM
* navigate pages

### Side Panel

Side Panel is the main extension UI.

Responsibilities:

* show mode controls
* show scan controls
* show scan status
* show display companion view
* provide Dashboard entry

Popup has been removed from the primary architecture.

Do not reintroduce Popup unless explicitly requested.

### Dashboard Page

Dashboard is the main management screen for local artifact data.

Responsibilities:

* load stored artifacts
* merge user review metadata
* show artifact list
* filter artifacts
* sort artifacts
* show statistics
* edit rating / memo
* filter lifecycle status
* export / import artifact JSON
* eventually show custom score and score reasons
* edit the single custom score settings record

Dashboard must operate on local data only.

It must not interact with the GBF page directly.

## Data Flow

### Scan Observation Flow

```text
User manually opens or navigates GBF artifact page
  ↓
GBF page sends its own /rest/artifact/list/{page} request
  ↓
GBF page receives artifact list response
  ↓
Page-context observer detects matching response
  ↓
Content bridge forwards observed response
  ↓
Background receives ARTIFACT_LIST_OBSERVED
  ↓
Zod schema validates response
  ↓
RawArtifact[] is normalized to Artifact[]
  ↓
Artifacts are saved to IndexedDB
  ↓
ScanSession is updated
  ↓
ArtifactPresence is updated
  ↓
Side Panel scan status is updated
```

### Dashboard Management Flow

```text
User opens Dashboard
  ↓
Dashboard requests stored artifacts
  ↓
Background reads IndexedDB
  ↓
Dashboard receives artifacts
  ↓
Dashboard loads user review metadata
  ↓
Dashboard calculates in-memory statistics
  ↓
User filters / sorts / edits rating / memo / exports JSON
```

### Display Flow

```text
User starts display mode
  ↓
Background ensures content bridge
  ↓
Background injects page observer if needed
  ↓
GBF page's own artifact list response is observed
  ↓
Observed artifacts are normalized for display
  ↓
Side Panel shows current observed page in 5-column grid
  ↓
Rating / memo are loaded from local review metadata
```

Display mode does not update:

* artifact persistence
* scan session
* artifact presence
* lifecycle state

## Application Modes

The Side Panel has two explicit modes. Local management remains a separate Dashboard concern.

```ts
type AppMode = "scan" | "display";
```

### scan

Used for observation-only artifact collection.

Responsibilities:

* start observation
* stop observation
* persist observed artifacts
* update scan session
* update artifact presence
* mark missing artifacts as possibly deleted after completed full scan

Scan mode is the only mode that should update artifact persistence and lifecycle state from observed artifact list responses.

### display

Used for Side Panel companion display while viewing GBF artifact pages.

Responsibilities:

* show currently observed artifact page
* show 5-column grid
* show rating display
* show memo tooltip

Display mode must not update persistence or lifecycle.

## Persistence Architecture

The extension stores local data in IndexedDB.

Database:

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
scoreSettings
scoreSettings
```

### artifacts

Stores normalized observed artifact records.

Primary key:

```text
ownedId
```

Artifact records are updated when the same artifact is observed again.

### scanMetadata

Stores latest scan metadata.

Typical contents:

* latest scanned page
* latest scanned time
* latest observed artifact count

### scanSessions

Stores scan session lifecycle records.

Used to determine whether a full scan completed.

### artifactPresence

Stores artifact lifecycle / presence records.

Used to distinguish:

* active artifacts
* possibly deleted artifacts

`possiblyDeleted` should only be inferred after a completed full scan.

### artifactUserReviews

Stores user-owned review metadata.

Current metadata:

* rating: 0-5
* memo

This store is intentionally separate from `artifacts`.

Rescans must not delete or overwrite user review metadata.

## Data Separation

Keep the following concepts separate:

* observed artifact data
* scan metadata
* scan session lifecycle
* artifact presence / lifecycle
* user review metadata
* display state
* custom score settings / scoring policy
* calculated score result
* statistics result

Reasons:

* observed data changes when GBF responses change
* lifecycle state depends on scan completeness
* rating / memo should survive rescans
* display mode should not affect persistence
* score policy can change without changing artifact data
* calculated scores should be reproducible from artifact + profile
* statistics can be recalculated from local data

## Domain Model Responsibilities

### API Response Types

API response types represent the observed GBF response shape.

They should be kept separate from domain models.

Responsibilities:

* describe raw response structure
* validate external input
* keep raw data accessible for debugging

### Artifact Domain Model

The artifact domain model represents normalized local data.

Responsibilities:

* provide UI-friendly values
* preserve raw response where useful
* expose normalized skill information
* keep game score separate from custom score
* support artifact JSON export / import

### User Review Model

User review model represents user-owned metadata.

Responsibilities:

* rating
* memo
* updatedAt if needed

It must not be embedded as the only copy inside scan results.

### Lifecycle Models

Lifecycle models represent scan and presence state.

Responsibilities:

* record scan sessions
* record first / last seen information
* support possiblyDeleted detection
* avoid false deletion detection from partial scans

### Display State

Display state represents current observed page for Side Panel display mode.

Responsibilities:

* current observed page
* current display artifacts
* display-specific status / error

Display state should not be treated as persisted artifact data.

### Custom Score Models

Future custom score models should be separated into:

```text
CustomScoreSettings
ScoreEvaluator
ScoreResult
ScoreReason
```

`CustomScoreSettings` represents the single user-defined scoring policy.
`ScoreEvaluator` is pure calculation logic.
`ScoreResult` is calculated output for UI.
`ScoreReason` explains why a score was produced.

## Custom Score Architecture Direction

Custom Score is the next major feature.

Do not implement it as a free-form formula editor first.

Phase 1 should use rule-based scoring.

User-configurable inputs:

* ideal skill composition
* per-skill scores grouped by slots 1–2, slot 3, and slot 4

Evaluation:

Artifacts with `is_quirk: true` short-circuit evaluation with a final score of `100`.

```text
finalScore =
  max(
    idealRouteScore,
    priorityRouteScore
  )
```

### idealRouteScore

Evaluates closeness to ideal skill composition.

```text
idealRouteScore =
  ideal match score
  - skill-quality penalties for concretely matched skills
```

Rules:

* evaluate 1/4, 2/4, 3/4, 4/4 match
* match slots 1–2 as an unordered pair
* match slots 3 and 4 against their corresponding slots
* count unselected skill slots as wildcard matches

### priorityRouteScore

Evaluates general skill value.

```text
priorityRouteScore =
  sum of max(0, per-skill score - skill-quality penalty)
```

Rules:

* every skill has an integer score from 0 to 25 in its slot group
* the four base skill scores sum to at most 100
* unwanted-skill metadata does not affect scoring

### Skill Quality

Skill quality is a fixed penalty on skill base score. `A` is the highest quality and always receives zero penalty; users configure only `B` through `E`.

Reason:

* quality `A` is never penalized
* a desired skill with quality `D` should beat a low-value skill with quality `E`

### Skill Level Baseline

Phase 1 scoring evaluates skills as Lv1 baseline.

Reason:

* skill levels can be reset in-game
* current skill level should not be mixed with long-term artifact value

## Statistics Architecture

Statistics are calculated in-memory from stored artifacts and review metadata.

Currently expected statistics:

* overall counts
* rating distribution
* attribute distribution
* kind distribution
* skill summary

Do not persist statistics unless a clear performance need appears.

## Artifact JSON Transfer Architecture

JSON export uses local stored data only.

JSON serialization and validation should be separated from UI components.

Responsibilities:

* define the versioned document envelope
* preserve artifact and skill structures
* include review metadata
* include lifecycle status
* reject malformed or unsupported documents

JSON export must not send data externally. CSV is not supported.

## Content Bridge Recovery

The extension must handle stale content scripts after extension reload.

Expected flow:

```text
Background wants to talk to GBF tab
  ↓
PING_CONTENT_BRIDGE
  ↓
If ping fails, inject content bridge
  ↓
PING_CONTENT_BRIDGE again
  ↓
Inject page observer
  ↓
Send START_OBSERVING or START_DISPLAY_MODE
```

Important concepts:

* `ensureContentBridge(tabId)`
* `PING_CONTENT_BRIDGE`
* idempotent bridge injection
* idempotent observer injection
* stale content-script recovery

## Error Handling Architecture

Errors should be classified enough to be useful for debugging.

Representative error categories:

* active tab unavailable
* not on GBF page
* content bridge unavailable
* observer injection failed
* observed response validation failed
* unexpected response shape
* IndexedDB failure
* stale extension context
* unsupported message type

UI should show short user-facing messages.

Console logs may include developer details.

## Safety Checklist

Before adding or changing a feature, confirm:

* Does it avoid GBF DOM mutation?
* Does it avoid extension-owned GBF API requests?
* Does it avoid automatic game operation?
* Does it avoid automatic page navigation?
* Does it avoid polling / retry behavior?
* Does it preserve scan / display and Dashboard-management responsibilities?
* Does it preserve artifact / lifecycle / review / display / score separation?
* Does it behave correctly with MV3 service worker lifecycle?
* Does it keep user data local?

## Recommended Source Layout

```text
src/
├─ api/
│  ├─ artifactListSchema.ts
│  └─ artifactListTypes.ts
├─ background/
│  ├─ index.ts
│  └─ artifactMemoryStorage.ts
├─ content/
│  └─ index.ts
├─ json/
├─ dashboard/
├─ domain/
│  ├─ artifact.ts
│  ├─ artifactUserReview.ts
│  ├─ displayMode.ts
│  ├─ normalizeArtifact.ts
│  └─ scanSession.ts
├─ page-observer/
├─ panel/
├─ shared/
│  └─ messages.ts
├─ sidepanel/
├─ state/
└─ storage/
   └─ artifactIndexedDb.ts
```

Future score-related layout:

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

## Architecture Rules

* Keep observed API response types separate from domain models.
* Keep normalization separate from UI.
* Keep storage access separate from scoring logic.
* Keep custom score policy separate from calculated score result.
* Keep Dashboard management behavior separate from Side Panel display behavior.
* Keep display mode read-only with respect to artifact persistence / lifecycle.
* Prefer pure functions for scoring, filtering, sorting, statistics, and JSON validation.
* Prefer explicit message types for extension communication.
* Avoid broad abstractions until repeated patterns are proven.
