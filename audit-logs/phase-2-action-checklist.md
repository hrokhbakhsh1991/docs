# Phase 2 — چک‌لیست اقدامات (از audit-logs/phase-2-temp-report.md)

**آخرین به‌روزرسانی:** 2026-06-04  
**هدف:** یک‌به‌یک جلو بروید؛ هر ردیف = یک کار قابل تأیید.

---

## وضع کلی

| بخش | وضع |
|-----|-----|
| A — معماری و export (کد) | ✅ از قبل سبز — نیازی به تغییر نبود |
| B — اصلاح مستندات | ✅ انجام شد |
| C — تقویت گیت و CI | ✅ انجام شد |
| D — تست design-tokens | ✅ انجام شد |
| E — تأیید نهایی (شما) | 🟡 E-1..E-3 انجام شد؛ E-4..E-7 اختیاری |

---

## A — معماری (فقط تأیید)

- [x] **A-1** اسکن infiltration: 0 نقض در design-tokens / ui-primitives / theme-react
- [x] **A-2** export policy: barrel ui-primitives ممنوع؛ theme-react فقط `.`
- [x] **A-3** platform-core بدون design-tokens

---

## B — مستندات (اصلاح تناقض)

- [x] **B-1** `AGENTS.md` — `ci:integrity` = phase-0 + phase-1 + phase-2 gate
- [x] **B-2** `phase-2-design-system.ai-exec.md` — pre_commit_note به‌روز
- [x] **B-3** `phase-2.ai-exec.index.md` — DRIFT-P2-11 بسته
- [x] **B-4** `phase-2-design-system.mdoc` — §11.1، §11.4، Appendix G، §5.5 ingress API
- [x] **B-5** `MIGRATION-MAP.md` — handoff ingress عمومی vs داخلی
- [x] **B-6** `subphases/2.2.1-theme-ingress-security.md` — ادغام بخش تکراری
- [x] **B-7** §15.3 CASL — برچسب فاز (۲.۴ پیاده / ۳ inject)
- [x] **B-8** §9.6 — theme-react فقط devDependency در production
- [x] **B-9** CD-05 — یادداشت L-01 در Appendix G
- [x] **B-10** `phase-2-ci.md` + `phase-2-guards.md` — زنجیره gate جدید
- [x] **B-11** `pnpm run guard:doc-sync` سبز و `phase-2-design-system.md` هم‌خوان با mdoc

---

## C — گیت و CI (کد + اسکریپت)

- [x] **C-1** `package.json` `phase-2:gate` — check-node-engine + test:phase-2
- [x] **C-2** `scripts/ci-integrity-check.sh` — phase-1:gate کامل (به‌جای فقط phase-1-guard)
- [x] **C-3** `pnpm test` — شامل `@app-tour/design-tokens`
- [x] **C-4** `phase-2-guard.mjs` — `p2_design_tokens_tests` (16 check)
- [x] **C-5** `gate-thresholds.mjs` — `DESIGN_TOKENS_TEST_MIN.phase2 = 3`
- [x] **C-6** `.github/workflows/phase-2-gate.yml` — engine check داخل gate

---

## D — تست design-tokens

- [x] **D-1** `packages/design-tokens/test/tokens-meta.contract.spec.mjs`
- [x] **D-2** `package.json` script `test`
- [x] **D-3** doc §7.5 exit criteria

---

## E — تأیید نهایی (شما یکی‌یکی)

- [x] **E-1** `pnpm --filter @app-tour/design-tokens run test`
- [x] **E-2** `pnpm run phase-2:gate` — 16/16 PASS در phase-2-guard
- [x] **E-3** `pnpm run guard:doc-sync`
- [ ] **E-4** (اختیاری سنگین) `pnpm run ci:integrity` — قبل از commit بزرگ
- [ ] **E-5** گزارش `reports/phase-2-gate-*.json` را نگاه کنید — gitSha درست باشد
- [ ] **E-6** اگر PR دارید: workflow `phase-2-gate` سبز روی GitHub
- [ ] **E-7** `audit-logs/phase-2-temp-report.md` — در صورت نیاز بخش «اقدامات انجام‌شده» اضافه کنید یا به forensic رسمی منتقل کنید

---

## F — باقی‌مانده عمدی (backlog، نه باگ)

- [ ] **F-1** Select / Checkbox ویجت — فاز ۳ (FT-P2-04)
- [ ] **F-2** کاهش تکرار validate/artifact در gate (CI-05) — فقط بهینه‌سازی زمان
- [ ] **F-3** تقویت بیشتر count-only floors با contract rows — در صورت نیاز فاز بعد

---

## دستورات سریع

```bash
cd /home/hamed/Music/docs
nvm use && corepack enable
pnpm --filter @app-tour/design-tokens run test
pnpm run phase-2:gate
pnpm run guard:doc-sync
# قبل از commit:
pnpm run ci:integrity
```

---

## مرجع

- گزارش ممیزی: [`phase-2-temp-report.md`](phase-2-temp-report.md)
- sign-off: [`reports/phase-2-closure-signoff-2026-06-04.md`](../reports/phase-2-closure-signoff-2026-06-04.md)
