# Phase 6 — Denali workspace (product plugin)

```yaml
phase_id: "6"
phase_name: "Denali Workspace — first product workspace"
adr: "ADR-006 (proposed — see phase-6/appendices/adr-006.md)"
prerequisite: pnpm run phase-5:gate
closure: pnpm run phase-6:gate
agent_entry: docs/phase-6/phase-6-agent-router.md
legacy_reference: legacy/packages/denali-domain/
```

## North star

Port **Denali** from `legacy/` into `packages/workspaces/denali` as a full `WorkspacePlugin` — **zero** feature PRs in `packages/platform-core` that exist only because Denali needs a special case.

| In scope (Phase 6)                                             | Out of scope (Phase 7+)       |
| -------------------------------------------------------------- | ----------------------------- |
| `denaliPlugin`, field registry, composites, `theme/tokens.css` | `packages/workspaces/urban`   |
| Finance hooks **inside plugin** via event bus                  | Silo `TenantConnectionRouter` |
| Lazy bootstrap in api/web                                      | Full OTel platform split      |
| MinIO photo upload e2e                                         | CDC / warehouse               |

## MAP alignment (§11)

| #   | Deliverable                            | Subphase doc                                                                         |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| 6.1 | Package shell + `denaliPlugin` export  | [`phase-6/subphases/6.1-denali-package.md`](phase-6/subphases/6.1-denali-package.md) |
| 6.2 | Registry/rules port from legacy domain | [`6.2-registry-rules.md`](phase-6/subphases/6.2-registry-rules.md)                   |
| 6.3 | Widgets + theme CSS                    | [`6.3-widgets-theme.md`](phase-6/subphases/6.3-widgets-theme.md)                     |
| 6.4 | Finance slice (plugin boundary)        | [`6.4-finance-slice.md`](phase-6/subphases/6.4-finance-slice.md)                     |
| 6.5 | api/web bootstrap                      | [`6.5-bootstrap.md`](phase-6/subphases/6.5-bootstrap.md)                             |
| 6.6 | Smoke parity vs legacy                 | [`6.6-smoke-parity.md`](phase-6/subphases/6.6-smoke-parity.md)                       |
| 6.7 | MinIO photo e2e                        | [`6.7-minio-photos.md`](phase-6/subphases/6.7-minio-photos.md)                       |
| 6.8 | `migrateCanonical` execution           | [`6.8-migrate-canonical.md`](phase-6/subphases/6.8-migrate-canonical.md)             |

## Repo truth (trunk 2026-06-04)

| Path                                       | Status                                                              |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `packages/workspaces/denali`               | **Probe only** — `DENALI_BREACH_PROBE`; not a product workspace yet |
| `packages/workspaces/starter`              | **Reference** implementation pattern                                |
| `apps/api/.../resolve-workspace-plugin.ts` | `denali` → `WORKSPACE_PLUGIN_NOT_BOUND`                             |
| `legacy/packages/denali-domain/`           | Port source — reference only                                        |

## Documentation score (doc-only)

| Metric               | Value                    |
| -------------------- | ------------------------ |
| Doc execution system | **96**                   |
| Guard                | `pnpm run phase-6:guard` |

See [`phase-6/audits/DOC-EXECUTION-SCORECARD.md`](phase-6/audits/DOC-EXECUTION-SCORECARD.md).

## Research (pre–subphase depth)

Industry + legacy forensic synthesis (non-executable):

- [`research/phase-6-denali-workspace-research.md`](research/phase-6-denali-workspace-research.md)
- T0 stub: [`research/phase-6-denali-workspace-research.ai-exec.md`](research/phase-6-denali-workspace-research.ai-exec.md)

## Agent execution

**Do not** implement from this file alone. Use [`phase-6/phase-6-agent-router.md`](phase-6/phase-6-agent-router.md) + [`phase-6/appendices/BOOT-MANIFEST.yaml`](phase-6/appendices/BOOT-MANIFEST.yaml).

## §12 covenant

- Contract specs + HTTP/e2e — not grep-only closure
- Verification command per capability claim
- Forensic audit ≥ 8 at 6.9
- See [`MIGRATION-MAP.md`](MIGRATION-MAP.md) Phase 6 checklist
