# لیست موقت — نواقص و بهبودهای Phase 0 (apps/api)

> **منبع:** [`apps/api/docs/phase0-audit-report.md`](../apps/api/docs/phase0-audit-report.md) — Clean Room 2026-06-05  
> **امتیاز (فاز ۰–۵):** **95 / 100** · **حکم:** **GO** (waiverهای فاز ۶/۷ خارج از scope)  
> **آخرین sync:** 2026-06-05 — اختیاری‌ها (P1-4/5/11/17، P2-5/6/7) + rescore گزارش

---

## خلاصه وضعیت (از گزارش + کد)

| حوزه                          | وضعیت            | شناسه‌های کلیدی                              |
| ----------------------------- | ---------------- | -------------------------------------------- |
| ALS tenant/trace              | ✅ سبز           | TR-01…12، ALS-HL-01…03                       |
| RLS + GUC tx-local            | ✅ سبز           | PENTEST-5a/5b؛ PERF-2 batched GUC            |
| Auth production (JWT)         | ✅ سبز           | DEC-023، F-01/F-02، F-10/F-11/F-17           |
| خطای tenant-facing            | ✅ سبز           | E-01…08؛ E-12…14 بسته در interceptor         |
| Prisma migrate + `tours` RLS  | ✅ سبز           | DEC-024                                      |
| Ops boot (admin URL، storage) | ✅ سبز           | DEC-GAP-03، checklist                        |
| `DEV_TENANTS` در prod         | ✅ سبز           | DEC-025 / HT-01                              |
| Gate اعتبارسنجی               | ✅ سبز           | DEC-026 / HT-03                              |
| Outbox ALS                    | ✅ سبز           | DEC-027 / V-005                              |
| Workspace membership          | 🟡 Amber → فاز ۶ | V-001، F-12، W-01                            |
| `/internal/*` service auth    | 🟡 Amber → فاز ۶ | V-003، W-05                                  |
| Engine cache per workspace    | 🟡 پذیرفته       | HT-04 / W-06 — keyed `workspaceType:variant` |
| Connection budget کد          | ⏭️ فاز ۷         | W-04                                         |

---

## TO DO — ترتیب اجرا (خلاصه)

| #   | اولویت | آیتم                                        | فاز     |
| --- | ------ | ------------------------------------------- | ------- |
| 1   | ✅     | Migration RLS برای `tours`                  | 4 / 5   |
| 2   | ✅     | حذف `DEV_TENANTS` از مسیر production        | 0 → 4   |
| 3   | ✅     | `DATABASE_URL_ADMIN` جدا + checklist deploy | Ops / 4 |
| 4   | ✅     | Env: JWT، `STORAGE_DRIVER=prisma`           | 0 / 4   |
| 5   | ✅     | Gate اعتبارسنجی per-tenant (HT-03)          | 5       |
| 6   | ⏭️     | Workspace membership واقعی                  | 6       |
| 7   | ⏭️     | Auth سرویس `/internal/tenants/provision`    | 6       |
| 8   | ⏭️     | Connection budget semaphore                 | 7       |
| 9   | ✅     | FKها + partial index outbox                 | 5       |
| 10  | ✅     | تست HTTP JWT prod (F-17)                    | 0       |
| 11  | ✅     | PERF-1 registry cache + PERF-2 GUC batch    | 0 / 5   |
| 12  | ✅     | envelope خطا (E-12…14) + E-11 stable 409    | 0 / 5   |

---

## P0 — قبل از production

| #    | وضعیت | موضوع                           | شناسه                                                                              |
| ---- | ----- | ------------------------------- | ---------------------------------------------------------------------------------- |
| P0-1 | ✅    | `tours` RLS migrate             | DEC-024                                                                            |
| P0-2 | ✅    | `DEV_TENANTS` gated             | DEC-025، HT-01                                                                     |
| P0-3 | ✅    | Admin pool fail-closed          | DEC-GAP-03                                                                         |
| P0-4 | ✅    | `STORAGE_DRIVER` prisma in prod | V-009                                                                              |
| P0-5 | ✅    | JWT-only ingress                | DEC-023                                                                            |
| P0-6 | ✅    | Provisioning dev/test guard     | HT-02 — شبکه isolate → فاز ۶                                                       |
| P0-7 | ✅    | Deploy checklist                | [`production-deploy-checklist.md`](../docs/phase-4/production-deploy-checklist.md) |

---

## P1 — فاز ۰–۵ (انجام‌شده / معوق)

| #           | وضعیت | موضوع                                       | فاز                                       |
| ----------- | ----- | ------------------------------------------- | ----------------------------------------- |
| P1-1        | ⏭️    | Workspace membership DB                     | 6                                         |
| P1-2        | ✅    | Gate per-tenant Map                         | 5 — DEC-026                               |
| P1-3 / P1-7 | ✅    | ALS outbox + subscriber                     | 5.4 — DEC-027                             |
| P1-4        | ✅    | ALS ≠ RLS assert                            | DEC-028                                   |
| P1-5        | ✅    | CanonicalTourService trust                  | DEC-029                                   |
| P1-6        | ✅    | ALS isolation تحت بار                       | 0                                         |
| P1-8        | ✅    | JWT member + workspace                      | F-10                                      |
| P1-9        | ✅    | HTTP JWT prod 201                           | F-17 — `tenant-security.spec.ts`          |
| P1-10       | ✅    | JWT alias reject                            | F-11                                      |
| P1-11       | ✅    | Staging = production auth                   | `production-auth-policy.md` § Staging     |
| P1-12       | ⏭️    | `/internal` service auth                    | 6                                         |
| P1-13       | ✅    | tenant-config + `runWithHttpRequestContext` | 4/5                                       |
| P1-14…16    | ✅    | FK + partial pending index                  | `20260605190000_phase0_audit_fks_indexes` |
| P1-17       | ✅    | Engine cache per tenant                     | DEC-030                                   |
| P1-18…19    | ✅    | Rate limit / pools                          | —                                         |

---

## P2 — perf / API

| #      | وضعیت | موضوع                                                                   |
| ------ | ----- | ----------------------------------------------------------------------- | --- |
| PERF-1 | ✅    | Tenant registry 5s TTL cache                                            |
| PERF-2 | ✅    | `applyTenantRlsSessionVars` batched                                     |
| PERF-3 | ⏭️    | Connection budget code                                                  | 7   |
| P2-1…3 | ✅    | GET 404 / tenant-config / 429 envelope                                  |
| P2-4   | ✅    | `CanonicalSyncValidationError` stable 409                               |
| P2-5…7 | ✅    | Compliance checklist + `guard:rls-session-local` + JWT rotation runbook |

---

## P3 — waiver (بدون تغییر)

W-01، W-04، W-05، W-06 (engine)، W-07 (gate بسته) — بقیه در جدول بالا.

---

## DECهای ثبت‌شده در trunk

| ID         | موضوع                        |
| ---------- | ---------------------------- |
| DEC-024    | `tours` RLS migration        |
| DEC-GAP-03 | Production runtime integrity |
| DEC-025    | Static registry gate         |
| DEC-026    | Per-tenant validation gate   |
| DEC-027    | ALS on background publish    |

---

## دستورات تأیید

```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
cd apps/api && NODE_ENV=test node --import tsx --test \
  src/server/production-runtime-env.spec.ts \
  test/tenant-security.spec.ts \
  test/1-functional/validation-gate-concurrency.spec.ts
```
