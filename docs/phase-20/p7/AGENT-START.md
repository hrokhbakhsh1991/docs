# P7 Agent — start here

```yaml
phase: 20
pack: P7
pack_version: "1.2"
status: IN_PROGRESS
prerequisite: P6 complete (pnpm run p6:gate)
current_task: P7-0-N-002
doc_sot: docs/phase-20/platform-denali-customer-delivery.mdoc
p6_gate: pnpm run p6:gate
p7_gate: pnpm run p7:gate
machine_snapshot: AGENT-CURRENT-PHASE.yaml
truth: appendices/IMPLEMENTATION-TRUTH-P7.md
discipline: appendices/P7-EXECUTION-DISCIPLINE.md
```

## What P7 is

**تحویل اولین مشتری Denali** — P6 زنجیره محصول را بست؛ P7 آن را **زنده** می‌کند.

**نه:** محصول جدید · refactor · فیچر اضافه — فقط staging proof + P0 blocker fix.

| EPIC | یک خط |
| ---- | ----- |
| P7-0 | staging + seed + env واقعی |
| P7-1 | تکمیل wizard/settings موجود (بدون rebuild) |
| P7-2 | workspace Denali — فقط additive برای ops روز اول |
| P7-3 | verify · sign-off · `p7:gate` |

## Read order

1. [appendices/IMPLEMENTATION-TRUTH-P7.md](appendices/IMPLEMENTATION-TRUTH-P7.md) — **repo truth first**
2. [appendices/P7-EXECUTION-DISCIPLINE.md](appendices/P7-EXECUTION-DISCIPLINE.md) — **no fake work**
2. [appendices/P7-EXECUTION-DISCIPLINE.md](appendices/P7-EXECUTION-DISCIPLINE.md) — walkthrough-before-code
3. [appendices/P7-DOC-ARCHITECTURE.md](appendices/P7-DOC-ARCHITECTURE.md) — C4 · traceability spine
4. [appendices/DEC-P7-INDEX.md](appendices/DEC-P7-INDEX.md) — frozen decisions
5. [appendices/P6-P7-BOUNDARY.md](appendices/P6-P7-BOUNDARY.md) — frozen vs mutable
6. [../p7-implementation-standards.mdoc](../p7-implementation-standards.mdoc)
7. [platform-denali-customer-delivery.mdoc](../platform-denali-customer-delivery.mdoc)
8. [AGENT-NAVIGATOR.md](../AGENT-NAVIGATOR.md)
9. [DOC-SYNC-INDEX.md](DOC-SYNC-INDEX.md) → EPIC spec فعلی
10. [appendices/TRACEABILITY-MATRIX-P7.md](appendices/TRACEABILITY-MATRIX-P7.md)
11. P6 regression: [phase-19/p6/appendices/IMPLEMENTATION-TRUTH-P6.md](../../phase-19/p6/appendices/IMPLEMENTATION-TRUTH-P6.md)

## Loop

```text
DOC-SYNC current_task
  → read P7-EXECUTION-DISCIPLINE.md
  → doc-first (phase-20) if code needed
  → ONE nano OR one walkthrough P0 fix
  → pnpm run p7:gate (includes p6:gate)
  → staging proof when infra ready
  → update IMPLEMENTATION-TRUTH-P7 + p7-exit-checklist staging column
```

## Zones

- **Z1 Freeze:** wizard · rules · composites
- **Z2 Complete:** فیلدهای ناقص همان استپ‌ها
- **Z3 Additive:** workspace tabs/routes جدید
- **Z4 Later:** بعد از sign-off — [POST-P7-HORIZON.md](appendices/POST-P7-HORIZON.md)

## Status: P7 active

**Current nano:** `P7-0-N-002` — env matrix verified.  
Machine state → [AGENT-CURRENT-PHASE.yaml](AGENT-CURRENT-PHASE.yaml).

## Gate

```bash
pnpm run p7:gate
pnpm run p7:staging-verify   # when API reachable on staging
```
