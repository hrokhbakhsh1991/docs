# CW9-01 — Composable workspace certification protocol

**Status:** Executable (2026-08-24)  
**Metrics script:** `node scripts/metrics/cw-architecture-metrics.mjs` (CW0-09 — no second implementation)  
**Baseline:** `docs/dev/cw-metrics-baseline.json` (frozen CW0-10, do not mutate)

## Synthetic scenarios

| Id | Workspace | Onboarding path | Vertical |
|----|-----------|-----------------|----------|
| **A** | `cert-club` | `pnpm run workspace:create -- cert-club --profile starter-outdoor --guest` | Similar outdoor club |
| **B** | `cert-events` | `pnpm run workspace:create -- cert-events --guest` + events manifest bindings | Materially different (at-create registration) |

## Measurement inputs (`scripts/metrics/cw-similar-workspace-onboarding-inputs.json`)

- `similarWorkspaceId`: `cert-club`
- `guest-scaffold` planner paths for cert-club file counts
- `generatedRegistryOutputs` list (unchanged schemaVersion 1 rules)

Add `cert-events` paths to metrics script guest scaffold enumeration when cert-events is retained (CW9-08).

## Certification dimensions (per scenario)

1. Scaffolded / manual file counts (non-generated TS/TSX)
2. Generic host edits (must remain 0 new edits)
3. Copied Denali modules (AST similarity threshold 0.85 — must be 0)
4. `workspaceIdBranches` in neutral production code
5. Formal reusable capabilities enabled
6. `workspacePolicy` seam exercised (cert-club: two rules)
7. Profile composition determinism (`starter-outdoor` for cert-club only)
8. Registry `generate:workspace-registry --check` byte-identical (CW9-07)

## Execution order

1. CW9-02 cert-club scaffold
2. CW9-03 capability composition + policy
3. CW9-04 cert-club behavior suite
4. CW9-05 cert-events scaffold
5. CW9-06 cert-events member display
6. CW9-07 registry determinism (both workspaces)
7. CW9-08 metrics rerun vs frozen baseline
8. CW9-09 guard sweep
9. CW9-10 certification report + retention decision

## Retention policy (CW9-10)

Default: **KEEP_AS_CERT_FIXTURES** under `packages/workspaces/cert-club` and `packages/workspaces/cert-events` until Architect records `RETIRE_AFTER_EVIDENCE` in ledger.

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw9-01-certification-protocol.md`.*
