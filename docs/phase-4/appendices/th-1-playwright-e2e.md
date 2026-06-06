# Phase 4.4 — TH-1 Playwright e2e (tenant theme isolation)

```yaml
test_matrix_id: TH-1
subphase: "4.4"
dod: DOD-7
scenario: "tenant-a accent ≠ tenant-b"
```

## Purpose

Web-layer proof that two tenants receive distinct tenant theme CSS variables via `GET /api/v2/tenant-config` → `ThemeProviderChain` → `[data-tenant-theme]`.

API baseline: `apps/api/test/4-integration/dynamic-config-sync.spec.ts` (Postgres). TH-1 adds **browser** proof per [`test-matrix.md`](test-matrix.md).

## Prerequisites

```bash
docker compose -f docs/phase-4/dev/docker-compose.yml up -d
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32'
export DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db'
DATABASE_URL="$DATABASE_URL_ADMIN" pnpm --filter @apps/api run db:migrate:deploy
```

## Host-based dev session

Web layout resolves `tenant-a` / `tenant-b` from `Host` when `ALLOW_DEV_WEB_SESSION=true` (see `apps/web/src/tenant/resolve-host-tenant.ts`).

**RSC boundary:** `SerializableBootstrap` passes only `context` + `tenantTheme` to client providers; workspace plugin is re-bound from the server module singleton (`bootstrapPlugin`) so function-bearing plugin objects are not serialized (required for Next.js 15 dev + Playwright TH-1).

Seed colors (MAP 4.3):

| Subdomain | `--color-primary` |
|-----------|-------------------|
| tenant-a | `#2563eb` |
| tenant-b | `#dc2626` |

## Run

```bash
pnpm --filter @apps/web run test:e2e:th-1
```

Playwright starts API (3001) + web (3000) via `playwright.config.ts` `webServer` when not already running.

## Pass criteria

- Navigate `http://tenant-a.localhost:3000/` → `[data-tenant-theme]` style `--color-primary` = `#2563eb`
- Navigate `http://tenant-b.localhost:3000/` → `--color-primary` = `#dc2626`
- Values must differ (TH-1)

## Files

| Path | Role |
|------|------|
| `apps/web/playwright.config.ts` | Config + webServer |
| `apps/web/tests/e2e/th-1-tenant-theme-isolation.spec.ts` | TH-1 spec |
| `apps/web/scripts/seed-th1-tenants.mjs` | Postgres seed before e2e |
