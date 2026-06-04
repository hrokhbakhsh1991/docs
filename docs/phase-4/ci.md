# Phase 4 — CI / guards / gates

> **SOURCE OF TRUTH:** CI pipeline and PR gate requirements  
> **Guard script (p4_*):** [`phase-4-guard.md`](phase-4-guard.md)  
> **Enforcement (P4-E-*):** [`phase-4-enforcement.md`](phase-4-enforcement.md)  
> **Subphase map:** [`audits/subphase-enforcement-map.md`](audits/subphase-enforcement-map.md)

```yaml
ci_meta:
  closure_gate: pnpm run phase-4:gate
  guard_only: pnpm run phase-4:guard
  fail_token: FAIL
  binding: REPO_SCRIPTS_OVER_STALE_MD
  obsolete_retired:
    - "narrative §14.2 numbered guard table — use p4_* ids"
    - "depcruise inside phase-4:guard — covered by phase-3:gate step 3"

execution_commands:
  - id: P4-CMD-01
    action: RUN
    command: pnpm run phase-4:gate
    when: subphase 4.6 closure
    expect_exit: 0
    enforcement: P4-E-GATE
  - id: P4-CMD-02
    action: RUN
    command: pnpm run phase-4:guard
    when: guard debug only
    rule: FORBIDDEN sole merge proof without P4-CMD-01
  - id: P4-CMD-03
    action: RUN
    command: pnpm run phase-3:gate
    when: nested inside P4-CMD-01 step 3
    enforcement: P4-E-REG-03
```

## Phase 4 CI environment (required)

Phase 4 guard step 4 (`phase-4:guard`) runs **`p4_rls_integration_tests`**, which spawns `apps/api` integration specs with:

| Variable | Required value | When |
|----------|----------------|------|
| `DATABASE_URL` | Postgres URL (e.g. `postgresql://app_tour:app_tour@127.0.0.1:5433/app_tour_dev`) | Before `phase-4:guard` / `phase-4:gate` |
| `STORAGE_DRIVER` | `prisma` | Set automatically in guard spawn; **must** be `prisma` in CI job env for 4.2 runtime parity |

```bash
# Dev profile (Phase 4 implementation — docs/phase-4/dev/docker-compose.yml)
# Host port defaults to 5434 when 5432 is already in use (PHASE4_DB_PORT).
# Use app_tour (non-superuser) for RLS tests — postgres superuser bypasses RLS.
docker compose -f docs/phase-4/dev/docker-compose.yml up -d
export DATABASE_URL_ADMIN="${DATABASE_URL_ADMIN:-postgresql://postgres:postgres@localhost:${PHASE4_DB_PORT:-5434}/tour_db}"
export DATABASE_URL="${DATABASE_URL:-postgresql://app_tour:app_tour@localhost:${PHASE4_DB_PORT:-5434}/tour_db}"
export DATABASE_URL_ADMIN="${DATABASE_URL_ADMIN:-postgresql://postgres:postgres@localhost:${PHASE4_DB_PORT:-5434}/tour_db}"
export STORAGE_DRIVER=prisma
psql "$DATABASE_URL_ADMIN" -f docs/phase-4/dev/init/01-app-role.sql 2>/dev/null || true
pnpm --filter @apps/api exec prisma migrate dev --name phase4_schema
psql "$DATABASE_URL_ADMIN" -f infra/sql/001_tenant_rls.sql
pnpm run phase-4:gate
```

Alternate stack (repo root `infra/docker-compose.yml`, port 5433):

```bash
export DATABASE_URL="${DATABASE_URL:-postgresql://app_tour:app_tour@127.0.0.1:5433/app_tour_dev}"
export STORAGE_DRIVER=prisma
docker compose -f infra/docker-compose.yml up -d
psql "$DATABASE_URL" -f infra/sql/001_tenant_rls.sql
pnpm run phase-4:gate
```

Without `DATABASE_URL`, `p4_rls_integration_tests` is **`ok: false`** (required). See [`appendices/env-runtime-matrix.md`](appendices/env-runtime-matrix.md).

## Closure gate (`phase-4:gate`)

| Step | Command | Enforcement |
|------|---------|-------------|
| 1 | `pnpm build` | — |
| 2 | `pnpm test` | — |
| 3 | `pnpm run phase-3:gate` | P4-E-REG-03 |
| 4 | `pnpm run phase-4:guard` | p4_* → reports/phase-4-gate-*.json (includes RLS integration when env set) |

**Not in outer chain (by design):** `guard:architecture`, `guard:import-boundary` — nested in phase-3:gate step 3.

## Pre-commit vs PR

| Context | Script | Runs phase-4:gate? |
|---------|--------|-------------------|
| Husky `ci:integrity` | `scripts/ci-integrity-check.sh` | No — phase-0 + phase-1 only |
| PR / Phase 4.6 closure | explicit `pnpm run phase-4:gate` | **Yes — required** |

## CI ↔ subphase

| Subphase | Primary commands | P4-E (primary) |
|----------|------------------|----------------|
| 4.0 | `phase-3:gate`, red-flag report | P4-E-RF-40, P4-E-AUTH-01 |
| 4.1 | `tenant-kernel` build/test, `test:phase-4` | P4-E-HOST-01, P4-E-RLS-02 |
| 4.2 | `DATABASE_URL` + `STORAGE_DRIVER=prisma`, compose, `p4_rls_integration_tests` | P4-E-RLS-01, P4-E-DATA-01 |
| 4.3 | api e2e two-tenant | P4-E-TENANT-01 |
| 4.4 | tenant-config route, web e2e TH-1 | — (TH-1 matrix) |
| 4.5 | `platform-events` test, TourCreated integration | P4-E-EVT-01 |
| 4.6 | `phase-4:gate`, forensic, `guard:doc-sync` | P4-E-GATE |

## Interpret gate JSON

```yaml
report_path: reports/phase-4-gate-YYYY-MM-DD.json
pass_rule: top_level ok == true AND every required check ok == true
fail_action: READ checks[].detail — fix before updating IMPLEMENTATION-TRUTH to VERIFIED
closure_checklist: audits/CLOSURE-CHECKLIST.md
```

## Local developer workflow

```bash
nvm use && corepack enable
pnpm install
docker compose -f infra/docker-compose.yml up -d
pnpm run phase-4:gate   # full closure — see CLOSURE-CHECKLIST.md
```

## PR requirements

- Label `Phase: 4.N` for active subphase only  
- List satisfied **P4-E-*** rows from [`audits/verification-matrix.md`](audits/verification-matrix.md)  
- **4.1+ forbidden** until `reports/phase-3.2-red-flag-status-*.md` exists (`p4_red_flag_prerequisite`)

**Legacy filename:** narrative `§14.2` — retired; bind to this file + `phase-4-guard.md`.

## Gate scaling note (platform engineering)

```yaml
gate_scaling:
  risk_id: FR-01
  chain: "build → test (workspace) → phase-3:gate → phase-4:guard"
  bottleneck: "nested phase-3:gate inside phase-4:gate duplicates phase-2/3 work on every 4.6 run"
  mitigations:
    - "Package-scoped test during subphases 4.1–4.5"
    - "Full phase-4:gate only at 4.6 closure and release branches"
    - "Future: optional phase-4:gate:fast profile (rejected until scripted — see FUTURE-PROOFING-REPORT.md)"
  pre_commit: "ci:integrity does not run phase-4:gate — by design (FR-11)"
```
