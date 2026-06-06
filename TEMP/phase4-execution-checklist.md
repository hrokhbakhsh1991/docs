# Phase 4 — چک‌لیست اجرایی (Operational)

```yaml
created: "2026-06-06"
source: TEMP/phase4-resilience-audit-fix-list.md
truth_ledgers:
  - docs/phase-4/audits/IMPLEMENTATION-TRUTH.md
  - apps/api/test/reliability/phase-4-resilience-regression-gate.last-run.json
  - reports/phase-6-entry-verified.yaml
current_verdict: Zero-Debt Verified (modular 7/7)
target_verdict: ENTERPRISE_PASS
target_resilience_score: "≥95"
modular_phase4_target: "7/7 VERIFIED + phase-4:gate ok:true"
```

> **نحوه استفاده:** هر ردیف را فقط وقتی `[x]` بزنید که **prove_with** exit 0 داده و ledger به‌روز شده باشد.  
> **ترتیب:** Tier 0 → Tier 1 → Tier 2 → (Tier 3 اختیاری برای ۹.۵+) → Tier 4 برای ورود فاز ۶.

---

## Tier 0 — Bootstrap (همیشه اول)

| # | کار | وضعیت | دستور / معیار |
|---|-----|--------|----------------|
| 0.1 | Node 24 | `[x]` | `nvm use && node -v` → `>=24 <25` |
| 0.2 | Postgres بالا | `[x]` | `docker compose -f docs/phase-4/dev/docker-compose.yml up -d` |
| 0.3 | Env استاندارد | `[x]` | زیر را export کنید |
| 0.4 | Migrate + RLS | `[x]` | `DATABASE_URL=$DATABASE_URL_ADMIN pnpm --filter @apps/api run db:migrate:deploy` |

```bash
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32'
export DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db'
export STORAGE_DRIVER=prisma NODE_ENV=test
```

**DoD Tier 0:** `pnpm run phase-4:guard` → `p4_rls_integration_tests: ok` (نه «DATABASE_URL unset»).

---

## Tier 1 — Gateهای P0 (رد فوری اگر قرمز)

### 1A — Resilience regression (موج A–D · DEC-071…093)

| # | کار | وضعیت | شواهد |
|---|-----|--------|--------|
| 1A.1 | Postgres اجباری در gate | `[x]` | `require-gate-database.mjs` · بدون env → exit 1 |
| 1A.2 | اجرای gate با Postgres | `[ ]` | `cd apps/api && pnpm run phase-4:resilience-regression-gate` |
| 1A.3 | Artifact سبز | `[x]`* | `databaseUrlSet: true` · `postgresRequired: true` · `verdict: PASS` |

\* last-run موجود است؛ **بعد از هر تغییر trunk دوباره اجرا کنید.**

```bash
cd apps/api
pnpm run phase-4:resilience-regression-gate
# MUST: test/reliability/phase-4-resilience-regression-gate.last-run.json
#   verdict: PASS, databaseUrlSet: true, resilienceScoreAfter ≥ 88
```

**DoD 1A:** `verdict: PASS` · `mustFixP0OpenAfter: 0` · همه steps در last-run `PASS`.

---

### 1B — Modular `phase-4:gate`

| # | کار | وضعیت | دستور |
|---|-----|--------|--------|
| 1B.1 | Guard کامل | `[x]` | `pnpm run phase-4:guard` |
| 1B.2 | Gate کامل | `[x]` | `pnpm run phase-4:gate` |
| 1B.3 | Report | `[x]` | `reports/phase-4-gate-2026-06-06.json` → `"ok": true` (10/10) |

```bash
pnpm run phase-4:gate
# read reports/phase-4-gate-$(date +%Y-%m-%d).json
```

**DoD 1B:** `ok: true` با env Tier 0 — **بدون** `p4_rls_integration_tests: false`.

---

### 1C — Phase 5 gate (پیش‌نیاز ورود فاز ۶ · 6.0)

| # | کار | وضعیت | blocker |
|---|-----|--------|---------|
| 1C.1 | `phase-5:guard` | `[ ]` | `p5_repo_alignment` — `main.ts` vs `lazy-tours-service.ts` |
| 1C.2 | `phase-5:gate` | `[ ]` | `reports/phase-6-entry-verified.yaml` → `phase_5_gate: PENDING` |
| 1C.3 | Sync yaml ورود ۶ | `[ ]` | `verified_at` + `phase_5_behavioral_minimum: PASS` |

```bash
pnpm run phase-5:guard    # fix p5_repo_alignment first if FAIL
pnpm run phase-5:gate
# edit reports/phase-6-entry-verified.yaml
```

**DoD 1C:** `phase-5:gate` exit 0 · yaml فاز ۶ به‌روز · **آن‌گاه** مجاز به شروع 6.1.

---

## Tier 2 — Modular Phase 4 → VERIFIED (موج E · DEC-094…098)

**وضعیت فعلی:** **7/7 VERIFIED** (4.0–4.6) · **هدف:** ✅

| Sub | کار | وضعیت | prove_with (خلاصه) | ledger |
|-----|-----|--------|---------------------|--------|
| **4.0** | Gate-of-gates + red-flag | `[x]` | R0–R3 re-run 2026-06-06 · signoff true | **VERIFIED** |
| **4.1** | tenant-kernel | `[x]` | `pnpm --filter @app-tour/tenant-kernel run build test test:phase-4` | **VERIFIED** |
| **4.2** | Postgres RLS | `[x]` | `rls-isolation.integration.spec.ts` + gate RLS | **VERIFIED** |
| **4.3** | Provisioning | `[x]` | `4.3-provisioning.spec.ts` + seed themes Postgres | **VERIFIED** |
| **4.4** | Tenant theme | `[x]` | `tenant-config.spec.ts` + `pnpm --filter @apps/web run test:e2e:th-1` | **VERIFIED** |
| **4.5** | platform-events | `[x]` | platform-events test + `tour-created-http.spec.ts` | **VERIFIED** |
| **4.6** | Phase gate | `[x]` | `pnpm run phase-4:gate` + `guard:doc-sync` | **VERIFIED** |

### ترتیب پیشنهادی اجرا

```text
4.1 → 4.0 (signoff) → 4.4 → 4.5 → 4.6
(4.2 و 4.3 انجام شده — فقط regression بعد از تغییر)
```

### بعد از هر subphase

```yaml
- [ ] prove_with از docs/phase-4/subphases/{id}.md exit 0
- [ ] docs/phase-4/audits/IMPLEMENTATION-TRUTH.md → row VERIFIED
- [ ] pnpm run phase-4:guard (sanity)
```

**DoD Tier 2:** IMPLEMENTATION-TRUTH **7/7 VERIFIED** · `phase-4:gate ok:true` · row 4.6 VERIFIED.

---

## Tier 3 — Residual ۹.۵+ (موج F · اختیاری قبل از فاز ۶)

> **توجه:** فاز ۶ را **block نمی‌کند** اگر Tier 1C سبز باشد؛ برای `ENTERPRISE_PASS` و resilience ≥95 لازم است.

| # | کار | وضعیت | DEC / ref | قبولی |
|---|-----|--------|-----------|--------|
| 3.1 | Validation engine degrade | `[ ]` | HF-RE-01…16 | throw/timeout → retry `basic` → **503** `VALIDATION_ENGINE_UNAVAILABLE` (نه 500) |
| 3.2 | Metric degrade | `[ ]` | — | `validation_engine_degrade_total` |
| 3.3 | Slow-sink nightly CI | `[x]` | DEC-070 | `.github/workflows/api-nightly.yml` slow-sink step |
| 3.4 | Event-backlog 1000-row nightly | `[ ]` | DEC-100 | اضافه به `api-nightly.yml`: `APPS_API_TEST_TIER=nightly` + `event-backlog-recovery.spec.ts` |
| 3.5 | Resilience score ≥95 | `[ ]` | — | الان ~88؛ بعد از 3.1+3.4 re-run gate + audit update |

```bash
# backlog probe (local nightly tier)
cd apps/api
APPS_API_TEST_TIER=nightly NODE_ENV=test \
  node --import tsx --test test/4-integration/event-backlog-recovery.spec.ts
```

**DoD Tier 3:** `resilienceScoreAfter ≥ 95` · HF-RE gaps بسته در `phase4-resilience-audit.md` · nightly workflow شامل backlog.

---

## Tier 4 — Documentation + Forensic closure

| # | کار | وضعیت | فایل |
|---|-----|--------|------|
| 4.1 | Gap register | `[ ]` | `docs/phase-4/audits/PHASE-4-GAP-REGISTER.md` — repo_verify green |
| 4.2 | Forensic audit | `[ ]` | `docs/audits/phase-4-zero-debt-forensic-audit.mdoc` → Zero-Debt Verified |
| 4.3 | Doc sync guard | `[ ]` | `pnpm run guard:doc-sync` (اگر در chain CI) |
| 4.4 | TEMP metadata | `[ ]` | `phase4-resilience-audit-fix-list.md` §۱۳ → `ENTERPRISE_PASS` |

**DoD Tier 4:** forensic `verdict` + gitSha + gateReport path ثبت شده.

---

## Tier 5 — Process / Trunk (GAP-95-A07)

| # | کار | وضعیت |
|---|-----|--------|
| 5.1 | PR یکپارچه Phase 3/4/5 evolution | `[ ]` |
| 5.2 | Gate روی merge commit / CI green | `[ ]` |
| 5.3 | `gitSha` در gate artifacts با HEAD هم‌خوان | `[ ]` |

---

## Deferred — عمداً خارج از Phase 4 (blocker نیست)

| Item | دلیل | فاز |
|------|------|-----|
| DEC-091 `migrateCanonical` runtime | expand–contract | **Phase 6** (6.8) |
| HF-RE partial 500 paths | Tier 3 | قبل از 9.5+ |
| OpenTelemetry P1-14 | enterprise sprint | Phase 7+ |
| Bulk import P1-19 | product | Phase 6+ |

---

## Master verification (یک بار در پایان)

```bash
# Tier 0 env (see above)

# Tier 1 — gates
cd apps/api && pnpm run phase-4:resilience-regression-gate
cd ../.. && pnpm run phase-4:gate
pnpm run phase-5:gate

# Tier 2 — modular sanity
pnpm run phase-4:guard
# IMPLEMENTATION-TRUTH: count VERIFIED rows == 7

# Tier 4 — phase 6 entry yaml
pnpm run phase-6:guard   # doc pack (already PASS)
# reports/phase-6-entry-verified.yaml → phase_5_gate.status: PASS
```

### Definition of Done (کل نقشه TEMP)

```yaml
enterprise_pass:
  resilience_regression: verdict PASS + databaseUrlSet true
  modular_phase4: 7/7 VERIFIED
  phase_4_gate: ok true
  phase_5_gate: ok true
  phase_6_entry_yaml: verified_at set
  forensic: Zero-Debt Verified
  residual_allowed:
    - migrateCanonical runtime (Phase 6)
optional_95_plus:
  - HF-RE degrade complete
  - event-backlog in api-nightly
  - resilienceScoreAfter >= 95
```

---

## نقشه سریع: «الان کجاییم؟»

| لایه | انجام شده | باز |
|------|-----------|-----|
| موج A–D (DEC-071…093) | ✅ ~95% | A07 trunk |
| Modular 4.x | 2/7 | 4.0, 4.1, 4.4, 4.5, 4.6 |
| موج F (9.5+ strict) | ~33% | HF-RE, backlog nightly |
| ورود فاز ۶ (6.0) | doc PASS | `phase-5:gate` + yaml |

**حداقل برای شروع فاز ۶ (6.1):** Tier 0 + **Tier 1C** + yaml 6.0 — **نه** لزوماً Tier 2 کامل.  
**حداقل برای «Phase 4 Closed»:** Tier 0 + Tier 1B + **Tier 2** + Tier 4.

---

_مرجع: [`TEMP/phase4-resilience-audit-fix-list.md`](phase4-resilience-audit-fix-list.md) · [`docs/phase-4/audits/CLOSURE-CHECKLIST.md`](../docs/phase-4/audits/CLOSURE-CHECKLIST.md)_
