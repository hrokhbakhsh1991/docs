# Phase 4 — Closure sign-off (environment ready)

```yaml
signoff_type: phase-4-entry-ready
date: "2026-06-04"
phase_3_entry_sha: "1937f0b"
phase_4_doc_hardening_sha: "6395caa"
phase_4_storage_gate_sha: "set-at-commit"
status: READY_TO_DEVELOP
gate_command: pnpm run phase-4:gate
gate_report: reports/phase-4-gate-2026-06-04.json
```

## Executive summary

Phase 4 local environment is **production-identical** for storage and tenant isolation: Postgres with RLS, `STORAGE_DRIVER=prisma`, workspace plugin validation before persist, and **`phase-4:gate` exit 0** with all required `p4_*` checks PASS (including `p4_rls_integration_tests`).

Phase 3 integration scaffold remains locked at **`1937f0b`** (`feat(phase-3): close 3.3.x gaps, select/checkbox, and gate-passed docs`).

## Gate matrix (binding artifact)

Source: [`reports/phase-4-gate-2026-06-04.json`](phase-4-gate-2026-06-04.json) — `ok: true`

| Check ID | Enforcement | Required | Result |
|----------|-------------|----------|--------|
| `p4_red_flag_prerequisite` | P4-E-RF-40 | yes | PASS |
| `p4_tenant_kernel_build` | — | yes | PASS |
| `p4_tenant_kernel_test` | P4-E-HOST-01 | yes | PASS |
| `p4_platform_events_build` | — | yes | PASS |
| `p4_platform_events_test` | P4-E-EVT-01 | yes | PASS |
| `p4_contract_spec` | — | yes | PASS |
| `p4_no_denali_in_kernel` | — | yes | PASS |
| `p4_infra_compose` | — | yes | PASS |
| **`p4_rls_integration_tests`** | **P4-E-RLS-01** | **yes** | **PASS** |
| `p4_anti_hollow_tests` | P4-E-RLS-01 | yes | PASS |

Nested closure chain inside `phase-4:gate`: `pnpm build` → `pnpm test` → `pnpm run phase-3:gate` → `pnpm run phase-4:guard`.

## Appendix E test matrix ↔ evidence

| Matrix ID | Layer | Scenario | Verified by |
|-----------|-------|----------|-------------|
| TK-1 / TK-2 | tenant-kernel | Host label rules | `p4_tenant_kernel_test` |
| RLS-1 | postgres | Tenant A cannot read tenant B rows | `p4_rls_integration_tests` → `test/rls-isolation.integration.spec.ts` |
| AUTH-1 | api | Dev bearer gated | `test/tenant-security.spec.ts` (in guard spawn) |
| EVT-1 | events | Domain events carry tenantId | `p4_platform_events_test` |
| TH-1 | web | Tenant theme/config route | `GET /api/v2/tenant-config` — prove in 4.4 subphase |
| OBS-1 | api | Structured logging scaffold | Non-blocking (4.1–4.5) |

## Storage architecture delivered (this commit)

| Component | Path |
|-----------|------|
| Prisma schema + migrations | `apps/api/prisma/` |
| RLS session wrapper | `apps/api/src/db/with-tenant-rls.ts` |
| Prisma tour repository (RLS transactions) | `apps/api/src/storage/prisma-tour.repository.ts` |
| CASL id probe (admin URL) | `DATABASE_URL_ADMIN` + `getPrismaAdmin()` |
| Workspace plugin validate-before-persist | `apps/api/src/workspace/`, `canonical-validation.ts` |
| Dev Postgres stack | `docs/phase-4/dev/docker-compose.yml` |
| RLS SQL | `infra/sql/001_tenant_rls.sql` |

## Mandatory local / CI environment

```bash
docker compose -f docs/phase-4/dev/docker-compose.yml up -d
export DATABASE_URL="postgresql://app_tour:app_tour@localhost:${PHASE4_DB_PORT:-5434}/tour_db"
export DATABASE_URL_ADMIN="postgresql://postgres:postgres@localhost:${PHASE4_DB_PORT:-5434}/tour_db"
export STORAGE_DRIVER=prisma
pnpm --filter @apps/api exec prisma migrate dev
psql "$DATABASE_URL_ADMIN" -f infra/sql/001_tenant_rls.sql
nvm use 24 && pnpm run phase-4:gate
```

See [`docs/phase-4/ci.md`](../docs/phase-4/ci.md). Use **`app_tour`** for `DATABASE_URL` (RLS enforced); **`postgres`** only for migrate/admin.

## Human / deferred (not blocking entry)

- P4E-04 / P4E-05 provisioning (T3 human)
- Phase 4.6 forensic `VERIFIED` — requires all subphases 4.0–4.5 proven on CI
- Playwright TH-1 web accent e2e (4.4)

## Audit trail relocation

Phase 3 working notes moved from `TEMP/` to [`audit-logs/`](../audit-logs/) for long-term tracking (see git history for filenames).

---

**Sign-off:** Phase 4 — **Ready to Develop** (environment production-identical for storage + RLS gate).

**Architect, documentation status: Updated. Link to docs:** [`docs/phase-4/ci.md`](../docs/phase-4/ci.md) · [`docs/phase-4/audits/IMPLEMENTATION-TRUTH.md`](../docs/phase-4/audits/IMPLEMENTATION-TRUTH.md)
