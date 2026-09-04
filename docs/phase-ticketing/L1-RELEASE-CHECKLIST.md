# Phase L1 — Ticketing Production V1 Release Checklist

**Branch:** `feature/ticketing-system`  
**Standard:** [`docs/standards/ticketing-system.mdoc`](../standards/ticketing-system.mdoc)

## Pre-merge gates

- [ ] All ticketing unit tests pass (`ticketing-core`, `ticketing-http`, `ticketing-http-contracts`)
- [ ] All ticketing PostgreSQL specs pass (RLS, tenant isolation, storage, notifications, SLA, templates, K1)
- [ ] Portal + Web Playwright ticketing suites pass (member, operator, viewer, mobile, RTL)
- [ ] No skipped tests without documented reason
- [ ] `pnpm` builds: `@apps/api`, `@apps/portal`, `@apps/web`, `@app-tour/workspace-sdk`
- [ ] Guards: `guard:import-boundary`, `guard:repository-rls`, `guard:api-workspace-isolation`, `guard:pcms-authority`
- [ ] Prisma `migrate deploy` succeeds on fresh DB and existing dev schema
- [ ] `migration_lock.toml` provider matches (`postgresql`)
- [ ] Working tree clean; branch synced with `origin/feature/ticketing-system`
- [ ] No secrets/credentials in diff

## Tenant isolation sign-off

- [ ] API routes enforce `tenantId` via RLS + `withTenantRls`
- [ ] Portal BFF never leaks cross-tenant ticket IDs
- [ ] Web operator BFF proxies with session bearer only
- [ ] Report cache keys include `tenantId`
- [ ] Object storage keys prefixed `tickets/{tenantId}/`
- [ ] Notification outbox dedupe scoped per tenant

## Permission matrix sign-off

| Role | Portal | Operator API | Settings/Reports |
|------|--------|--------------|------------------|
| member | own tickets CRUD (public) | denied | denied |
| viewer | own read (if member) / N/A operator | tenant read-only | read-only |
| admin | — | full mutate | read/write |
| owner | — | full mutate | read/write |
| platform_admin | — | via host policy | via host policy |

## Enablement (production)

1. Ensure workspace manifest `workspaceTicketing.supported: true` for target workspace
2. Set tenant theme `enabledModules` includes `ticketing` (or `defaultModuleEnabledWhenUnset`)
3. Run `prisma migrate deploy` on target Postgres (never memory driver)
4. Seed Denali defaults (templates, queues) on first operator access
5. Smoke: member create + operator reply on staging **before** production (out of scope for this branch commit)

## Artifacts

- [ ] `L1-CERTIFICATION-REPORT.md` with SHA, test log summary, screenshots
- [ ] Member + operator flow screenshots under `/opt/cursor/artifacts/screenshots/`
