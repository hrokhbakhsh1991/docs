# Phase 6 — چک‌لیست ورود (Operational · 6.0 → 6.1)

```yaml
created: "2026-06-06"
source:
  - docs/phase-6/subphases/6.0-entry-gate.md
  - reports/phase-6-entry-verified.yaml
  - TEMP/phase4-execution-checklist.md (Tier 1C)
truth_ledgers:
  - reports/phase-6-entry-verified.yaml
  - docs/phase-6/audits/IMPLEMENTATION-TRUTH.md
  - reports/phase-5-gate-YYYY-MM-DD.json
current_verdict: DOC_READY — REPO_ENTRY_BLOCKED
target_verdict: phase_6_entry.verified_at set → مجاز به 6.1
forbidden_until_6_0_pass: "شروع 6.1-denali-package در حالی که yaml هنوز PENDING"
```

> **نحوه استفاده:** Tier 0 → Tier 1 → Tier 2 → Tier 3.  
> **گام اول (برداشتن موانع):** Tier 0 + **Tier 1A** — بدون `phase-5:gate` سبز، فاز ۶ شروع نمی‌شود.  
> **تفاوت 6.0 vs 6.1:** 6.0 = ledger + gate؛ 6.1 = اولین کد محصول Denali (`packages/workspaces/denali`).

---

## «الان کجاییم؟»

| لایه                              | وضعیت                                | blocker                           |
| --------------------------------- | ------------------------------------ | --------------------------------- |
| Doc pack فاز ۶                    | ✅ PASS (`phase-6:guard` · score 96) | —                                 |
| `no_denali_core_creep`            | ✅ PASS                              | —                                 |
| `starter_plugin_verified`         | ✅ PASS                              | —                                 |
| Modular Phase 4 (7/7)             | ✅ VERIFIED                          | —                                 |
| `phase-4:guard`                   | ✅ ok:true                           | —                                 |
| **`phase-4:gate` کامل**           | ⚠️ re-verify                         | build + monorepo test chain       |
| **`phase-5:guard`**               | ✅ PASS                              | —                                 |
| **`phase-5:gate`**                | ❌ PENDING                           | build + test + phase-4:gate chain |
| **`phase-6-entry-verified.yaml`** | ❌ `verified_at: null`               | بعد از 5:gate                     |

---

## Tier 0 — Bootstrap (همیشه اول)

| #   | کار           | وضعیت | دستور / معیار                                                                    |
| --- | ------------- | ----- | -------------------------------------------------------------------------------- |
| 0.1 | Node 24       | `[ ]` | `nvm use && node -v` → `>=24 <25`                                                |
| 0.2 | Postgres بالا | `[ ]` | `docker compose -f docs/phase-4/dev/docker-compose.yml up -d`                    |
| 0.3 | Env استاندارد | `[ ]` | export زیر                                                                       |
| 0.4 | Migrate + RLS | `[ ]` | `DATABASE_URL=$DATABASE_URL_ADMIN pnpm --filter @apps/api run db:migrate:deploy` |
| 0.5 | DB test reset | `[ ]` | `pnpm run db:test-reset` (قبل از gate)                                           |

```bash
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32'
export DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db'
export STORAGE_DRIVER=prisma NODE_ENV=test
```

**DoD Tier 0:** `pnpm run phase-4:guard` → `p4_rls_integration_tests: ok` (نه DATABASE_URL unset).

---

## Tier 1 — موانع ورود فاز ۶ (P0 · باید سبز شود)

### 1A — Blocker فوری: `p5_repo_alignment`

| #    | کار                 | وضعیت | جزئیات                                                                                           |
| ---- | ------------------- | ----- | ------------------------------------------------------------------------------------------------ |
| 1A.1 | تشخیص               | `[x]` | `pnpm run phase-5:guard` → check `p5_repo_alignment`                                             |
| 1A.2 | هم‌ترازی doc ↔ repo | `[x]` | guard + docs → `lazy-tours-service.ts` (cold-start lazy boot)                                    |
| 1A.3 | doc-first fix       | `[x]` | `REPO-PROJECT-ALIGNMENT.md` · `blockers.md` · `5.0-entry-gate.md` · `phase-5-repo-alignment.mjs` |
| 1A.4 | تأیید guard         | `[x]` | `pnpm run phase-5:guard` → 11/11 PASS (2026-06-06)                                               |

```bash
pnpm run phase-5:guard
# read reports/phase-5-gate-$(date +%Y-%m-%d).json
```

**DoD 1A:** `p5_repo_alignment: ok: true` — آخرین گزارش: `main.ts must use createTourStorageRepository()` (2026-06-05).

---

### 1B — `phase-4:gate` (زنجیره phase-5:gate)

| #    | کار                       | وضعیت | دستور                                                     |
| ---- | ------------------------- | ----- | --------------------------------------------------------- |
| 1B.1 | Gate کامل (بدون tail)     | `[ ]` | `pnpm run phase-4:gate 2>&1 \| tee /tmp/phase-4-gate.log` |
| 1B.2 | Report                    | `[ ]` | `reports/phase-4-gate-YYYY-MM-DD.json` → `"ok": true`     |
| 1B.3 | Flake hunt (در صورت FAIL) | `[ ]` | POST `/tours` 500 vs 201 · rate limit · concurrent gate   |

**DoD 1B:** `phase-4:gate` exit 0 · report `ok: true`.

---

### 1C — `phase-5:gate` (پیش‌نیاز رسمی 6.0)

| #    | کار           | وضعیت | زنجیره                         |
| ---- | ------------- | ----- | ------------------------------ |
| 1C.1 | Build + test  | `[ ]` | `pnpm build && pnpm test`      |
| 1C.2 | phase-4:gate  | `[ ]` | embedded in `phase-5:gate`     |
| 1C.3 | phase-5:guard | `[ ]` | embedded                       |
| 1C.4 | Gate یکپارچه  | `[ ]` | `pnpm run phase-5:gate` exit 0 |

```bash
pnpm run phase-5:gate
```

**DoD 1C:** `reports/phase-5-gate-YYYY-MM-DD.json` → `"ok": true`.

---

## Tier 2 — بستن 6.0 Entry Gate (ledger)

| #   | کار                          | وضعیت | فایل / دستور                                                          |
| --- | ---------------------------- | ----- | --------------------------------------------------------------------- |
| 2.1 | Import boundary              | `[ ]` | `pnpm run guard:import-boundary` exit 0                               |
| 2.2 | No legacy runtime import     | `[ ]` | `rg "from ['\"]legacy/" apps/api apps/web` → no matches               |
| 2.3 | Starter plugin               | `[x]` | `resolve-workspace-plugin.spec.ts` (yaml: PASS)                       |
| 2.4 | `phase_5_behavioral_minimum` | `[ ]` | از `docs/phase-5/audits/IMPLEMENTATION-TRUTH.md` — حداقل 5.2 VERIFIED |
| 2.5 | به‌روز yaml                  | `[ ]` | `reports/phase-6-entry-verified.yaml`                                 |
| 2.6 | Doc guard فاز ۶              | `[x]` | `pnpm run phase-6:guard` (doc_pack_score PASS)                        |

### فیلدهای yaml (بعد از Tier 1C)

```yaml
phase_6_entry:
  phase_5_gate:
    status: PASS # was PENDING
    report: reports/phase-5-gate-YYYY-MM-DD.json
  phase_5_behavioral_minimum:
    status: PASS # was PENDING
  outbox_behavioral:
    status: PENDING # waiver BLOCKER-P6-OUTBOX-5.4 تا 6.4 — OK for 6.0
  verified_at: "2026-06-06T..."
  verified_by: "<human or agent run id>"
```

**DoD Tier 2:** `verified_at` set · `phase_5_gate.status: PASS` · IMPLEMENTATION-TRUTH row **6.0 → VERIFIED**.

---

## Tier 3 — شروع 6.1 (بعد از 6.0 · محصول Denali)

> **ممنوع:** Tier 3 قبل از Tier 2 کامل (FORBIDDEN P6-F-002).

| #   | کار                       | وضعیت | مرجع                                                                     |
| --- | ------------------------- | ----- | ------------------------------------------------------------------------ |
| 3.1 | AGENT_START_SEQUENCE      | `[ ]` | `docs/phase-6/phase-6-agent-router.md`                                   |
| 3.2 | READ IMPLEMENTATION-TRUTH | `[ ]` | `docs/phase-6/audits/IMPLEMENTATION-TRUTH.md` (repo_behavioral_score: 0) |
| 3.3 | Subphase 6.1              | `[ ]` | `docs/phase-6/subphases/6.1-denali-package.md`                           |
| 3.4 | Package scaffold          | `[ ]` | `packages/workspaces/denali` — نه فقط `DENALI_BREACH_PROBE`              |
| 3.5 | Invariants                | `[ ]` | no DENALI\_\* in apps/api · no legacy import · registry resolve          |

```bash
# بعد از 6.0 PASS
pnpm run guard:import-boundary
# سپس اجرای subphase 6.1 per prove_with
```

**DoD Tier 3:** row 6.1 در IMPLEMENTATION-TRUTH → VERIFIED_SCAFFOLD یا بالاتر.

---

## Deferred — block نمی‌کند 6.0/6.1

| Item                        | فاز            | یادداشت          |
| --------------------------- | -------------- | ---------------- |
| `outbox_behavioral` کامل    | 6.4            | waiver در yaml   |
| `migrateCanonical` runtime  | 6.8            | expand–contract  |
| Resilience score ≥95        | Phase 4 Tier 3 | اختیاری قبل از 6 |
| OpenTelemetry / bulk import | 7+             | —                |

---

## Master verification (یک بار قبل از 6.1)

```bash
# Tier 0 env (see above)

pnpm run phase-5:guard      # must PASS (fix 1A first)
pnpm run phase-5:gate       # must exit 0
pnpm run guard:import-boundary
pnpm run phase-6:guard      # doc pack — already PASS

# edit reports/phase-6-entry-verified.yaml → verified_at
# update docs/phase-6/audits/IMPLEMENTATION-TRUTH.md row 6.0 → VERIFIED
```

### Definition of Done — ورود فاز ۶

```yaml
phase_6_entry_ready:
  phase_5_gate: ok true + exit 0
  phase_6_entry_yaml: verified_at set
  import_boundary: exit 0
  no_legacy_import: grep clean
  doc_pack: phase-6:guard PASS
  forbidden:
    - start_6_1_while_yaml_pending
    - claim_6_0_pass_if_phase_5_gate_red
```

---

## نقشه سریع: اولین سه اقدام (گام ۱)

```text
1. Tier 0 bootstrap (Postgres + env)
2. Fix p5_repo_alignment (doc-first + guard ↔ lazy-tours-service truth)
3. pnpm run phase-5:gate → yaml → 6.0 VERIFIED → then 6.1
```

---

_مرجع: [`docs/phase-6/subphases/6.0-entry-gate.md`](../docs/phase-6/subphases/6.0-entry-gate.md) · [`reports/phase-6-entry-verified.yaml`](../reports/phase-6-entry-verified.yaml) · [`TEMP/phase4-execution-checklist.md`](phase4-execution-checklist.md) §1C_
