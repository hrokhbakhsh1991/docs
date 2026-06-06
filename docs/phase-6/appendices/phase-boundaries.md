# Phase 6 boundaries

## Phase 6 MUST

- Full Denali `WorkspacePlugin` in `packages/workspaces/denali`
- Bootstrap api/web for `workspace_type: denali`
- Finance hooks in **plugin** via events
- MinIO photo pipeline
- `migrateCanonical` execution

## Phase 7 MUST NOT (before Phase 7)

| Item                        | Note               |
| --------------------------- | ------------------ |
| `packages/workspaces/urban` | Second workspace   |
| TenantConnectionRouter silo | Enterprise tier    |
| Full OTel + runbooks        | Platform hardening |

**Phase 5 delivered:** data layer — see [`../../phase-5/appendices/phase-boundaries.md`](../../phase-5/appendices/phase-boundaries.md).

## Forward — Phase 7 hub

When Phase 6 closes, second workspace + platform hardening: [`../../phase-7-platform-dod.md`](../../phase-7-platform-dod.md) · SOLE router [`../../phase-7/phase-7-agent-router.md`](../../phase-7/phase-7-agent-router.md).
