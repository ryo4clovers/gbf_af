# AI Implementation Prompt

Use this prompt when asking Codex or Claude Code to start implementation.

```md
You are implementing GBF Artifact Tool, a read-only Chrome Extension for managing Granblue Fantasy Artifacts.

Read these documents first:

- docs/00-project-overview.md
- docs/01-requirements.md
- docs/02-architecture.md
- docs/03-api-contract.md
- docs/04-data-model.md
- docs/05-ui-design.md
- docs/06-scoring-rule.md
- docs/07-implementation-plan.md

Critical constraints:

- Do not control the game screen.
- Do not modify the game screen UI.
- Do not inject UI into the game page.
- Do not automate pagination.
- Do not call POST / PUT / DELETE endpoints.
- Do not send user data externally.
- Keep all artifact data local.

Adopt the API retrieval method.

Implement the project in small steps.

First implementation target:

1. TypeScript types for API response.
2. Internal Artifact domain model.
3. RawArtifact -> Artifact normalizer.
4. effect_value parser.
5. Unit tests using sample JSON.
6. Storage interface for artifacts and scan state.

Do not start with complex UI.

Prefer explicit and maintainable code.
Avoid unnecessary abstractions.
```
