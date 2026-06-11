# Phase 8 — چک‌لیست بستن کامل (8.5 Product Parity DoD)

```yaml
created: "2026-06-08"
updated: "2026-06-08"
operator: solo-dev · یک شاخه · بدون fork/shard branch
current_branch: phase-8/8.4-e2e-integrity
wip_files_approx: 198
source:
  - docs/phase-8/subphases/8.5-platform-dod.md
  - docs/phase-8/audits/IMPLEMENTATION-TRUTH.md
  - docs/phase-8/phase-8-guards.md
  - docs/dev/tiered-testing.md
  - .github/workflows/phase-8-gate.yml
truth_ledgers:
  - docs/phase-8/audits/IMPLEMENTATION-TRUTH.md
  - reports/phase-8-entry-verified.yaml
  - reports/phase-8-gate-*.json
  - docs/audits/phase-8-zero-debt-forensic-audit.mdoc
  - reports/phase-9-entry-verified.yaml  # بعد از بستن ۸ — TG-P9-001
current_verdict: 8.0–8.4 VERIFIED_BEHAVIORAL · 8.5 PARTIAL · BL-P8-02 OPEN
target_verdict: phase_8_closed: true · 8.5 VERIFIED_BEHAVIORAL · hooks re-enabled
```

> **قانون طلایی (هر تسک):** قبل از هر تغییر کد یا doc → **بخوان** → بعد **حداقل diff**.  
> **تست سنگین:** فقط **GitHub Actions** — لوکال `phase-8:gate` / `ci:integrity` / Playwright **نزن**.  
> **شاخه:** روی همان `phase-8/8.4-e2e-integrity` می‌مانیم؛ commitهای **مرتب و کوچک** روی همان شاخه — شاخه جدید نمی‌سازیم.

---

## «الان کجاییم؟»

| لایه | وضعیت | blocker |
| ---- | ----- | ------- |
| 8.0 Entry | ✅ VERIFIED_ENTRY | — |
| 8.1 Owner auth | ✅ VERIFIED_BEHAVIORAL | — |
| 8.2 Urban product | ✅ VERIFIED_BEHAVIORAL | — |
| 8.3 Silo tier | ✅ VERIFIED_BEHAVIORAL | — |
| 8.4 E2E SMK-P8 | ✅ VERIFIED_BEHAVIORAL | — |
| 8.5 Contract spec | ✅ 4/4 locally | — |
| `phase-8:guard` | ✅ 25/25 (آخرین گزارش 2026-06-08) | — |
| **`phase-8:gate` روی GHA** | ❌ PENDING | **BL-P8-02** |
| Forensic audit | ❌ `verdict: PENDING` | تا gate-full سبز |
| Husky suspension | ⚠️ `active: true` | تا 8.5 بسته شود |
| WIP uncommitted | ⚠️ **195 فایل** (2026-06-08) | stash pop بعد از بستن ۸ — **روی `main` commit نشده** |

---

## قانون اجرا (A0 — قبل از هر فاز)

هر تسک زیر سه بخش دارد:

```text
READ  → فایل‌های اجباری را بخوان (بدون نوشتن)
CHECK → وضعیت فعلی را ثبت کن (سبز/قرمز/نامشخص)
ACT   → فقط اگر CHECK گفت لازم است — حداقل diff
PROVE → لوکال سبک یا GHA سنگین (طبق ستون)
```

| ممنوع | جایگزین |
| ----- | ------- |
| شاخه جدید برای «تمیز کردن» | commit مرتب روی همان شاخه |
| `pnpm run phase-8:gate` لوکال | GHA job `phase-8-gate-full` |
| `pnpm run ci:integrity` لوکال | GHA job `ci-integrity` |
| Playwright لوکال برای closure | GHA job `urban-e2e` |
| فاز ۹/۱۰ در همان commit بستن ۸ | `git stash push` موقت یا commit بعد از 8.5 |
| کد بدون خواندن IMPLEMENTATION-TRUTH | همیشه ledger اول |

---

## فاز A — ممیزی WIP (بدون commit)

**هدف:** بدانید چه چیزی روی دیسک است و چه چیزی برای 8.5 لازم است.

### A1 — READ

| # | فایل / مسیر | چرا |
| - | ----------- | --- |
| A1.1 | `docs/phase-8/audits/IMPLEMENTATION-TRUTH.md` | ledger رسمی |
| A1.2 | `docs/phase-8/subphases/8.5-platform-dod.md` | CP-8.5-01..10 |
| A1.3 | `git status --short` | لیست WIP |
| A1.4 | `git diff --stat` | بزرگی diff |
| A1.5 | `TEMP/platform-plugin-native-remediation-roadmap.md` | اگر urban جابجا شده — تداخل با 8.5 |

### A2 — CHECK (تسک‌ها)

| ID | تسک | دستور | خروجی مورد انتظار |
| -- | --- | ----- | ----------------- |
| A2.1 | شمارش WIP | `git status --short \| wc -l` | عدد ثبت در این فایل |
| A2.2 | آیا `apps/api/src/urban/` حذف شده؟ | `test -d apps/api/src/urban && echo YES \|\| echo NO` | اگر NO → Phase 10 WIP روی دیسک |
| A2.3 | آیا فاز ۹ spec در diff است؟ | `git status --short \| rg 'phase-9\|identity-\|operator-'` | لیست جدا |
| A2.4 | guard آخرین بار | `cat reports/phase-8-gate-2026-06-08.json \| rg '"ok"'` | `true` |

### A3 — ACT (تصمیم solo-dev · بدون شاخه جدید)

| ID | تسک | اقدام |
| -- | --- | ----- |
| A3.1 | **جداسازی ذهنی WIP** | دو سطل: `P8-CLOSURE` vs `P9-P10-DEFER` |
| A3.2 | **Stash اختیاری** (نه شاخه) | اگر Phase 10 urban migration نیمه‌کار است و guard می‌شکند: `git stash push -m "p9-p10-wip" -- <paths>` |
| A3.3 | **ثبت در این فایل** | زیر «یادداشت اپراتور» بنویسید چه stash شد |

**DoD فاز A:** می‌دانید commit بعدی فقط `P8-CLOSURE` است یا نه.

```text
یادداشت اپراتور (به‌روز 2026-06-08):

منبع WIP:
  stash@{p9-p10} از phase-8/8.4-e2e-integrity (2026-06-08)
  → بعد از بستن ۸ با git stash pop برگشت (conflict ledger حل شد — نسخه بسته main ماند)
  → stash drop شد؛ محتوا الان فقط روی working tree است (195 فایل)

main commit‌شده (تمیز — دست نزن):
  HEAD 0a9f2fb — phase_8_closed: true · forensic PASS · hooks فعال
  urban هنوز در apps/api/src/urban/** روی remote/main

WIP = کار نیمه‌کاره فاز ۹ + ۱۰ (مهم — پاک نکن):
  P10 urban migration: حذف apps/api/src/urban/** → packages/workspaces/urban/src/http/**
  P10 plugin host: workspace manifest codegen، route registrar، outbox dispatcher
  P9 operator: identity، admin shell، tours، bookings، settings، finance specs+کد
  P9 doc pack: docs/phase-9/** (~61 فایل untracked)
  P10 doc pack: docs/phase-10/** (untracked)

آمار (git status):
  Modified: 69 · Deleted: 26 · Untracked: 100 · جمع: 195
  urban_api_dir روی دیسک: NO (migration نیمه‌کار — روی main هنوز YES)

اقدام بعدی پیشنهادی (نه الان):
  commit جدا برای P10.1–10.3 urban pilot، بعد P9 scaffold — نه یک commit بزرگ
  قبل از commit: pnpm run phase-8:guard (اگر doc path عوض شده)
```

---

## ممیزی WIP روی `main` (پس از بستن فاز ۸ — 195 فایل)

> **هشدار:** این فایل‌ها روی `main` **commit نشده‌اند**. فاز ۸ روی remote **بسته است**.  
> **هیچ‌کدام را بدون خواندن پاک نکن** — بیشترشان کار عمدی فاز ۹/۱۰ است.

### روی `main` commit‌شده (HEAD `0a9f2fb`)

| چه چیزی | وضعیت |
| -------- | ------ |
| `IMPLEMENTATION-TRUTH` | `phase_8_closed: true` · 8.5 VERIFIED |
| `apps/api/src/urban/**` | **هنوز وجود دارد** (Product Parity فاز ۸) |
| `PHASE-8-HOOKS-SUSPENSION.yaml` | حذف شده — pre-commit فعال |
| GHA فاز ۰–۸ | سبز (run #15 `80715b4` + re-run ledger) |

### سطل‌های WIP (uncommitted)

| سطل | تقریباً | چیست | کی / چرا |
| --- | ------- | ---- | -------- |
| **P10-urban-migration** | ~35 | حذف `apps/api/src/urban/*` · `configure-urban-http-host.ts` · `packages/workspaces/urban/src/http/**` | roadmap فاز ۱۰.۳ · plugin-native host |
| **P10-infra** | ~25 | `workspace-plugin-registry.generated.ts` · outbox side-effects · route registrar · `generate-workspace-registry.mjs` | فاز ۱۰.۱–۱۰.۲ codegen |
| **P9-api-tests** | ~20 | `identity-*.spec.ts` · `bookings-*.spec.ts` · `settings-*.spec.ts` · `finance-ops.spec.ts` | scaffold تست اپراتور |
| **P9-web-tests** | ~15 | `auth-login-*.spec.ts` · `tours-operator.spec.ts` · `app/finance/**` | UI اپراتور |
| **P9-denali-packages** | ~15 | `denali/src/bookings/` · `settings/` · `list/` · `workspace.manifest.json` | manifest + ماژول‌های 9.5/9.6/9.3 |
| **P9+P10-docs** | ~80+ | `docs/phase-9/**` · `docs/phase-10/**` · `TEMP/phase9-*` · `TEMP/platform-plugin-native-*` | doc pack فاز ۹/۱۰ |
| **P8-doc-drift** | 15 | `docs/phase-8/**` pathها به `packages/workspaces/urban` (هنوز commit نشده) | هم‌راستا با P10 — **با بستن ۸ روی main conflict ندارد** |
| **guards/sdk** | ~35 | `phase-9-guard.mjs` · `phase-10-guard.yml` · `workspace-sdk` operator/auth | guard فاز ۹/۱۰ |

### حذف‌های tracked (D) — معنی‌دار

| مسیر | معنی |
| ---- | ---- |
| `apps/api/src/urban/**` (16 فایل) | جابجایی به workspace plugin — **جایگزین untracked در `packages/workspaces/urban/src/http/`** |
| `lazy-urban-plugin.ts` · `lazy-denali-plugin.ts` | جایگزین: `workspace-plugin-loaders.generated.ts` |
| `TEMP/phase8-wip-specs/*.spec.ts` | specها به trunk منتقل شده — TEMP دیگر لازم نیست (**بعد از تأیید** قابل حذف) |
| `packages/workspace-sdk/test/urban-owner-ability.spec.ts` | منتقل به `packages/workspaces/urban/test/` |

### چه چیزی امن است / چه چیزی نیست

| امن | خطرناک |
| --- | ------ |
| نگه‌داشتن WIP روی دیسک | `git checkout .` یا `git clean -fd` — **همه P9/P10 از بین می‌رود** |
| `git stash push` دوباره اگر می‌خواهید main تمیز بماند | commit یک‌جا 195 فایل — gate فاز ۸ می‌شکند |
| commit تدریجی per subphase | پاک کردن `docs/phase-9/` یا `packages/workspaces/urban/src/http/` |

---

## فاز B — آماده‌سازی commit بستن ۸ (لوکال سبک)

**هدف:** قبل از push، مطمئن شوید guard و boundary سبز می‌مانند.

### B1 — READ (قبل از هر fix)

| # | مسیر |
| - | ---- |
| B1.1 | `scripts/guards/phase-8-guard.mjs` |
| B1.2 | `scripts/guards/lib/phase-8-hardening-artifacts.mjs` (spec path registry) |
| B1.3 | `apps/api/test/phase-8.contract.spec.ts` |
| B1.4 | فایل‌هایی که `git diff` نشان می‌دهد در scope P8 هستند |

### B2 — CHECK

| ID | تسک | دستور | لوکال |
| -- | --- | ----- | ----- |
| B2.1 | Node engine | `nvm use && pnpm run check:node-engine` | ✅ |
| B2.2 | Build حداقلی guard | `pnpm --filter @app-tour/workspace-sdk run build && pnpm --filter @app-tour/platform-core run build` | ✅ |
| B2.3 | Import boundary | `pnpm run guard:import-boundary` | ✅ |
| B2.4 | P8 boundary | `pnpm run guard:p8-boundary-diff` | ✅ |
| B2.5 | Phase 8 guard | `pnpm run phase-8:guard` | ✅ |
| B2.6 | Contract (memory) | `cd apps/api && node --import tsx --import ./test/bootstrap-outbox-test-env.ts --test --test-force-exit test/phase-8.contract.spec.ts` | ✅ اختیاری |

### B3 — ACT (فقط اگر B2 قرمز شد)

| ID | تسک | READ قبل از fix |
| -- | --- | --------------- |
| B3.1 | Guard fail → token را بخوان | stderr `FAIL P8-GUARD-<id>` |
| B3.2 | Spec path drift (Phase 10) | `p8_spec_path_registry` · `p8_doc_path_consistency` |
| B3.3 | Doc drift | subphase مربوط در `docs/phase-8/subphases/` |
| B3.4 | حداقل fix | یک checker · یک فایل · یک commit |

### B4 — COMMIT (همان شاخه)

| ID | تسک | پیام commit نمونه |
| -- | --- | ----------------- |
| B4.1 | فقط P8 scope | `fix(phase-8): <یک جمله why>` |
| B4.2 | push | `git push origin phase-8/8.4-e2e-integrity` |
| B4.3 | **ممنوع** | `feat(phase-9)` یا `feat(phase-10)` در commit بستن ۸ |

**DoD فاز B:** `phase-8:guard` + boundary سبز · push شده · GHA triggered.

---

## فاز C — GHA PR path (تست سنگین · بدون لوکال)

**هدف:** سه job اصلی PR سبز — طبق `.github/workflows/phase-8-gate.yml`.

### C1 — READ

| # | فایل |
| - | ---- |
| C1.1 | `.github/workflows/phase-8-gate.yml` |
| C1.2 | GitHub Actions run log (آخرین push) |

### C2 — WATCH (Jobs)

| Job | مدت | اگر قرمز → READ اول |
| --- | --- | ------------------- |
| **guard** | ~5–15m | `phase-8-guard.mjs` + گزارش artifact |
| **urban-regression** | ~15–30m | specهای لیست‌شده در workflow L139–147 |
| **urban-e2e** | ~20–45m | `apps/web/tests/e2e/urban-e2e-integrity.spec.ts` |
| **ci-integrity** | ~60–90m | `scripts/ci-integrity-check.sh` · Postgres migrate |

**urban-regression bundle (مرجع):**

```text
test/phase-8.contract.spec.ts
test/urban-owner-ability.spec.ts
test/urban-catalog-registration.spec.ts
test/urban-silo-fixture.spec.ts
test/urban-e2e-http.spec.ts
apps/web/test/urban-catalog-access.spec.ts
pnpm --filter @app-tour/workspace-urban run test
```

### C3 — ACT (رفع شکست GHA)

| ID | تسک | روش |
| -- | --- | ----- |
| C3.1 | Log را بخوان | failed step + stderr |
| C3.2 | فایل spec مربوط | READ spec + implementation |
| C3.3 | حداقل fix لوکال | فقط همان spec |
| C3.4 | B2 را تکرار | guard سریع |
| C3.5 | push دوباره | همان شاخه |

| ID | تسک | وضعیت |
| -- | --- | ----- |
| C3.6 | guard سبز | `[ ]` |
| C3.7 | urban-regression سبز | `[ ]` |
| C3.8 | urban-e2e سبز | `[ ]` |
| C3.9 | ci-integrity سبز | `[ ]` |

**DoD فاز C:** هر چهار job سبز روی آخرین push.

---

## فاز D — Closure رسمی 8.5 (`phase-8-gate-full`)

**هدف:** CP-8.5-01 — `pnpm run phase-8:gate` exit 0 روی runner.

### D1 — READ

| # | فایل |
| - | ---- |
| D1.1 | `package.json` → script `phase-8:gate` |
| D1.2 | `docs/phase-8/subphases/8.5-platform-dod.md` § Completion Proof Matrix |

**زنجیره gate:**

```bash
pnpm build && pnpm test && pnpm run phase-7:gate && pnpm run phase-8:guard
```

### D2 — TRIGGER (GHA فقط)

| روش | چه زمانی |
| --- | -------- |
| **A** Merge به `main` | بعد از فاز C سبز — job `phase-8-gate-full` خودکار |
| **B** Manual dispatch | Actions → `phase-8-gate` → `run_full_phase_8_gate: true` |

| ID | تسک | وضعیت |
| -- | --- | ----- |
| D2.1 | `phase-8-gate-full` triggered | `[ ]` |
| D2.2 | Postgres + Redis services up | `[ ]` (GHA) |
| D2.3 | `pnpm run phase-8:gate` exit 0 | `[ ]` |
| D2.4 | Artifact `phase-8-closure-reports` | `[ ]` |

### D3 — ACT بعد از سبز

| ID | تسک | READ | ACT |
| -- | --- | ---- | --- |
| D3.1 | دانلود JSON | artifact GHA | `reports/phase-8-gate-YYYY-MM-DD.json` |
| D3.2 | تأیید `ok: true` | JSON | commit به repo |

**DoD فاز D:** `phase-8-gate-full` سبز · JSON با `ok: true` روی trunk.

---

## فاز E — Ledger · Forensic · Hooks (doc + یک commit نهایی)

**هدف:** ادعای رسمی «فاز ۸ بسته شد» — فقط بعد از فاز D.

### E1 — READ

| # | فایل |
| - | ---- |
| E1.1 | `docs/phase-8/audits/IMPLEMENTATION-TRUTH.md` |
| E1.2 | `docs/audits/phase-8-zero-debt-forensic-audit.mdoc` |
| E1.3 | `docs/phase-8/appendices/PHASE-8-HOOKS-SUSPENSION.yaml` |
| E1.4 | `reports/phase-9-entry-verified.yaml` |
| E1.5 | `docs/phase-8/subphases/8.5-platform-dod.md` § IMPLEMENTATION-TRUTH update |

### E2 — ACT (تسک‌ها)

| ID | تسک | تغییر | وضعیت |
| -- | --- | ----- | ----- |
| E2.1 | IMPLEMENTATION-TRUTH | `subphase_8_5: VERIFIED_BEHAVIORAL` · `phase_8_closed: true` · `closure_git_sha` | `[ ]` |
| E2.2 | behavioral | `behavioral: VERIFIED_BEHAVIORAL` | `[ ]` |
| E2.3 | BL-P8-02 | بسته · blocker حذف | `[ ]` |
| E2.4 | Forensic | `verdict: PASS` · `score: >= 8` · SHA | `[ ]` |
| E2.5 | phase-9 entry | `phase_8_gate.status: PASS` · `exit_code: 0` | `[ ]` |
| E2.6 | حذف suspension | **delete** `PHASE-8-HOOKS-SUSPENSION.yaml` | `[ ]` |
| E2.7 | Commit | `docs(phase-8): close 8.5 product parity dod` | `[ ]` |
| E2.8 | Push main | همان شاخه یا merge PR به main | `[ ]` |

### E3 — PROVE (بعد از hooks)

| ID | تسک | کجا |
| -- | --- | --- |
| E3.1 | `pnpm run pre-commit:fast` | لوکال یک‌بار (سبک) |
| E3.2 | تأیید suspension off | `bash scripts/phase-8-hooks-suspended.sh` → exit 1 |

**DoD فاز E:** forensic PASS · ledger بسته · TG-P9-001 رفع · Husky فعال.

---

## فاز F — بعد از بستن ۸ (اختیاری · همان شاخه)

**هدف:** برگرداندن WIP فاز ۹/۱۰ — **بعد از** E2.8.

| ID | تسک | READ | ACT |
| -- | --- | ---- | --- |
| F1 | Stash pop | `git stash list` | `git stash pop` |
| F2 | Phase 10 urban | `TEMP/platform-plugin-native-remediation-roadmap.md` | ادامه migration |
| F3 | Phase 9 entry | `docs/phase-9/subphases/9.0-entry.md` | `phase-9:guard` |

---

## Definition of Done — فاز ۸ کاملاً بسته

```text
[ ] فاز A: WIP ممیزی شده · P8 جدا از P9/P10
[ ] فاز B: phase-8:guard + boundary سبز · push
[ ] فاز C: GHA guard + urban-regression + urban-e2e + ci-integrity سبز
[ ] فاز D: phase-8-gate-full سبز · reports/phase-8-gate-*.json ok:true
[ ] فاز E: IMPLEMENTATION-TRUTH · forensic PASS · phase-9 entry · hooks on
[ ] ممنوع نقض: AH-8.5-01 (guard-only closure)
```

---

## نقشه سریع (یک نفر · GHA-first)

```text
READ ledger + WIP
    ↓
لوکال: phase-8:guard فقط
    ↓
commit کوچک P8 → push (همان شاخه)
    ↓
GHA: guard → urban-regression → urban-e2e → ci-integrity
    ↓
GHA: phase-8-gate-full (main یا dispatch)
    ↓
doc ledger + forensic + حذف suspension → commit
    ↓
stash pop → فاز ۹
```

---

## مراجع سریع

| سند | مسیر |
| --- | ---- |
| Subphase 8.5 | `docs/phase-8/subphases/8.5-platform-dod.md` |
| Guards | `docs/phase-8/phase-8-guards.md` |
| GHA workflow | `.github/workflows/phase-8-gate.yml` |
| Tiered testing | `docs/dev/tiered-testing.md` |
| Verification CMD | `docs/phase-8/appendices/verification-commands.md` § 8.5 |
| Entry ledger | `reports/phase-8-entry-verified.yaml` |

---

*فایل موقت — بعد از بستن 8.5 می‌توانید به `TEMP/DEPRECATED.md` ارجاع دهید یا حذف کنید.*
