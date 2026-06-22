# P7 Agent — start here

```yaml
phase: 20
pack: P7
pack_version: "0.1"
status: PLANNED
prerequisite: P6 complete
current_task: P7-0-N-001
doc_sot: docs/phase-20/platform-denali-customer-delivery.mdoc
p6_gate: pnpm run p6:gate
```

## What P7 is

**تحویل اولین مشتری Denali** — P6 زنجیره محصول را بست؛ P7 آن را **زنده** می‌کند.

| EPIC | یک خط |
| ---- | ----- |
| P7-0 | staging + seed + env واقعی |
| P7-1 | تکمیل wizard/settings موجود (بدون rebuild) |
| P7-2 | workspace Denali — فقط additive برای ops روز اول |
| P7-3 | verify · sign-off · `p7:gate` |

## Read order

1. [platform-denali-customer-delivery.mdoc](../platform-denali-customer-delivery.mdoc)
2. [AGENT-NAVIGATOR.md](../AGENT-NAVIGATOR.md)
3. [DOC-SYNC-INDEX.md](DOC-SYNC-INDEX.md) → EPIC spec فعلی
4. P6 truth: [phase-19/p6/appendices/IMPLEMENTATION-TRUTH-P6.md](../../phase-19/p6/appendices/IMPLEMENTATION-TRUTH-P6.md)

## Loop (وقتی اجرا شروع شد)

```text
DOC-SYNC current_task
  → doc-first (phase-20)
  → ONE nano
  → pnpm run p6:gate (regression)
  → nano verify
  → update DOC-SYNC + p7-exit-checklist
```

## Zones — یادآوری

- **Z1 Freeze:** wizard · rules · composites
- **Z2 Complete:** فیلدهای ناقص همان استپ‌ها
- **Z3 Additive:** workspace tabs/routes جدید
- **Z4 Later:** بعد از sign-off مشتری

## First task (planned)

**P7-0-N-001** — staging deploy walkthrough — [p7-0-live-infra.md](p7-0-live-infra.md)
