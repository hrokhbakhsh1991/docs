# Phase 5 → Phase 6 bridge

```yaml
prerequisite_gate: pnpm run phase-5:gate
entry_subphase: subphases/6.0-entry-gate.md
entry_map: CROSS-PHASE-ENTRY-MAP.md
```

## Phase 5 must deliver before 6.0

| Item                      | Phase 5 proof                    |
| ------------------------- | -------------------------------- |
| `canonical_data` + RLS    | 5.1 scaffold minimum             |
| validate-before-persist   | 5.2 VERIFIED_BEHAVIORAL          |
| Outbox + TourCreated path | 5.4 VERIFIED_BEHAVIORAL (target) |
| Projection starter map    | 5.3 VERIFIED_BEHAVIORAL (target) |
| `migrateCanonical` hook   | design in API — 6.8 executes     |

**Doc honesty:** Phase 6 doc pack may ship while 5.3–5.5 still open — **6.0 yaml** records actual gate output.

## Phase 6 must NOT take from Phase 5 scope

See [`../../phase-5/appendices/phase-boundaries.md`](../../phase-5/appendices/phase-boundaries.md) — MinIO, Denali package, finance were **deferred**.

## Workspace resolution today

```typescript
// apps/api — denali throws until 6.5
resolveWorkspacePluginForType("denali"); // WORKSPACE_PLUGIN_NOT_BOUND
```
