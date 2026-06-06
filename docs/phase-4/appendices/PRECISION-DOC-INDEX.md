# Phase 4 — Precision documentation pack (pre-code)

```yaml
pack_meta:
  date: "2026-06-04"
  purpose: "+10 doc precision before implementation PRs"
  agent_load_tier: T0_execution
  load_when: "starting any subphase 4.0–4.6 or planning closure"
  execution_truth: "Doc 100 ≠ code done — see IMPLEMENTATION-TRUTH.md"
```

> **Rule:** Read **current subphase** in [`SUBPHASE-READY-SPEC.md`](../audits/SUBPHASE-READY-SPEC.md) first, then atlas + inventory rows for that subphase only.

---

## Pack modules

| Module | File | Use |
|--------|------|-----|
| **Ready spec** | [`audits/SUBPHASE-READY-SPEC.md`](../audits/SUBPHASE-READY-SPEC.md) | Definition of Ready + Done per 4.x |
| **P4-E commands** | [`p4-e-command-atlas.md`](p4-e-command-atlas.md) | Copy-paste `pnpm` per enforcement id |
| **Test inventory** | [`test-inventory.md`](test-inventory.md) | Every spec file → P4-E / subphase |
| **Env matrix** | [`env-runtime-matrix.md`](env-runtime-matrix.md) | `.env` + Docker + storage driver |
| **Handoff 3→4→5** | [`phase-handoff-3-4-5.md`](phase-handoff-3-4-5.md) | Boundaries + forbidden regression |
| **Agent FAQ** | [`agent-faq.md`](agent-faq.md) | FAIL traps (DRIFT, hollow, wrong env) |
| **Closure** | [`audits/CLOSURE-CHECKLIST.md`](../audits/CLOSURE-CHECKLIST.md) | 4.6 only |
| **Gaps closed** | [`audits/PHASE-4-GAP-REGISTER.md`](../audits/PHASE-4-GAP-REGISTER.md) | Audit history |

---

## Load order (agent)

```yaml
precision_boot:
  1: audits/IMPLEMENTATION-TRUTH.md
  2: audits/SUBPHASE-READY-SPEC.md#subphase_{current}
  3: appendices/p4-e-command-atlas.md#rows_for_current_subphase
  4: appendices/test-inventory.md#rows_for_current_subphase
  5: subphases/{current}.md
  6_on_4_2: appendices/storage-driver-truth.md
  7_on_4_6: audits/CLOSURE-CHECKLIST.md
```

---

## Doc quality target (this pack)

| Metric | Before wave 2 | After wave 3 (precision pack) |
|--------|---------------|-------------------------------|
| Doc composite (honest) | 92 | **100** |
| Execution / closure | 29 | unchanged until code |
