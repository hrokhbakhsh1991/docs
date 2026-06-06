# Phase 0–3 → Phase 5 bridge (foundation chain)

```yaml
agent_load_tier: T1_context
extends: ../../appendices/PLATFORM-CONTINUITY-0-5.md
rule: "Phase 5 does not re-open Phase 0–3 scope — only consumes artifacts"
```

## What Phase 5 inherits (do not reimplement)

| Phase | Artifact                                 | Phase 5 consumer                           |
| ----- | ---------------------------------------- | ------------------------------------------ |
| **0** | `CanonicalDocument` type                 | `canonical_data` JSONB envelope (RULE-002) |
| **0** | Theme / workspace-sdk contracts          | Plugin + API types                         |
| **1** | `PlatformWizardEngine.validateCanonical` | Called before persist (5.2)                |
| **1** | Rules headless                           | Plugin validation pipeline                 |
| **2** | Design tokens (no DB)                    | UI only — no Phase 5 mutation              |
| **3** | `WorkspacePlugin` registry pattern       | `resolve-workspace-plugin.ts`              |
| **3** | CASL `accessibleByTourWhere`             | Unchanged — RULE-021                       |
| **3** | `CanonicalTourService` single write path | Extended TX at 5.4 — not replaced          |

## Phase 3 → 4 → 5 write path

```text
Phase 3.4: CanonicalTourService + tours API (memory or prisma dev)
Phase 4:   + tenant context + RLS on tours
Phase 5:   + canonical_data column name + outbox/audit tables + validate ordering
```

## Forbidden regressions (FAIL)

```yaml
forbidden:
  - "Add second tour SoT table in apps/api"
  - "Bypass CASL in CanonicalTourService"
  - "Import workspace-specific code into platform-core"
  - "Move validateCanonical after DB commit (5.2)"
```

## Verification pointers

| Phase | Gate                                                  |
| ----- | ----------------------------------------------------- |
| 0     | `pnpm run phase-0:gate`                               |
| 1     | `pnpm run phase-1:gate`                               |
| 2     | `pnpm run phase-2:gate`                               |
| 3     | `pnpm run phase-3:gate` — **required before Phase 4** |

**Phase 5 agents:** read this file at T1 when touching `workspace-sdk`, `platform-core`, or `workspaces/starter`.

**Cross-links:** [`workspace-data-layer-model.md`](workspace-data-layer-model.md) · [`phase-4-bridge.md`](phase-4-bridge.md)
