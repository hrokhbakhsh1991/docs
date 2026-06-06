# Phase 6 — Overview

```yaml
agent_load_tier: T2_CONTEXT
execution_router: phase-6-agent-router.md
fail_if: "T0 implementation loads this file first"
```

## Objectives

1. Replace Denali **probe** package with production `WorkspacePlugin`.
2. Port legacy domain without polluting `platform-core`.
3. Wire api/web bootstrap for `workspace_type: denali`.
4. Prove parity via smoke + MinIO e2e + contract specs.
5. Execute `migrateCanonical` for controlled tenants.

## Repo snapshot

| Artifact                         | Status       |
| -------------------------------- | ------------ |
| `packages/workspaces/denali`     | Probe only   |
| `legacy/packages/denali-domain/` | Port source  |
| Phase 5 data layer               | Prerequisite |

**Truth:** [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md)

## Documentation status

| Metric               | Value                                                                             |
| -------------------- | --------------------------------------------------------------------------------- |
| Doc execution system | **96** — [`audits/DOC-EXECUTION-SCORECARD.md`](audits/DOC-EXECUTION-SCORECARD.md) |
| Repo behavioral      | **0** — probe-only                                                                |

Validate doc pack: `pnpm run phase-6:guard`.

## Out of scope (Phase 7)

`packages/workspaces/urban`, silo routing, full platform OTel split — see [`appendices/phase-boundaries.md`](appendices/phase-boundaries.md).
