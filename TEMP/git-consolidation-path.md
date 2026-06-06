# مسیر پیشنهادی — یکپارچه‌سازی Git (همه‌چیز روی آخرین main)

```yaml
created: "2026-06-06"
repo: /home/hamed/Music/docs
remote: origin
canonical_main: origin/main
current_branch: integrate/phase-4-6
current_head: W4-complete
origin_main_head: 1937f0b
wip_uncommitted_files: ~619
diff_vs_origin_main: ~808 files (+83k / -2.4k lines)
verdict: CONSOLIDATE_REQUIRED — merge همه برنچ‌های قدیمی ممنوع؛ یک integration branch از origin/main
target_branch: integrate/phase-4-6
target_remote_pr_base: main
```

> **هدف:** یک خط زمانی تمیز — `origin/main` + کار commit‌شدهٔ Phase 4→6 — بدون قاطی شدن WIP، artifactهای gate قدیمی، و برنچ‌های stale.

---

## تشخیص (چرا gateها fail می‌شوند)

| علت                         | شواهد                                                                         |
| --------------------------- | ----------------------------------------------------------------------------- |
| WIP عظیم uncommitted        | ~۶۱۹ فایل روی `feat/phase-4`                                                  |
| چند فاز روی یک working tree | Phase 4 + 5 + 6 + Denali بدون commit مرزدار                                   |
| `last-run.json` قدیمی       | مثلاً `phase-4-resilience-regression-gate.last-run.json` با guard fail تاریخی |
| برنچ فعلی ≠ main            | `feat/phase-4` فقط **۹ commit** جلوتر؛ بقیهٔ کار commit نشده                  |
| برنچ‌های قدیمی stale        | `feat/phase-1-*`، `fix/ci-stability-p0` → ۲۳–۲۹ commit **عقب‌تر** از main     |

**جمع‌بندی:** مشکل اصلی «تعداد برنچ» نیست؛ مشکل **عدم commit + کار روی یک tree نیمه‌کاره** است.

---

## مسیر هدف (Target state)

```text
origin/main (1937f0b …)
    └── integrate/phase-4-6          ← برنچ کار روزانه
            ├── commit wave 1: phase-4 resilience
            ├── commit wave 2: phase-5 evolution
            ├── commit wave 3: phase-6 denali + docs
            └── commit wave 4: gates + reports
                    └── PR → main  (بعد از phase-6:gate سبز)
```

| بعد از consolidation | باید باشد                         |
| -------------------- | --------------------------------- |
| Working tree         | clean (`git status` خالی)         |
| Single SoT branch    | `integrate/phase-4-6`             |
| `origin/main`        | base همهٔ PRها                    |
| Stale branches       | archived / deleted (بعد از تأیید) |
| Gate artifacts       | regenerate بعد از merge تمیز      |

---

## ممنوع — این برنچ‌ها را جدا merge نکن

این‌ها **منسوخ** یا **داخل feat/phase-4 / WIP** هستند:

| برنچ                                    | وضعیت نسبت به main | اقدام                                             |
| --------------------------------------- | ------------------ | ------------------------------------------------- |
| `feat/phase-1-1-workspace-sdk-scaffold` | ~۲۹ commit عقب     | ❌ merge نکن — superseded                         |
| `feat/phase-1-2-workspace-sdk-contract` | stale              | ❌ merge نکن                                      |
| `feat/phase-1-3-api-workspace-bridge`   | stale              | ❌ merge نکن                                      |
| `feat/phase-1-4-workspace-sdk-guards`   | stale              | ❌ merge نکن                                      |
| `fix/ci-stability-p0`                   | ~۲۳ commit عقب     | ❌ merge نکن (مگر cherry-pick تک‌کامیت اثبات‌شده) |
| `fix/denali-wizard-reactivity-draft`    | legacy             | ❌ merge نکن                                      |
| `main-upload` / `master`                | نامشخص             | ❌ استفاده نکن                                    |

**فقط این‌ها منبع حقیقت:**

1. `origin/main` — baseline
2. `feat/phase-4` — ۹ commit رسمی
3. Working tree فعلی — WIP که باید wave-commit شود

---

## مسیر اجرایی (گام‌به‌گام)

### Tier 0 — Backup (اجباری · ۵ دقیقه) ✅ انجام شد 2026-06-06

```bash
cd /home/hamed/Music/docs
git fetch origin

# شاخهٔ backup از وضعیت فعلی (شامل uncommitted بعد از stash)
git branch backup/feat-phase-4-wip-2026-06-06

# stash امن همهٔ تغییرات (شامل untracked)
git stash push -u -m "wip-phase-4-6-before-consolidation-2026-06-06"
```

**DoD:** `git stash list` شامل stash بالا · `git branch | grep backup/feat-phase-4-wip`

**نتیجه:** `stash@{0}` · `backup/feat-phase-4-wip-2026-06-06` @ `1697b77`

---

### Tier 1 — main تازه + برنچ integration (۱۰ دقیقه) ✅ انجام شد 2026-06-06

```bash
git checkout main
git pull origin main
# انتظار: HEAD = origin/main (1937f0b یا جدیدتر)

git checkout -b integrate/phase-4-6 origin/main
```

**DoD:** `git rev-parse HEAD` = `git rev-parse origin/main`

**نتیجه:** برنچ `integrate/phase-4-6` @ `1937f0b` (tracking `origin/main`)

---

### Tier 2 — آوردن commitهای رسمی feat/phase-4 (۱۵–۴۵ دقیقه) ✅ انجام شد 2026-06-06

```bash
git merge feat/phase-4 --no-ff -m "merge(feat/phase-4): phase 2 observability + phase-4 base into integration"
```

**نتیجه:** merge commit `adb6bc8` · **۱۰ commit** جلوتر از `origin/main` (۹ + merge)

اگر conflict زیاد بود → **به‌جای merge کامل:**

```bash
git log --oneline origin/main..feat/phase-4   # لیست ۹ commit
git cherry-pick <sha1>^..<sha9>               # تک‌تک
```

**DoD:** `git log --oneline origin/main..HEAD` نشان‌دهندهٔ commitهای phase-4

---

### Tier 3 — بازگرداندن WIP و commit موجی (۱–۳ ساعت) ✅ انجام شد 2026-06-06

```bash
git stash pop   # یا: git stash apply stash^{/wip-phase-4-6}
```

**وضعیت:** ۴ wave commit روی `integrate/phase-4-6` · working tree **clean**

| Wave | commit    | پیام                                      |
| ---- | --------- | ----------------------------------------- |
| W1   | `538ffde` | phase-4 resilience closure                |
| W2   | `ac4dd8e` | phase-5 evolution closure                 |
| W3   | `7f82c81` | phase-6 Denali workspace closure          |
| W4   | `6ea3b21` | integrate artifacts + gates + repo wiring |

**ترتیب commit پیشنهادی (هر wave یک PR-logical unit):**

| Wave   | محتوا              | مسیرهای کلیدی                                                         | دستور تأیید                                                      |
| ------ | ------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **W1** | Phase 4 resilience | `apps/api/src/outbox/`, `graceful-shutdown`, guards `guard-*`         | `pnpm --filter @apps/api run phase-4:resilience-regression-gate` |
| **W2** | Phase 5 evolution  | `apps/api/src/db/`, monitors, `phase-5-*` scripts                     | `pnpm run phase-5:gate`                                          |
| **W3** | Phase 6 Denali     | `packages/workspaces/denali/`, `apps/api` bootstrap, `apps/web` smoke | `pnpm --filter @app-tour/workspace-denali test`                  |
| **W4** | Docs + reports     | `docs/phase-6/`, `reports/phase-*-gate-*.json`                        | `pnpm run phase-6:guard`                                         |

```bash
# مثال (بعد از stage دستی هر wave):
git add <paths-for-wave>
git commit -m "$(cat <<'EOF'
feat(api): phase-4 resilience closure (outbox, shutdown, regression gate)

EOF
)"
```

**قانون:** هر commit باید `pre-commit:fast` یا حداقل `test:changed` را سبز کند.

---

### Tier 4 — Regenerate gate artifacts (۳۰–۹۰ دقیقه)

Artifactهای قدیمی را **دستی edit نکن** — gate را دوباره اجرا کن:

```bash
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32'
export DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db'
export STORAGE_DRIVER=prisma NODE_ENV=test

pnpm run db:test-reset

cd apps/api && pnpm run phase-4:resilience-regression-gate
# تولید: test/reliability/phase-4-resilience-regression-gate.last-run.json

cd /home/hamed/Music/docs
pnpm run phase-5:gate
pnpm run phase-6:gate
```

**DoD:** `last-run.json` ها `verdict: PASS` · `reports/phase-6-gate-*.json` → `"ok": true`

---

### Tier 5 — Push + PR (بعد از gate سبز)

```bash
git push -u origin integrate/phase-4-6
gh pr create --base main --head integrate/phase-4-6 \
  --title "integrate: Phase 4–6 denali workspace closure" \
  --body "Consolidates feat/phase-4 + WIP onto origin/main. See TEMP/git-consolidation-path.md"
```

---

## Env استاندارد (همهٔ gateها)

```bash
nvm use && corepack enable
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32'
export DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db'
export STORAGE_DRIVER=prisma
export NODE_ENV=test
export APPS_API_TEST_TIER=nightly   # فقط برای noisy-neighbor در gate postgres
```

Postgres:

```bash
docker compose -f docs/phase-4/dev/docker-compose.yml up -d
DATABASE_URL=$DATABASE_URL_ADMIN pnpm --filter @apps/api run db:migrate:deploy
```

---

## نردبان تأیید نهایی (Definition of Done)

| #   | معیار                | دستور                                                            |
| --- | -------------------- | ---------------------------------------------------------------- |
| 1   | Working tree clean   | `git status`                                                     |
| 2   | Based on latest main | `git merge-base --is-ancestor origin/main HEAD`                  |
| 3   | Denali tests         | `pnpm --filter @app-tour/workspace-denali test`                  |
| 4   | API trunk tests      | `pnpm --filter @apps/api test`                                   |
| 5   | phase-4 regression   | `pnpm --filter @apps/api run phase-4:resilience-regression-gate` |
| 6   | phase-5 gate         | `pnpm run phase-5:gate`                                          |
| 7   | phase-6 gate         | `pnpm run phase-6:gate`                                          |
| 8   | Doc truth            | `pnpm run phase-6:guard`                                         |
| 9   | IMPLEMENTATION-TRUTH | `6.9 → VERIFIED_BEHAVIORAL` · `phase_closed: true`               |

---

## Rollback (اگر consolidation خراب شد)

```bash
git checkout feat/phase-4
git stash list
git stash apply stash^{/wip-phase-4-6-before-consolidation}
# یا
git checkout backup/feat-phase-4-wip-2026-06-06
```

---

## نقشه برنچ (وضعیت ۲۰۲۶-۰۶-۰۶)

```text
origin/main ─────────────────────────────► 1937f0b (phase-3 gate docs)
                                              │
feat/phase-4 ──── 9 commits ahead ────────────┤ (merge target)
                                              │
working tree ─── ~619 uncommitted ──────────┤ (stash → wave commits)
                                              │
integrate/phase-4-6 ◄── TARGET (از origin/main)
                                              │
feat/phase-1-* / fix/ci-* ◄── STALE (حذف از مسیر)
```

---

## تصمیم معماری (یک جمله)

> **بله** همه را روی آخرین `origin/main` جمع کن — **اما** از یک برنچ `integrate/phase-4-6`، با stash + wave commit، **نه** با merge هم‌زمان همهٔ برنچ‌های قدیمی.

---

**مسیر فایل:** [`TEMP/git-consolidation-path.md`](git-consolidation-path.md)
