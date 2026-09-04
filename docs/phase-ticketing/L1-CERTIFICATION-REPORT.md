# Phase L1 — Ticketing Production V1 Certification Report

**Date:** 2026-09-04  
**Branch:** `feature/ticketing-system`  
**Base:** K1 (`f01b4fa0` — search, reports, settings)  
**Certification commit:** `8327568f3b5039c7a8d179fcab3dcb4c514574da`  
**Verdict:** **PRODUCTION-READY (v1)** — all L1 gates green in Cloud Agent environment

---

## Certified capabilities (v1)

| Surface | Scope |
|---------|--------|
| **Member portal** | Create ticket, view detail, public reply, attachment upload, reopen after resolve |
| **Operator web** | Inbox filters, public reply, internal note, assign/team/queue/tag, resolve, close, reopen |
| **Viewer** | Tenant-wide read-only inbox + settings (mutations 403) |
| **Templates (J1)** | CRUD, rollback, safe automation interpolation |
| **Search/reports/settings (K1)** | `q` search, sort, summary/export, workspace settings merge |
| **SLA (I1)** | Policies, clocks, breach/warning events |
| **Notifications (H1)** | Durable inbox, outbox relay, dedupe |
| **Attachments (E1)** | Intent → upload → complete, tenant-scoped object keys |
| **Security** | PostgreSQL RLS FORCE on all ticketing tables; `app_tour` role for tenant I/O |

## Known limitations (post-v1)

- Bulk ticket actions, email channel ingest, CSAT, advanced workflow designer, cross-tenant analytics
- Production object storage requires MinIO/S3; E2E uses in-memory adapter (`TICKETING_E2E_MEMORY_STORAGE=1`)
- No `@axe-core/playwright` in repo; RTL/a11y covered via FA copy + responsive viewport specs

---

## Test matrix

### Unit / package

| Suite | Result | Tests |
|-------|--------|-------|
| `@app-tour/ticketing-core` | PASS | 75/75 |
| `@app-tour/ticketing-http-contracts` | PASS | 38/38 |
| `@app-tour/ticketing-http` | PASS | 2/2 |
| `apps/portal` portal-member-tickets | PASS | 10/10 |
| `apps/web` operator-tickets | PASS | 4/4 |

### PostgreSQL / RLS (`DATABASE_URL=app_tour`, `STORAGE_DRIVER=prisma`)

| Spec | Result |
|------|--------|
| `ticketing-persistence.postgres.spec.ts` | PASS |
| `ticketing-attachments-e1-postgres.spec.ts` | PASS |
| `ticketing-http-postgres.spec.ts` | PASS |
| `ticketing-operational-d1-postgres.spec.ts` | PASS |
| `ticket-notifications.postgres.spec.ts` | PASS |
| `ticket-sla.postgres.spec.ts` | PASS |
| `ticket-templates.postgres.spec.ts` | PASS |
| `ticket-k1.postgres.spec.ts` | PASS |
| **Total** | **83/83 PASS** |

**Note:** Postgres specs require `DATABASE_URL=postgresql://app_tour:app_tour@…` (not superuser) so RLS is enforced.

### Playwright E2E

| Config | Specs | Result |
|--------|-------|--------|
| `playwright.portal-ticketing.config.ts` | member smoke + notifications | **2/2 PASS** |
| `playwright.operator-ticketing.config.ts` | inbox + templates + reports/settings | **4/4 PASS** |

**Member flow:** create → reply → attachment → resolve (smoke helper) → reopen  
**Operator flow:** inbox triage, internal note, assign/queue/tag, resolve, close, reopen, viewer read-only, member denied, mobile viewport  
**RTL:** Persian UI strings in specs; FA locale portal shell

### Builds

| App | Result |
|-----|--------|
| `@app-tour/workspace-sdk` | PASS |
| `@app-tour/ticketing-core` | PASS |
| `@app-tour/ticketing-http` | PASS |
| `@apps/api` | PASS |
| `@apps/portal` | PASS |
| `@apps/web` | PASS |

### Guards

| Guard | Result |
|-------|--------|
| `guard:import-boundary` | PASS |
| `guard:repository-rls` | PASS |
| `guard:api-workspace-isolation` | PASS |
| `guard:pcms-authority` | PASS |
| `pre-commit:fast` | PASS |

### Migrations

| Check | Result |
|-------|--------|
| Existing `app_tour_dev` — `prisma migrate status` | Up to date (92 migrations) |
| Fresh DB `app_tour_l1_fresh` — `migrate deploy` | All migrations applied |
| `migration_lock.toml` provider | `postgresql` |

---

## L1 fixes applied during certification

1. **Postgres specs:** `ticketEvent.create` stray `ticketNumber`; `updateMany` syntax; outbox cleanup in HTTP/D1 specs
2. **Notifications relay test:** `processOutboxRelayForTenantOnce` (global relay starved by dev DB backlog)
3. **Portal attachment BFF URL:** removed erroneous `/upload` suffix (route is PUT on attachment id)
4. **E2E storage:** `e2e-memory-object-storage.ts` + `TICKETING_E2E_MEMORY_STORAGE=1` in smoke servers
5. **Build:** duplicate `bumpTicketActivity` import; `mapTicketRow` for audit writers; Prisma `InputJsonValue` casts
6. **Web guard:** `Checkbox` primitive in ticketing settings client

---

## Screenshots

| Artifact | Path |
|----------|------|
| Member desktop | `/opt/cursor/artifacts/screenshots/portal-tickets-desktop.png` |
| Member mobile | `/opt/cursor/artifacts/screenshots/portal-tickets-mobile.png` |
| Operator desktop | `/opt/cursor/artifacts/screenshots/operator-tickets-desktop.png` |
| Operator mobile | `/opt/cursor/artifacts/screenshots/operator-tickets-mobile.png` |

---

## Security summary

- **Tenant isolation:** RLS FORCE on tickets, messages, events, attachments, links, tags, queues, teams, templates, SLA, notifications, settings, counters
- **Permission matrix:** member (own tickets), viewer (read-only operator), admin/owner (mutate), cross-tenant denied at RLS + API
- **Storage:** `tickets/{tenantId}/{ticketId}/{messageId}/{attachmentId}` key scope enforced
- **Notifications:** per-tenant outbox relay; dedupe by `(tenantId, userId, domainEventId)`
- **No secrets** in certification diff

---

## Rollback

See [`L1-ROLLBACK-PLAN.md`](./L1-ROLLBACK-PLAN.md).

1. Disable `workspaceTicketing` in workspace manifest  
2. Hide nav routes (`/tickets`, `/me/tickets`, `/reports/ticketing`, `/settings/ticketing`)  
3. Revert deploy to prior SHA  
4. DB: ticketing tables remain; no destructive rollback migration in v1

---

## Remote parity

```
git rev-parse HEAD
git rev-parse origin/feature/ticketing-system
```

Both SHAs must match after `git push origin feature/ticketing-system`.

---

## Architect documentation status

**Updated.** Link: [`docs/standards/ticketing-system.mdoc`](../standards/ticketing-system.mdoc) — Phase L1 section; [`L1-RELEASE-CHECKLIST.md`](./L1-RELEASE-CHECKLIST.md); [`L1-ROLLBACK-PLAN.md`](./L1-ROLLBACK-PLAN.md).
