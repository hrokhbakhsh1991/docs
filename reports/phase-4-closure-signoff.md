# Phase 4 — Final closure sign-off

```yaml
signoff_type: phase-4-closure-final
date: "2026-06-04"
status: READY_TO_DEVELOP
branch: feat/phase-4
# Phase 3 platform baseline (nested inside phase-4:gate step 3)
phase_3_platform_sha: "1937f0b"
phase_4_doc_hardening_sha: "6395caa"
phase_4_storage_architecture_sha: "210d9f7"
tiered_testing_sha: "5afd9ad"
closure_signoff_doc_sha: "cede9fc"
gate_command: pnpm run phase-4:gate
gate_report: reports/phase-4-gate-2026-06-04.json
gate_report_ok: true
gate_report_git_sha: "6395caa"
human_confirmed_phase_3_baseline: "1937f0b"
```

## Executive summary

**Phase 4 is Ready to Develop.** The local and CI-capable environment is **production-identical** for storage and tenant isolation:

- Postgres with **RLS** (`infra/sql/001_tenant_rls.sql`, Prisma migrations)
- **`STORAGE_DRIVER=prisma`** with `withTenantRls` transaction sessions
- Workspace plugin **validate-before-persist**
- **`pnpm run phase-4:gate` → exit 0** with all required **`p4_*`** checks **PASS**, including **`p4_rls_integration_tests`**

Phase 3 integration remains locked at **`1937f0b`** (confirmed baseline; executed again inside `phase-4:gate` via `phase-3:gate`).

Storage architecture is committed at **`210d9f7`** (`feat(phase-4): establish RLS-secured production-ready storage architecture`). Tiered testing (fast pre-commit) is at **`5afd9ad`**.

## Phase 4 guard test matrix (binding)

**Artifact:** [`phase-4-gate-2026-06-04.json`](phase-4-gate-2026-06-04.json) — `"ok": true`, `"gate": "phase-4"`, `"date": "2026-06-04"`

| #   | Check ID                       | Enforcement     | Required | Result   | Notes                                                           |
| --- | ------------------------------ | --------------- | -------- | -------- | --------------------------------------------------------------- |
| 1   | `p4_red_flag_prerequisite`     | P4-E-RF-40      | yes      | **PASS** | `reports/phase-3.2-red-flag-status-2026-06-04.md`               |
| 2   | `p4_tenant_kernel_build`       | —               | yes      | **PASS** | `@app-tour/tenant-kernel` build                                 |
| 3   | `p4_tenant_kernel_test`        | P4-E-HOST-01    | yes      | **PASS** | tenant-kernel tests ≥ 6                                         |
| 4   | `p4_platform_events_build`     | —               | yes      | **PASS** | `@app-tour/platform-events` build                               |
| 5   | `p4_platform_events_test`      | P4-E-EVT-01     | yes      | **PASS** | platform-events tests ≥ 2                                       |
| 6   | `p4_contract_spec`             | —               | yes      | **PASS** | `phase-4.contract.spec.ts`                                      |
| 7   | `p4_no_denali_in_kernel`       | —               | yes      | **PASS** | no Denali coupling in kernel/events                             |
| 8   | `p4_infra_compose`             | —               | yes      | **PASS** | `infra/docker-compose.yml`                                      |
| 9   | **`p4_rls_integration_tests`** | **P4-E-RLS-01** | **yes**  | **PASS** | RLS + tenant-security (`DATABASE_URL`, `STORAGE_DRIVER=prisma`) |
| 10  | `p4_anti_hollow_tests`         | P4-E-RLS-01     | yes      | **PASS** | mechanism tests non-hollow                                      |

**Closure chain:** `pnpm build` → `pnpm test` → `pnpm run phase-3:gate` → `pnpm run phase-4:guard`.

## Appendix E test matrix ↔ evidence

| Matrix ID   | Layer         | Scenario                           | Verified by                                                                    |
| ----------- | ------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| TK-1 / TK-2 | tenant-kernel | Host label rules                   | `p4_tenant_kernel_test`                                                        |
| RLS-1       | postgres      | Tenant A cannot read tenant B rows | `p4_rls_integration_tests` → `apps/api/test/rls-isolation.integration.spec.ts` |
| AUTH-1      | api           | Dev bearer gated                   | `apps/api/test/tenant-security.spec.ts`                                        |
| EVT-1       | events        | Domain events carry tenantId       | `p4_platform_events_test`                                                      |
| TH-1        | web           | Tenant theme/config route          | Subphase 4.4 — `GET /api/v2/tenant-config`                                     |
| OBS-1       | api           | Structured logging scaffold        | Non-blocking (4.1–4.5)                                                         |

## Storage architecture (commit `210d9f7`)

| Component                            | Path                                                 |
| ------------------------------------ | ---------------------------------------------------- |
| Prisma schema + migrations           | `apps/api/prisma/`                                   |
| RLS session wrapper                  | `apps/api/src/db/with-tenant-rls.ts`                 |
| Prisma tour repository               | `apps/api/src/storage/prisma-tour.repository.ts`     |
| Admin probe (bypass RLS for resolve) | `DATABASE_URL_ADMIN`, `getPrismaAdmin()`             |
| Validate-before-persist              | `apps/api/src/workspace/`, `canonical-validation.ts` |
| Dev Postgres stack                   | `docs/phase-4/dev/docker-compose.yml`                |
| RLS SQL                              | `infra/sql/001_tenant_rls.sql`                       |

## Mandatory environment (reproduce gate)

```bash
nvm use 24 && corepack enable && pnpm install
docker compose -f docs/phase-4/dev/docker-compose.yml up -d
export DATABASE_URL="postgresql://app_tour:app_tour@localhost:${PHASE4_DB_PORT:-5434}/tour_db"
export DATABASE_URL_ADMIN="postgresql://postgres:postgres@localhost:${PHASE4_DB_PORT:-5434}/tour_db"
export STORAGE_DRIVER=prisma
pnpm --filter @apps/api exec prisma migrate dev
psql "$DATABASE_URL_ADMIN" -f infra/sql/001_tenant_rls.sql
pnpm run phase-4:gate   # full closure
# Fast local loop: pnpm run pre-commit:fast | pnpm run test:full
```

See [`docs/phase-4/ci.md`](../docs/phase-4/ci.md) and [`docs/dev/tiered-testing.md`](../docs/dev/tiered-testing.md).

## Audit trail (`audit-logs/`)

Phase 0–3 working notes archived from `TEMP/` for long-term tracking:

| File                                                      | Origin        |
| --------------------------------------------------------- | ------------- |
| `audit-logs/phase-0-implementation-audit-2026-06-04.md`   | `TEMP/`       |
| `audit-logs/phase-1-forensic-audit-actions-2026-06-04.md` | `TEMP/`       |
| `audit-logs/phase-2-action-checklist.md`                  | prior archive |
| `audit-logs/phase-2-temp-report.md`                       | prior archive |
| `audit-logs/phase-3-blockers.md`                          | prior archive |
| `audit-logs/phase-3-gap-closure-3phases.md`               | prior archive |

`TEMP/` directory removed after relocation.

## Deferred (not blocking Ready to Develop)

- P4E-04 / P4E-05 provisioning (human)
- Phase 4.6 forensic `VERIFIED` on CI for all subphases 4.0–4.5
- Playwright TH-1 web accent e2e (4.4)

---

**Sign-off:** Phase 4 — **Ready to Develop** (production-identical storage + RLS gate proven).

**Architect, documentation status: Updated. Link to docs:** [`docs/phase-4/ci.md`](../docs/phase-4/ci.md) · [`docs/phase-4/audits/IMPLEMENTATION-TRUTH.md`](../docs/phase-4/audits/IMPLEMENTATION-TRUTH.md)
