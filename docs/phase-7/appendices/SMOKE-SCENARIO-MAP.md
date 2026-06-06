# Phase 7 — Smoke scenario map (7.4)

> **REQ:** REQ-P7-012..014 · **Anti-pattern reference:** legacy urban → denali rail

| ID        | Legacy reference                                                             | Trunk target                                            | Pass signal                    |
| --------- | ---------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------ |
| SMK-P7-01 | `legacy/apps/api/src/scripts/urban-demo-tenant.fixture.ts`                   | `apps/api/test/fixtures/urban-demo-tenant.ts`           | tenant `workspace_type: urban` |
| SMK-P7-02 | `legacy/apps/web/.../workspace-wizard.config.spec.ts` L11–38 (**forbidden**) | urban uses **urban plugin** — `wizardMode !== "denali"` | RULE-P7-003                    |
| SMK-P7-03 | `legacy/packages/types/.../tour-form-profile-descriptors.ts` L283–299        | slim registry in plugin                                 | no itinerary/transport fields  |
| SMK-P7-04 | `/tours/new` on urban tenant host                                            | HTTP 200 + `@app-tour/workspace-urban` chunk            | REQ-P7-010                     |
| SMK-P7-05 | Golden `urban-tour-minimal.json`                                             | `validateCanonical` pass                                | 201 + canonical persisted      |
| SMK-P7-06 | Golden `urban-tour-publish-ready.json`                                       | publish transition                                      | 200 + status published         |

## Host / env

```bash
export SMOKE_BASE_URL="${SMOKE_BASE_URL:-http://urban.localhost:3000}"
export SMOKE_API_URL="${SMOKE_API_URL:-http://localhost:4000}"
pnpm --filter @apps/api exec node --import tsx --test test/urban-workspace-plugin.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-create-publish.integration.spec.ts
```

## Golden fixtures (create in 7.1/7.4)

| File                                                                               | Source semantics                              |
| ---------------------------------------------------------------------------------- | --------------------------------------------- |
| `packages/workspaces/urban/test/fixtures/golden/urban-tour-minimal.json`           | city tour — title, city, venue, dates only    |
| `packages/workspaces/urban/test/fixtures/golden/urban-tour-publish-ready.json`     | all required fields for publish               |
| `packages/workspaces/urban/test/fixtures/golden/urban-tour-invalid-itinerary.json` | **must fail** validateCanonical (strip proof) |

## Forbidden smoke paths

- Do **not** assert `getWizardConfig("urban").wizardMode === "denali"` — that is legacy coupling (see legacy spec L11–13).
