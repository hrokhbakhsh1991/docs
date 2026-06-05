# Phase 1 Aggressive Audit — Fix List

**Source:** [`apps/api/docs/phase1-aggressive-audit.md`](../apps/api/docs/phase1-aggressive-audit.md)  
**Generated:** 2026-06-05  
**Closure sign-off:** 2026-06-05 — **DEC-041**  
**Scope:** Death-Match tenant isolation, DI/singletons, ALS stress, Prisma/RLS, raw-SQL backdoors, cache, PII+log co-location, bulk ops.

---

## خلاصه اجرایی (فارسی) — پس از بستن فاز ۱

| مورد                                           | مقدار                                                   |
| ---------------------------------------------- | ------------------------------------------------------- |
| **حکم نهایی**                                  | **PASS** — امتیاز اجرا **94/100** (Tier A−)             |
| **حکم طراحی (baseline)**                       | 84/100 (Tier B+) — مرجع pre-remediation                 |
| **نشت HTTP تأییدشده (خواندن tour بین tenant)** | **0**                                                   |
| **Must-Fix باز**                               | **0** (۷/۷ بسته)                                        |
| **LOG-COL CRITICAL باز**                       | **0** (۴/۴ بسته)                                        |
| **Regression gate رسمی**                       | **PASS** — `pnpm run phase-1:regression-gate` (۸ مرحله) |
| **تهدید DM-CT**                                | ۵ mitigated + ۱ waived                                  |

**جمع‌بندی:** فاز ۱ aggressive audit برای `apps/api` **بسته شد**. ادامه کار در Phase 2 observability (TRACE، LOG P2) و Postgres-tier regression اختیاری.

---

## چک‌لیست بستن (گام‌های ۱–۵)

| گام | موضوع                     | وضعیت      |
| --- | ------------------------- | ---------- |
| ۱   | LOG P0 — LOG-COL-01/02/04 | ✅ DEC-037 |
| ۲   | LOG P1 — LOG-COL-06/07    | ✅ DEC-038 |
| ۳   | DI-REG-01 / DI-IDEM-02    | ✅ DEC-039 |
| ۴   | Regression pack رسمی      | ✅ DEC-040 |
| ۵   | Doc sign-off + CON        | ✅ DEC-041 |
| ۶   | P2 zero-debt (اختیاری)    | ✅ DEC-042 |

---

## تناقضات — وضعیت پس از sign-off

| ID         | وضعیت                                                   |
| ---------- | ------------------------------------------------------- |
| **CON-01** | ✅ بسته — تفکیک ALS leak / HTTP read / DI-RAW-01 closed |
| **CON-02** | ✅ بسته — ALS verified + Must-Fix done                  |
| **CON-03** | ✅ بسته — schema ≠ app probe                            |
| **CON-04** | ✅ بسته — alias در DM-CT register                       |
| **CON-05** | ✅ بسته — waived vs HIGH هم‌راستا                       |
| **CON-06** | ✅ acknowledged — دامنه‌های متفاوت                      |
| **CON-07** | ✅ بسته — LOG-COL + LOG-V یک PR                         |

---

## Must-Fix — همه Done

| Pri | ID(s)                     | Status        |
| --- | ------------------------- | ------------- |
| P0  | DM-CT-05 / BULK-UNSAFE-01 | ✅            |
| P0  | DM-CT-04                  | ✅ DEC-029    |
| P0  | DM-CT-01 / DI-MEM-01      | ✅ DEC-GAP-03 |
| P0  | DM-CT-02 / DI-PRISMA-01   | ✅ DEC-GAP-03 |
| P1  | DM-CT-03 / DI-RAW-01      | ✅ DEC-031    |
| P1  | BULK-UNSAFE-04            | ✅ DEC-032    |
| P1  | DI-MANUAL-01              | ✅ DEC-033    |

---

## Regression pack (رسمی — DEC-040)

```bash
cd apps/api
pnpm run phase-1:regression-gate
```

خروجی: `test/reliability/phase-1-regression-gate.last-run.json` — **PASS** 2026-06-05 (۸ مرحله؛ Postgres tier skipped).

---

## شمارش نهایی (پس از closure)

| دسته                 | قبل | بعد                |
| -------------------- | --- | ------------------ |
| Must-Fix باز         | 7   | **0**              |
| LOG-COL CRITICAL باز | 4   | **0**              |
| DI CRITICAL باز      | 1   | **0**              |
| BULK UNSAFE باز      | 4   | **0** (+ 1 waived) |
| CON باز              | 7   | **0**              |
| Execution score      | 84  | **94**             |

---

## P2 / اختیاری — گام ۶ (DEC-042)

| مورد                              | وضعیت                     |
| --------------------------------- | ------------------------- |
| LOG-COL-08 path normalizer        | ✅                        |
| LOG-COL-09 outbox error_code      | ✅                        |
| LOG-COL-12 chaos stderr           | ✅                        |
| #10 memory mixed-tenant HTTP spec | ✅                        |
| LOG-COL-10 product/docs           | deferred                  |
| Postgres tier regression          | optional                  |
| DI-LGC-01 dual-write mirror       | deferred (dual-write off) |
| IDX-ADV                           | deferred                  |

---

## پیوند به auditهای دیگر

| موضوع                 | سند                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------- |
| Observability / trace | [`phase2-paranoid-audit-fix-list.md`](phase2-paranoid-audit-fix-list.md)                    |
| Scalability           | [`phase3-scalability-stress-audit.md`](../apps/api/docs/phase3-scalability-stress-audit.md) |
| Resilience            | [`phase4-resilience-audit.md`](../apps/api/docs/phase4-resilience-audit.md)                 |
| Phase 0 RLS           | [`phase0-audit-report.md`](../apps/api/docs/phase0-audit-report.md)                         |
| DEC-041 sign-off      | [`IMPLEMENTATION-DECISIONS.md`](../docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md)     |

---

_این فایل استخراج/پیگیری است. سند مرجع: `phase1-aggressive-audit.md`._
