# Phase 9 — چک‌لیست بستن behavioral (Operator Admin)

```yaml
created: "2026-06-09"
updated: "2026-06-09"
product_mode: PRODUCTION_SHIP
source_of_truth: docs/phase-9/audits/IMPLEMENTATION-TRUTH.md (v35)
smoke_local: "operator-smoke.spec.ts 13/13"
gate_status: "9.8 ABSENT — phase-9:gate فقط با YES صریح Architect"
hooks: "PHASE-9-HOOKS-SUSPENSION active تا 9.8"
```

> **خلاصه:** doc pack سبز (`phase-9:guard` 32/32) · behavioral جزئی روی 9.1–9.7 · **هیچ subphase به VERIFIED_BEHAVIORAL نرسیده (0/9)** · DoD ≠ doc guard تنها.

---

## دستور اجرای بک‌اند و فرانت (توسعه محلی)

### پیش‌نیاز (یک‌بار)

```bash
cd /home/hamed/Music/docs
nvm use && corepack enable
pnpm install
```

### حالت A — توصیه‌شده برای Phase 9 (memory · operator tenant)

**ترمینال ۱ — API (پورت 3001):**

```bash
cd /home/hamed/Music/docs
nvm use
export PORT=3001
export STORAGE_DRIVER=memory
export AUTH_ALLOW_DEV_STATIC_OTP=true
export OPERATOR_SMOKE_E2E_SEED=1
export P5_VALIDATION_WORKERS_ENABLED=false
export TENANT_RATE_LIMIT_ENABLED=false
unset DATABASE_URL DATABASE_URL_ADMIN OPERATOR_SMOKE_WORKSPACE_TYPE
pnpm --filter @apps/api run dev
```

**ترمینال ۲ — Web (پورت 3000):**

```bash
cd /home/hamed/Music/docs
nvm use
export PORT=3000
export NODE_ENV=development
export ALLOW_DEV_WEB_SESSION=true
export ALLOW_DENALI_WEB_PLUGIN=true
export TOUR_OPS_DEV_TENANT_ID=00000000-0000-4000-8000-000000000014
export TOUR_OPS_API_URL=http://127.0.0.1:3001
export API_INTERNAL_URL=http://127.0.0.1:3001
pnpm --filter @apps/web run dev
```

**ورود:** [http://127.0.0.1:3000/auth/login](http://127.0.0.1:3000/auth/login) — OTP dev static (با `AUTH_ALLOW_DEV_STATIC_OTP=true`).

**سلامت API:** `curl -s http://127.0.0.1:3001/health`

### حالت B — هر دو با یک اسکریپت (همان env smoke)

```bash
cd /home/hamed/Music/docs
nvm use
node apps/web/scripts/smoke-operator-e2e-servers.mjs
```

API + Web را با env صحیح بالا می‌آورد و foreground نگه می‌دارد (برای Playwright / dev دستی).

### حالت C — Postgres persistence (وقتی migrationها اعمال شده)

```bash
# API
export STORAGE_DRIVER=prisma
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/app_tour'
export DATABASE_URL_ADMIN="$DATABASE_URL"
export PORT=3001
pnpm --filter @apps/api run dev

# Web — همان env ترمینال ۲ حالت A
```

---

## انجام‌شده (زمینه)

- [x] **9.0** Entry — `VERIFIED_ENTRY`
- [x] اسکلت + spec روی trunk (T-9.1..T-9.8)
- [x] Operator smoke E2E — SMK-P9-01..12 → **13/13** local
- [x] W-track wizard — **W1–W9** (empty gate · publish · picker · Layer C · starter manifest · render overlay)
- [x] Identity / bookings / settings — in-memory + بخشی Postgres
- [x] Command center · users · finance tabs · dashboard widgets

---

## 9.1 — Identity & Session `PARTIAL_R1`

- [ ] Prisma **005** — identity production روی Postgres
- [ ] JWT RS256 از env در boot API (ثابت، نه فقط smoke script)
- [ ] OTP production (خارج از `AUTH_ALLOW_DEV_STATIC_OTP`)
- [ ] attestation **VERIFIED_BEHAVIORAL** در truth ledger

**Spec:** [`docs/phase-9/subphases/9.1-identity-session.md`](docs/phase-9/subphases/9.1-identity-session.md)

---

## 9.2 — Admin Shell `PARTIAL_R3`

- [ ] بستن 9.2 — closure spec + UX parity shell
- [ ] migrate کامل `app/finance` → `(app)/finance` (DEC-P9-017)
- [ ] polish nav · branding · account menu
- [ ] dashboard widgets باقی‌مانده طبق ADMIN-SHELL-UX

**Spec:** [`docs/phase-9/subphases/9.2-admin-shell.md`](docs/phase-9/subphases/9.2-admin-shell.md)

---

## 9.3 — Tours Operator `PARTIAL_R5`

- [ ] Transport roster — داده واقعی (نه placeholder)
- [ ] جداول transport طبق TOURS-WORKSPACE-UX
- [ ] **Denali full-create** — POST `/tours` روی memory/denali (فعلاً 500 · worker `tourList` ممنوع)
- [ ] حذف starter **title bridge** در smoke وقتی denali validation سبز شد
- [ ] `resolveDenaliRuleSetFromTemplate` — overlay واقعی (فعلاً stub)
- [ ] بستن 9.3

**Spec:** [`docs/phase-9/subphases/9.3-tours-operator.md`](docs/phase-9/subphases/9.3-tours-operator.md)

---

## 9.4 — Users & RBAC `PARTIAL_R6`

- [ ] Prisma **005** — `UserTenant.role` 3-tier در DB
- [ ] SDK CASL — operator extensions کامل (`workspace-sdk` PARTIAL)
- [ ] users CSV export
- [ ] remove member · rewards (DEC-P9-008)
- [ ] member role surfaces
- [ ] بستن 9.4

**Spec:** [`docs/phase-9/subphases/9.4-users-rbac.md`](docs/phase-9/subphases/9.4-users-rbac.md)

---

## 9.5 — Bookings Ops `PARTIAL_R5`

- [ ] Postgres persistence bookings (`STORAGE_DRIVER=prisma`)
- [ ] tour board kanban — R4 اختیاری
- [ ] departure timeline — R4 اختیاری
- [ ] polish Command Center · bulk · reject
- [ ] بستن 9.5

**Spec:** [`docs/phase-9/subphases/9.5-bookings-ops.md`](docs/phase-9/subphases/9.5-bookings-ops.md)

---

## 9.6 — Settings & Templates `PARTIAL_R8`

### Persistence

- [ ] Prisma **007** — settings reference_data + `tenant_config` روی Postgres

### W-track stretch

- [ ] **W10** — drag/reorder فیلدها و steps در Settings builder
- [ ] **W11** — `configVersion: 2` + validation سخت‌گیرانه
- [ ] حذف starter `title` bridge در API catalog
- [ ] urban `operatorSettings` — فقط اگر RULE-P9-002 عوض شود (فعلاً urban = account only)
- [ ] `guide_languages` reorder endpoint
- [ ] بستن 9.6

**Spec:** [`docs/phase-9/subphases/9.6-settings-templates.md`](docs/phase-9/subphases/9.6-settings-templates.md) · W-track: SETTINGS-MODULE-REGISTRY §3.14

---

## 9.7 — Finance Denali `PARTIAL_R4`

- [ ] Adjust API — manual ledger adjust + outbox (deferred)
- [ ] finance Postgres specs در CI با `DATABASE_URL`
- [ ] prepayments/installments hardening R2/R3 در UI
- [ ] KPI/advanced فراتر از R4 فعلی
- [ ] بستن 9.7

**Spec:** [`docs/phase-9/subphases/9.7-finance-denali.md`](docs/phase-9/subphases/9.7-finance-denali.md)

---

## 9.8 — Operator DoD Gate `ABSENT`

### Gate & contract

- [ ] `pnpm run phase-9:gate` — build + test + phase-8:gate + phase-9:guard
- [ ] `apps/web/test/phase-9.contract.spec.ts` — route inventory کامل `(app)/`
- [ ] forensic audit — `phase-9-zero-debt-forensic-audit.mdoc` امتیاز ≥ 8

### Regression

- [ ] Urban owner regression — INV-P8-007 / INV-P9-007 (admin روی urban settings = 403)
- [ ] `phase-8:gate` + `phase-8.contract.spec.ts`

### Truth & hooks

- [ ] truth ledger: 9.1–9.7 → `VERIFIED_BEHAVIORAL`
- [ ] خاموش کردن PHASE-9-HOOKS-SUSPENSION — برگرداندن Husky `pre-commit:fast`
- [ ] `test:full` / `ci:integrity` — **فقط با YES صریح Architect**

**Spec:** [`docs/phase-9/subphases/9.8-operator-dod-gate.md`](docs/phase-9/subphases/9.8-operator-dod-gate.md)

---

## Cross-cutting

| مورد | وضعیت |
|------|--------|
| `platform-core` zero-diff | باید حفظ شود (INV-P9-001) |
| WIP uncommitted روی trunk | قبل از 9.8 باید land شود |
| Smoke memory/starter bridge | تا denali create سبز نشود، SMK-P9-02 وابسته bridge است |
| Doc vs repo | ~70% navigable · DoD ≠ doc guard |

---

## اولویت پیشنهادی (بدون gate سنگین)

```text
1. Denali POST /tours (strip tourList در validation worker)  → 9.3 + smoke واقعی‌تر
2. Prisma 005 + 007 persistence                             → 9.1 / 9.4 / 9.6 production
3. Transport + finance adjust                               → 9.3 / 9.7 parity
4. W10/W11 wizard                                           → 9.6 بستن
5. phase-9.contract + phase-9:gate                          → 9.8 (YES صریح)
```

---

## تست سریع (بدون gate کامل)

```bash
# Doc pack فاز ۹
pnpm run phase-9:guard

# Operator smoke (~3.5 دقیقه)
pnpm --filter @apps/web run test:e2e:operator

# Unitهای wizard/settings
pnpm --filter @apps/web exec node --import tsx --test \
  test/wizard-template-gate.spec.ts \
  test/wizard-template-catalog.spec.ts \
  test/wizard-template-prefill.spec.ts
```

---

## ممنوعیت‌ها (از truth ledger)

- ادعای «فاز ۹ تمام» فقط با doc guard
- گسترش urban admin به `isAdminOrOwner`
- `phase-9:gate` / `test:full` بدون YES صریح
