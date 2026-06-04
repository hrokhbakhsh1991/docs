# Phase 3 — بستن Gapها در ۳ فاز

**منبع:** [`final-phase-3-audit-report.md`](../final-phase-3-audit-report.md)  
**تاریخ:** 2026-06-04

---

## فهرست کامل Gapها (۱۸ مورد)

| ID | شرح | شدت | فاز اجرا |
|----|-----|-----|----------|
| GAP-LOCK-01 | تناقض MAP Scaffold vs phase-3 «Closed» | P0 | **۱** |
| GAP-LOCK-02 | backlog red-flag vs ادعای Zero-Debt | P0 | **۱** |
| GAP-H7-01 | ردیف Phase Gate Audit Table در MAP | P0 | **۱** |
| GAP-3.2-01 | doc 3.2 هنوز in_memory-only | P2 | **۱** |
| GAP-3.2-02 | overview H3 قدیمی | P2 | **۱** |
| GAP-3.3-01 | import_law بدون select/checkbox | P2 | **۱** |
| GAP-3.3-02 | 3.3-apps-web text-only | P2 | **۱** |
| GAP-3.3x-01 | Select/Checkbox روی main / gate | P1 | **۲** |
| GAP-3.3x-02 | ghost-artifacts فقط button/input | P2 | **۲** |
| GAP-3.3-05 | renderer registry vs switch | P2 | **۲** |
| GAP-WIP-01 | تغییرات API unstaged | P1 | **۲** (فقط اگر مرتبط ۳) |
| GAP-3.3-04 | bootstrap استاتیک starter | P1 | **۳** (doc + قرارداد) |
| GAP-3.2-04 | DEV_TENANTS استاتیک | P1 | **۳** (doc Phase 4) |
| GAP-3.3-03 | Playwright نرم | P2 | **۳** (waiver رسمی) |
| GAP-3.3-06 | number/date/composite | P2 | **۳** (doc + تست) |
| GAP-3.2-03 | @casl/prisma runtime | P2 | **۳** (قبلاً doc) |
| GAP-3.3-07 | وابستگی whole ui-primitives | P2 | **۳** (doc) |
| GAP-CI-01 | count-only floors | P2 | **۳** (doc) |

---

## فاز ۱ — حاکمیت و هم‌راستایی مستندات

**هدف:** یک حقیقت واحد — «Gate-passed + backlog P0 بسته» نه «Zero-Debt سراسری» تا Playwright/Phase 4.

**کارها:** MAP، overview، 3.2، import_law، backlog exit.

---

## فاز ۲ — کد و قرارداد

**هدف:** 3.3.x روی شاخه، ghost-artifacts، wizard registry، تست‌های SDK/starter/platform-core.

---

## فاز ۳ — صریح‌سازی تعلیق + به‌روزرسانی گزارش قفل

**هدف:** Playwright waiver، bootstrap/tenant Phase 4، انواع فیلد پشتیبانی‌نشده، به‌روزرسانی `final-phase-3-audit-report.md`.

---

## پس از ۳ فاز

```bash
pnpm run phase-3:gate
# commit پایان فاز ۳ — یک SHA تازه + گزارش gate
```

---

## وضعیت اجرا (2026-06-04)

| فاز | وضعیت |
|-----|--------|
| ۱ | ✅ MAP، overview، 3.2، backlog، import_law |
| ۲ | ✅ Select/Checkbox، ghost-artifacts، `WIZARD_FIELD_RENDERERS`، platform-core/starter tests |
| ۳ | ✅ `phase-3-playwright-waiver.md`، `phase-3-deferred-capabilities.md` |

**باقی‌مانده برای شما:** `git commit` + `pnpm run phase-3:gate` + `git push` (GAP-WIP-01 API جدا نگه دارید اگر Phase 4 است).
