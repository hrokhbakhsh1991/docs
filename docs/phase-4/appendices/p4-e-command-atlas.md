# Phase 4 — P4-E command atlas

```yaml
agent_load_tier: T0_execution
binding: package.json + phase-4-guard.mjs
node: ">=24.0.0 <25"
```

## Full gate

```bash
nvm use && corepack enable && pnpm install
docker compose -f infra/docker-compose.yml up -d   # 4.2+
pnpm run phase-4:gate
# → reports/phase-4-gate-$(date +%F).json
```

## Per P4-E (copy-paste)

| P4-E | Subphase | Command(s) | Pass signal |
|------|----------|------------|-------------|
| **P4-E-RF-40** | 4.0 | `pnpm run phase-3:gate` · verify `reports/phase-3.2-red-flag-status-*.md` | `p4_red_flag_prerequisite` ok |
| **P4-E-AUTH-01** | 4.0 | `pnpm --filter @apps/api test -- src/tenant-kernel/auth-env.spec.ts` · `tenant-kernel.spec.ts` | prod bearer 401 tests green |
| **P4-E-SCALE-01** | 4.0 | `pnpm --filter @apps/api test -- src/storage/in-memory-tour.repository.spec.ts` | no full-scan on write |
| **P4-E-HOST-01** | 4.1 | `pnpm --filter @app-tour/tenant-kernel run build test test:phase-4` | ≥6 tests + contract host cases |
| **P4-E-RLS-02** | 4.1, 4.2 | `pnpm --filter @app-tour/tenant-kernel run test:phase-4` | SET_LOCAL in contract |
| **P4-E-RLS-01** | 4.2 | `STORAGE_DRIVER=prisma DATABASE_URL=... pnpm --filter @apps/api test -- test/rls-isolation.integration.spec.ts` | cross-tenant 0 rows |
| **P4-E-DATA-01** | 4.2 | restart API + `GET /tours` after create with prisma driver | tour survives process restart |
| **P4-E-TENANT-01** | 4.3 | `pnpm --filter @apps/api test -- test/tenant-security.spec.ts` | 403 without tenant header |
| **P4-E-EVT-01** | 4.5 | `pnpm --filter @app-tour/platform-events run build test` | TourCreated tenantId |
| **P4-E-REG-03** | 4.6 | nested in gate step 3: `pnpm run phase-3:gate` | exit 0 |
| **P4-E-GATE** | 4.6 | `pnpm run phase-4:gate` · `pnpm run guard:doc-sync` | json `ok:true` |

## p4_* only (no P4-E id)

| p4_* | Command |
|------|---------|
| `p4_tenant_kernel_build` | `pnpm --filter @app-tour/tenant-kernel run build` |
| `p4_platform_events_build` | `pnpm --filter @app-tour/platform-events run build` |
| `p4_no_denali_in_kernel` | `rg -i denali packages/tenant-kernel packages/platform-events` → exit 1 |
| `p4_infra_compose` | test -f infra/docker-compose.yml |
| `p4_rls_integration_tests` | `DATABASE_URL=... STORAGE_DRIVER=prisma` + guard spawn (rls-isolation + tenant-security) |
| `p4_anti_hollow_tests` | auto via `phase-4-guard.mjs` |

## TH-1 (4.4 — no P4-E-*)

| ID | Command / check |
|----|-----------------|
| TH-1 | `pnpm --filter @apps/api test -- test/tenant-config.spec.ts` + web e2e accent A≠B when wired |
