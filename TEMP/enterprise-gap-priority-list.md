# لیست موقت — شکاف‌ها و اصلاحات Enterprise (اولویت‌بندی فازبندی)

> **وضعیت sprint:** **بسته** — 2026-06-05  
> **دامنه:** فاز ۴–۵ (+ ورود فاز ۶). موارد **بعد از فاز ۶ اصلی** معوق — پیاده‌سازی نشده عمداً.  
> **منبع رسمی پس از بستن:** [`docs/phase-5/audits/ENTERPRISE-GAP-REGISTER.md`](../docs/phase-5/audits/ENTERPRISE-GAP-REGISTER.md) · DECها در [`docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md`](../docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md)

---

## TO DO — نهایی

| #   | وضعیت | آیتم                                | یادداشت                                                                                                    |
| --- | ----- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | ✅    | P1-8 JWT-only prod + dev bearer TTL | DEC-023                                                                                                    |
| 2   | ✅    | P2-7 GAP-P5-01 composite            | IMPLEMENTATION-TRUTH                                                                                       |
| 3   | ✅    | P1-21 GAP-P5-03 honesty             | contract scaffold + behavioral specs                                                                       |
| 4   | ✅    | P2-5 connection budget              | design-only — [`connection-budget.md`](../docs/phase-5/appendices/connection-budget.md)؛ کد → بعد از فاز ۶ |
| 5   | ⏭️    | P1-14 OpenTelemetry                 | **معوق** — خارج از فاز ۶ اصلی                                                                              |
| 6   | ⏭️    | P1-19 Bulk import API               | **معوق** — خارج از فاز ۶ اصلی                                                                              |

**جمع:** P0/P1/P2 در دامنه sprint = **تمام**؛ ۲ آیتم معوق برای Phase 6+ entry / فازهای بعد.

---

## راهنمای اولویت

| اولویت | معنی                                        | معیار شروع                            |
| ------ | ------------------------------------------- | ------------------------------------- |
| **P0** | مسدودکننده production / امنیت / قرارداد API | قبل از multi-tenant واقعی             |
| **P1** | مقیاس، عملیات، gate فاز بعدی                | قبل از Phase 6 entry یا multi-replica |
| **P2** | بلوغ سازمانی، CI، مستندات عملیاتی           | پس از P0/P1 یا موازی با waiver        |

| وضعیت                                   | نماد |
| --------------------------------------- | ---- |
| انجام‌شده در چت/ریپو                    | ✅   |
| تست عمداً قرمز / GAP ثبت‌شده            | 🔴   |
| design / waiver (بدون کد در این sprint) | ✅   |
| معوق — بعد از فاز ۶ اصلی                | ⏭️   |

---

## P0 — فوری (به ترتیب اجرا پیشنهادی)

### فاز ۵ — API / Canonical / Outbox

| #    | وضعیت | موضوع                                | جزئیات                                                            | تست / DEC                                        | فاز هدف   |
| ---- | ----- | ------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------ | --------- |
| P0-1 | ✅    | **HTTP Idempotency**                 | `http_idempotency_records` + replay؛ burst → 1 تور                | `idempotency-bypass`, `http-idempotency.md`      | 5.4       |
| P0-2 | ✅    | **قرارداد خطا + correlation**        | interceptor، trace ingress، ValidationFailure enrich              | `error-enrichment` 5/5, trace-request-context.md | 5 / OBS   |
| P0-3 | ✅    | **Workspace / Auth mapping**         | `WORKSPACE_INVALID` + `AUTH_SCOPE_ID_INVALID` → 401               | `tenant-error-recovery` 11/11                    | 4.3 / 5   |
| P0-4 | ✅    | **tenant-config پویا**               | `resolveRegisteredTenant*` از Postgres                            | `dynamic-config-sync` 2/2                        | 4.4 → 5   |
| P0-5 | ✅    | **Graceful shutdown در `main.ts`**   | `installGracefulShutdownHandlers` + `server/graceful-shutdown.ts` | `graceful-shutdown` 2/2                          | 5.4 / ops |
| P0-6 | ✅    | **Outbox relay throughput**          | parallel publish (DEC-017) ~400+ evt/s؛ CI budget 100؛ strict 500 | `outbox-throughput`                              | 5.4       |
| P0-7 | ✅    | **عدالت CPU — validation scheduler** | DEC-016 scheduler + engine cache                                  | `noisy-neighbor-latency` pass                    | 5.2       |
| P0-8 | ✅    | **عدالت DB — read/write rate tiers** | GET `read` bucket + POST `write`                                  | `noise-neighbor` (nightly HTTP)                  | 4 / 5     |

### فاز ۴ — Tenant kernel / RLS

| #     | وضعیت | موضوع                            | جزئیات                                                         | تست                                   | فاز         |
| ----- | ----- | -------------------------------- | -------------------------------------------------------------- | ------------------------------------- | ----------- |
| P0-9  | ✅    | RLS predicate / ALS leak         | پوشش تست قوی                                                   | `rls-predicate-logic`, `0-security/*` | 4           |
| P0-10 | ✅    | Pool saturation → 503            | DEC-012                                                        | `db-pool-saturation`                  | 4 / 5       |
| P0-11 | ✅    | **Per-tenant rate limit (HTTP)** | 50 req/s default؛ `rateLimitRps` در theme؛ 429 + `Retry-After` | `tenant-rate-limiter`                 | 5 (DEC-015) |

### فاز ۵ — Events / Audit

| #     | وضعیت | موضوع                            | جزئیات                           | تست                         | فاز |
| ----- | ----- | -------------------------------- | -------------------------------- | --------------------------- | --- |
| P0-12 | ✅    | TourCreated envelope guard       | قبل از processed log             | `domain-event-consistency`  | 5.4 |
| P0-13 | ✅    | Custom bus subscriber بدون guard | doc: idempotent + envelope guard | 5.4-transactional-outbox.md | 5.4 |
| P0-14 | ✅    | Atomic persist + audit + outbox  | ghost state محدود به mem driver  | `service-partial-state`     | 5.4 |

---

## P1 — مقیاس و gate فاز بعدی

### فاز ۵

| #    | وضعیت | موضوع                               | جزئیات                                   | تست / سند                    | فاز                           |
| ---- | ----- | ----------------------------------- | ---------------------------------------- | ---------------------------- | ----------------------------- |
| P1-1 | ✅    | **Redis rate limiter**              | `RedisRateLimiterStore` when `REDIS_URL` | `redis-rate-limiter.spec.ts` | 5 (multi-replica ops → فاز ۷) |
| P1-2 | ✅    | **rate-limiting.md**                | token bucket، env، Redis path            | rate-limiting.md             | 5                             |
| P1-3 | ✅    | **Reconciliation saga**             | `projection-reconciliation.ts`           | `saga-rollback`, DEC-008     | 5.3 / 5.4                     |
| P1-4 | ✅    | **Parallel outbox publish**         | DEC-017                                  | `outbox-throughput`          | 5.4                           |
| P1-5 | ✅    | **Warm PlatformWizardEngine**       | DEC-016                                  | `validation-fairness.md`     | 5.2                           |
| P1-6 | ✅    | **PATCH tour + optimistic locking** | `row_version`                            | `concurrent-tour-logic`      | 5 / 6 entry                   |
| P1-7 | ✅    | **SCHEMA_VERSION_MISMATCH**         | DEC-019                                  | `schema-version-compat`      | 6 entry                       |
| P1-8 | ✅    | **JWT-only prod + bearer TTL**      | DEC-023                                  | `clock-skew-resilience`      | 4 / 5                         |

### platform-core (فاز ۱)

| #     | وضعیت | موضوع                             | جزئیات          | تست                    | فاز |
| ----- | ----- | --------------------------------- | --------------- | ---------------------- | --- |
| P1-9  | ✅    | **RuleEngine cache — سقف tenant** | DEC-018 LRU 128 | `rule-cache-eviction`  | 1   |
| P1-10 | ✅    | جداسازی tenant در rule cache      | poison test     | `rule-cache-poisoning` | 1   |

### Observability

| #     | وضعیت | موضوع                     | جزئیات                | تست               | فاز                   |
| ----- | ----- | ------------------------- | --------------------- | ----------------- | --------------------- |
| P1-11 | ✅    | Trace ALS + GUC           | trace-request-context | `trace-isolation` | 5                     |
| P1-12 | ✅    | Tenant metrics            | metrics.ts            | `tenant-metrics`  | 5                     |
| P1-13 | ✅    | Log privacy / audit smoke |                       | `log-privacy`     | 5                     |
| P1-14 | ⏭️    | **OpenTelemetry spans**   | GUC کافی برای فاز ۵–۶ | —                 | **بعد از فاز ۶ اصلی** |

### Integration

| #     | وضعیت | موضوع                    | جزئیات       | تست                        | فاز                   |
| ----- | ----- | ------------------------ | ------------ | -------------------------- | --------------------- |
| P1-15 | ✅    | Proxy tenant isolation   |              | `proxy-tenant-isolation`   | 5                     |
| P1-16 | ✅    | Feature flag degradation | DEC-014      | `feature-flag-degradation` | 5                     |
| P1-17 | ✅    | Event backlog recovery   | nightly tier | `event-backlog-recovery`   | 5.4                   |
| P1-18 | ✅    | Full stack smoke         |              | `full-service-stack`       | 5                     |
| P1-19 | ⏭️    | **Bulk import API**      | —            | `bulk-import-consistency`  | **بعد از فاز ۶ اصلی** |

### Gate / Doc

| #     | وضعیت | موضوع            | جزئیات              | سند                           |
| ----- | ----- | ---------------- | ------------------- | ----------------------------- |
| P1-20 | ✅    | **phase-5:gate** | trunk tier + waiver | HARDENED-GATE-REPORT, DEC-022 |
| P1-21 | ✅    | GAP-P5-03        | behavioral specs    | IMPLEMENTATION-TRUTH          |

---

## P2 — بلوغ Enterprise و CI

| #    | وضعیت | موضوع                   | جزئیات                | اقدام                    |
| ---- | ----- | ----------------------- | --------------------- | ------------------------ |
| P2-1 | ✅    | CI tiering              | DEC-022               | `test-tier.ts`           |
| P2-2 | ✅    | noise-neighbor nightly  | HTTP probe            | `noise-neighbor.spec.ts` |
| P2-3 | ✅    | RUN_SOAK nightly        |                       | `test:nightly:soak`      |
| P2-4 | ✅    | ENTERPRISE-GAP-REGISTER |                       | `docs/phase-5/audits/`   |
| P2-5 | ✅    | Connection budget       | design-only (کد معوق) | `connection-budget.md`   |
| P2-6 | ✅    | test-inventory CI tiers |                       | test-inventory.md        |
| P2-7 | ✅    | GAP-P5-01 composite     |                       | IMPLEMENTATION-TRUTH     |

---

## معوق — خارج از دامنه این sprint (فاز ۶+ / بعد)

| ID        | موضوع                   | دلیل معوق                                              | پیگیری                        |
| --------- | ----------------------- | ------------------------------------------------------ | ----------------------------- |
| P1-14     | OpenTelemetry spans     | فاز ۶ اصلی = workspace/Denali؛ trace فعلی ALS+GUC کافی | Phase 6 observability backlog |
| P1-19     | Bulk import API         | API انبوه = محصول Phase 6+                             | Phase 6 workspace port        |
| P2-5 (کد) | Per-tenant DB semaphore | design در `connection-budget.md`                       | Phase 7 multi-replica         |

---

## نقشه فاز (خلاصه — بسته)

```
P0 + P1 (فاز ۴–۵)     → ✅
P2 (CI / doc)         → ✅
فاز ۶ entry (P1-6/7)  → ✅ در کد/تست
معوق (OTel, bulk,     → ⏭️
  connection budget code)
```

---

## دستورات تأیید سریع

```bash
# Trunk (PR / phase-5:gate)
pnpm --filter @apps/api test

# Nightly probes
pnpm run test:nightly

# Auth P1-8
pnpm --filter @apps/api test -- src/tenant-kernel/auth-env.spec.ts src/tenant-kernel/tenant-kernel.spec.ts
```

---

## یادداشت بستن

- این فایل **آرشیو sprint** است؛ برای gapهای جدید از [`ENTERPRISE-GAP-REGISTER.md`](../docs/phase-5/audits/ENTERPRISE-GAP-REGISTER.md) استفاده کنید.
- `TEMP/` معمولاً commit نمی‌شود؛ محتوای بسته‌شده در `docs/phase-5/audits/` منعکس شده است.
