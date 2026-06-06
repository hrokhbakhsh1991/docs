# Platform continuity — Phases 0–6 (canonical)

```yaml
continuity_version: "2026-06-04-v1"
extends: PLATFORM-CONTINUITY-0-5.md
guard: scripts/guards/lib/phase-cross-continuity.mjs
```

> Full 0–5 table: [`PLATFORM-CONTINUITY-0-5.md`](PLATFORM-CONTINUITY-0-5.md). This file adds **Phase 6** only.

## Phase 6 ownership

| Phase | Delivers                                                                                               | Must NOT own                                                |
| ----- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **6** | `packages/workspaces/denali`, bootstrap, finance in plugin, MinIO photos, `migrateCanonical` execution | urban workspace, silo router, platform-core Denali branches |

## Gate chain (append)

```yaml
phase-6:gate: "build + test + phase-5:gate + phase-6:guard"
```

## Agent entry — Phase 6

| Role            | File                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| **SOLE router** | [`phase-6/phase-6-agent-router.md`](../phase-6/phase-6-agent-router.md)                               |
| Decisions       | [`phase-6/appendices/IMPLEMENTATION-DECISIONS.md`](../phase-6/appendices/IMPLEMENTATION-DECISIONS.md) |
| 5→6 entry       | [`phase-6/appendices/CROSS-PHASE-ENTRY-MAP.md`](../phase-6/appendices/CROSS-PHASE-ENTRY-MAP.md)       |

## Handoff 5→6

| Phase 5 delivers                           | Phase 6 consumes                 |
| ------------------------------------------ | -------------------------------- |
| `canonical_data` + validate-before-persist | Denali plugin validation         |
| Outbox + TourCreated                       | Finance/event handlers in plugin |
| Projection map (starter)                   | Denali projection addendum       |
| `migrateCanonical` hook design             | 6.8 execution                    |
