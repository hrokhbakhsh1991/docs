# P7 — Denali customer live (summary)

```yaml
phase: 20
pack: P7
version: 0.1-sketch
status: planned
prerequisite: P6 ✅ — docs/phase-19/p6/p6-exit-checklist.md
north_star: first Denali club customer live on staging
detail_index: docs/phase-20/README.md
temp_agent: docs/phase-20/p7/AGENT-START.md
exit: docs/phase-20/p7/p7-exit-checklist.md
estimate: TBD (بسط بعدی)
```

> **خلاصه اجرایی.** Spec کامل بعداً nano-task می‌شود — الان فقط **می‌دانیم چه می‌خواهیم**.

---

## چرا P7 بعد از P6؟

| P6 داد | P7 می‌خواهد |
| ------ | ----------- |
| زنجیره محصول + gate استاتیک | همان زنجیره روی **staging + داده واقعی مشتری** |
| wizard/trunk موجود | **تکمیل** blockerها — نه rebuild |
| workspace ۳ تب نازک | **ops روز اول** پایدار + additive |
| runbook staging | **اجرای واقعی** + sign-off |

---

## شروع (۳ قدم)

1. **P6 exit** — `pnpm run p6:gate`
2. **Umbrella** — `docs/phase-20/platform-denali-customer-delivery.mdoc`
3. **Agent** — `docs/phase-20/p7/AGENT-START.md` → **P7-0**

---

## ترتیب EPIC (frozen sketch)

```text
P7-0 Live infra  →  P7-1 Wizard complete  →  P7-2 Workspace ops  →  P7-3 Delivery exit
```

| # | EPIC | یک خط | Zone |
|---|------|-------|------|
| 0 | P7-0 | staging · seed · DNS/env | infra |
| 1 | P7-1 | تکمیل wizard/settings موجود | Z1+Z2 |
| 2 | P7-2 | workspace additive برای ops | Z3 |
| 3 | P7-3 | T2/T3/T4 · sign-off مشتری | verify |

---

## Zones (یادآوری سریع)

```text
Z1 Freeze   — wizard · rules · composites (دست نزن)
Z2 Complete — همان فیلد/استپ ناقص
Z3 Additive — workspace route/tab جدید فقط اگر P0
Z4 Later    — بعد از تحویل مشتری
```

---

## حفاظت Denali admin

```text
✅ هر PR: pnpm run p6:gate
❌ حذف rules/composites
❌ wizard → (app)/ refactor
❌ merge سه app
```

---

## خروجی نهایی P7

مشتری اول:

1. تور خود را publish می‌کند
2. مهمان ثبت‌نام می‌کند
3. اپراتور booking + receipt را تأیید می‌کند
4. روی staging URLهای canonical

---

## بسط بعدی (v1.0 pack)

- [ ] شمارش nano per EPIC
- [ ] `p7:gate` script
- [ ] TRACEABILITY / SMOKE maps
- [ ] blocker walkthrough از تور واقعی مشتری

---

## لینک‌ها

| نقش | Path |
| --- | ---- |
| Docs index | `docs/phase-20/README.md` |
| Umbrella | `docs/phase-20/platform-denali-customer-delivery.mdoc` |
| Navigator | `docs/phase-20/AGENT-NAVIGATOR.md` |
| P6 closed | `docs/phase-19/p6/AGENT-START.md` |
