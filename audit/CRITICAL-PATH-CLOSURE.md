# Critical Path — Closure Report (AP 5 · AP 14 · AP 15)

**تاریخ بسته‌شدن:** 2026-07-07  
**Scope:** فازهای ۱–۴ remediation roadmap  
**وضعیت:** **CLOSED** (کد + docs + guards + specs)

> فازهای ۵–۷ (defensive guards، export encapsulation، DTCG/CSS) خارج از این closure — در [`CRITICAL-PATH-REMEDIATION-PLAN.md`](CRITICAL-PATH-REMEDIATION-PLAN.md) باقی می‌مانند.

---

## خلاصه تحویل

| AP | موضوع | PR | وضعیت |
|----|--------|-----|--------|
| **5** | RLS two-step `getById` | PR-1 | Closed |
| **14** | Error leak + Prisma mapping | PR-1 hotfix + PR-4 hardening | Closed |
| **15** | Unbounded list (bookings + tours) | PR-2 + PR-3 | Closed |

---

## مستندات canonical

| Doc | محتوا |
|-----|--------|
| [`docs/dev/list-projection-guards.mdoc`](../docs/dev/list-projection-guards.mdoc) | AP15 — bookings duplicate-finders، tours chunked load، RLS two-step |
| [`docs/dev/error-handling-standard.mdoc`](../docs/dev/error-handling-standard.mdoc) | AP14 — `handleHttpError`، Prisma mapping، `guard-catch-error-leak` |
| [`docs/phase-20/p7/appendices/IMPLEMENTATION-TRUTH-P7.md`](../docs/phase-20/p7/appendices/IMPLEMENTATION-TRUTH-P7.md) | AP5 RLS truth |
| [`docs/phase-20/p7/runbooks/p7-staging-e2e.md`](../docs/phase-20/p7/runbooks/p7-staging-e2e.md) | SMK-PTL-04 staging note |

---

## Guards CI (فعال)

```bash
pnpm run guard:unbounded-list          # AP15 repository findMany
pnpm run guard:list-projection-openapi # AP15 OpenAPI list schemas
pnpm run guard:catch-error-leak        # AP14 platform route leak ban
```

هر سه در `phase-6:fast-track` wire شده‌اند.

---

## Specs (regression matrix)

| Spec | IDs |
|------|-----|
| `apps/api/test/bookings-safety.spec.ts` | BK-SAFE-01..05 |
| `apps/api/test/tour-safety.spec.ts` | TR-SAFE-01..03 |
| `apps/api/test/load-all-tour-records-via-list-page.spec.ts` | chunked pagination |
| `apps/api/test/1-functional/tours-list.spec.ts` | LIST-01..04 |
| `apps/api/test/platform-provision.spec.ts` | no engine leak on 500 |
| `apps/api/src/middleware/error-interceptor-prisma.spec.ts` | AP14-PRISMA-01..06 |

---

## Verify سریع (Architect)

```bash
pnpm run guard:unbounded-list
pnpm run guard:catch-error-leak
pnpm run guard-docs
pnpm --filter @apps/api run guard:no-console-src
cd apps/api && pnpm run test:file -- \
  test/bookings-safety.spec.ts \
  test/tour-safety.spec.ts \
  test/load-all-tour-records-via-list-page.spec.ts \
  test/1-functional/tours-list.spec.ts \
  test/platform-provision.spec.ts \
  src/middleware/error-interceptor-prisma.spec.ts
```

---

## باقی‌مانده (خارج از closure)

| Item | نوع | مسئول |
|------|-----|--------|
| SMK-PTL-04 staging smoke | دستی post-deploy | Ops |
| `pnpm run phase-5:gate` / `ci:integrity` | فقط با YES Architect | — |

**فاز ۵–۷ (2026-07-07):** defensive guards، export encapsulation، DTCG/CSS apps/web — **CLOSED**. See [`CRITICAL-PATH-REMEDIATION-PLAN.md`](CRITICAL-PATH-REMEDIATION-PLAN.md).

---

## فایل‌های کلیدی (الگوی مرجع)

| Concern | Path |
|---------|------|
| RLS detail two-step | `apps/api/src/bookings/prisma-bookings.repository.ts` → `getById` |
| Duplicate finders | `apps/api/src/bookings/booking-active-duplicate.ts` |
| Tour chunked load | `apps/api/src/db/load-all-tour-records-via-list-page.ts` |
| Prisma error mapping | `apps/api/src/middleware/error-interceptor.ts` → `mapPrismaErrorToAppError` |
| Tours keyset index | `apps/api/prisma/migrations/20260707100000_tours_tenant_created_id_keyset_index/` |

---

*Architect, documentation status: Updated. Links: `docs/dev/list-projection-guards.mdoc` · `docs/dev/error-handling-standard.mdoc`*
