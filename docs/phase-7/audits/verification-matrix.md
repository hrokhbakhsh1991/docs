# Phase 7 — Verification matrix (REQ-P7)

```yaml
matrix_version: "2026-06-04-v2"
req_range: REQ-P7-001..REQ-P7-035
command_atlas: ../appendices/req-p7-command-atlas.md
test_inventory: ../appendices/test-inventory.md
```

| REQ ID     | Subphase | Claim                    | Verification command                                                                                                  |
| ---------- | -------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| REQ-P7-001 | 7.0      | Phase 6 gate pass        | `pnpm run phase-6:gate`                                                                                               |
| REQ-P7-002 | 7.0      | Entry yaml complete      | `reports/phase-7-entry-verified.yaml` → `phase_6_gate.status: PASS`                                                   |
| REQ-P7-003 | 7.0      | No urban core creep      | `pnpm run guard:import-boundary`                                                                                      |
| REQ-P7-004 | 7.1      | Urban package builds     | `pnpm --filter @app-tour/workspace-urban build`                                                                       |
| REQ-P7-005 | 7.1      | Urban plugin + registry  | `pnpm --filter @app-tour/workspace-urban test`                                                                        |
| REQ-P7-006 | 7.2      | Genericity contract      | `pnpm --filter @app-tour/workspace-urban exec node --import tsx --test test/phase-7.contract.spec.ts`                 |
| REQ-P7-007 | 7.2      | No platform-core diff    | `git diff $(yq .baseline_sha reports/phase-7-genericity-baseline.yaml) -- packages/platform-core`                     |
| REQ-P7-008 | 7.2      | RULE-P7-001              | `rg 'URBAN' packages/platform-core --glob '!*.md'` → empty                                                            |
| REQ-P7-009 | 7.3      | API urban resolve        | `pnpm --filter @apps/api exec node --import tsx --test test/urban-workspace-plugin.spec.ts`                           |
| REQ-P7-010 | 7.3      | Web urban registry       | `pnpm --filter @apps/web build`                                                                                       |
| REQ-P7-011 | 7.3      | No Denali rail           | P7-X-A02 static guard + RULE-P7-003                                                                                   |
| REQ-P7-012 | 7.4      | Create tour HTTP         | `pnpm --filter @apps/api exec node --import tsx --test test/urban-create-publish.integration.spec.ts`                 |
| REQ-P7-013 | 7.4      | Publish transition       | same spec — publish case                                                                                              |
| REQ-P7-014 | 7.4      | Slim validation          | `urban-tour-invalid-itinerary.json` fails in spec                                                                     |
| REQ-P7-015 | 7.5      | §10.2 log fields         | `node scripts/guards/audit-log-fields.mjs --phase 7`                                                                  |
| REQ-P7-016 | 7.5      | Runbook complete         | `docs/phase-7/appendices/OBSERVABILITY-RUNBOOK.md` review                                                             |
| REQ-P7-017 | 7.5      | Generic observability    | `rg "workspaceType === 'urban'" apps/api/src/common/logging` → empty                                                  |
| REQ-P7-018 | 7.6      | Redis per-tenant keys    | `pnpm --filter @apps/api exec node --import tsx --test test/rate-limit-tenant.spec.ts`                                |
| REQ-P7-019 | 7.6      | Tier caps                | env `RATE_LIMIT_POOL_RPM` / `RATE_LIMIT_SILO_RPM` loaded in spec                                                      |
| REQ-P7-020 | 7.6      | 429 structured body      | assert in `rate-limit-tenant.spec.ts`                                                                                 |
| REQ-P7-021 | 7.7      | tenant_routes DDL        | `infra/sql/003_tenant_routes.sql` applied                                                                             |
| REQ-P7-022 | 7.7      | Pool route               | `pnpm --filter @app-tour/tenant-kernel exec node --import tsx --test test/tenant-connection-router.spec.ts` pool case |
| REQ-P7-023 | 7.7      | Silo route               | same spec — silo case                                                                                                 |
| REQ-P7-024 | 7.8      | ci:integrity             | `pnpm run ci:integrity`                                                                                               |
| REQ-P7-025 | 7.8      | Cross-workspace RLS      | `apps/api/test/rls-tenant-isolation.spec.ts` — ADV-P7-P0-01                                                           |
| REQ-P7-026 | 7.8      | Genericity holds         | re-run `phase-7.contract.spec.ts`                                                                                     |
| REQ-P7-027 | 7.9      | phase-7:gate             | `pnpm run phase-7:gate`                                                                                               |
| REQ-P7-028 | 7.9      | Contract spec at closure | `phase-7.contract.spec.ts` exit 0                                                                                     |
| REQ-P7-029 | 7.9      | Forensic ≥8              | `FORENSIC-RUBRIC.md` weighted score                                                                                   |
| REQ-P7-030 | 7.9      | ci:integrity at closure  | `pnpm run ci:integrity`                                                                                               |
| REQ-P7-031 | 7.1      | URBAN-MINIMAL-SCOPE      | `urban-registry.spec.ts` matches scope table                                                                          |
| REQ-P7-032 | 7.7      | TENANT-ROUTER-SPEC       | TenantRoute extension matches spec                                                                                    |
| REQ-P7-033 | 7.5      | OTel optional            | `env-runtime-matrix.md` OTEL\_\*                                                                                      |
| REQ-P7-034 | 7.6      | REDIS_URL BLOCKER        | IMPLEMENTATION-TRUTH BL-P7-02 if unset                                                                                |
| REQ-P7-035 | 7.9      | hot_paths verified       | IMPLEMENTATION-MAP all VERIFIED_BEHAVIORAL                                                                            |

## Honesty

Rows reference **TARGET** test paths until implementation — see [`test-inventory.md`](../appendices/test-inventory.md).
