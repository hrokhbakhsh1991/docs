# Phase 5 — Gap register (critical audit)

```yaml
register_meta:
  date: "2026-06-04"
  workflow: [discover, solution, doc_implementation, repo_verify]
  honest_scores: AI-READABILITY-REPORT.md#critical-dual-score-2026-06-04
  implementation_truth: IMPLEMENTATION-TRUTH.md
  gate_binding: "phase-5:gate ok + phase-4:gate ok + 7/7 VERIFIED"
```

> **Rule:** `phase-5-guard` PASS = **scaffold** (5.1). **Not** outbox/relay/audit behavior (5.2–5.5).

---

## Summary

| ID        | Gap                                           | Doc fix                              | Repo verify                                                                                |
| --------- | --------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| GAP-P5-01 | Doc **100** implied code done                 | Dual score + scaffold vs behavioral  | IMPLEMENTATION-TRUTH                                                                       |
| GAP-P5-02 | No CONSISTENCY/TRACEABILITY audit             | New CONSISTENCY-REPORT + matrix note | —                                                                                          |
| GAP-P5-03 | `phase-5.contract.spec` = file existence only | test-inventory `scaffold_only`       | **RESOLVED** — 5.2–5.5 behavioral specs in dedicated files; contract spec labeled SCAFFOLD |
| GAP-P5-04 | `phase-5-entry-verified.yaml` all PENDING     | Entry checklist doc + yaml guide     | **RESOLVED** — yaml blocking fields PASS 2026-06-04                                        |
| GAP-P5-05 | layer4 monolith drift                         | T0 forbid + PRECISION pack           | —                                                                                          |
| GAP-P5-06 | phase-5:gate nested phase-4                   | ci.md + FAQ                          | phase-4:gate                                                                               |
| GAP-P5-07 | No forensic / closure checklist               | SCAFFOLD mdoc + CLOSURE-CHECKLIST    | 5.6                                                                                        |

**Doc implementation:** all rows **DONE** (wave critical + precision). **Repo:** 5.2–5.5 VERIFIED_BEHAVIORAL per IMPLEMENTATION-TRUTH (behavioral **86%**); 5.6 gate partial.

**Enterprise sprint (TEMP, closed 2026-06-05):** see [`ENTERPRISE-GAP-REGISTER.md`](ENTERPRISE-GAP-REGISTER.md) — deferred post–Phase 6 main: **P1-14** OTel, **P1-19** bulk import, **P2-5** connection-budget code.

---

## GAP-P5-01 — Inflated doc composite

**Discover:** AI-READABILITY claimed **100** with 5.2–5.5 `SPEC_ONLY`.

**Solution:** Split **doc navigation 100** · **scaffold 43** · **behavioral 86** (5.2–5.5 VERIFIED; 5.1 scaffold; 5.6 partial).

**Doc:** AI-READABILITY critical dual score · IMPLEMENTATION-TRUTH `scaffold_vs_behavioral`.

---

## GAP-P5-03 — Contract spec honesty

**Discover:** `phase-5.contract.spec.ts` asserts files exist — not TourCreated→handler, not outbox relay.

**Solution:** Label **SCAFFOLD-REQ-P5-024** until 5.4 adds integration tests. Guard `p5_contract_spec` = scaffold gate only.

**Doc:** [`appendices/test-inventory.md`](../appendices/test-inventory.md) · anti-hollow contract update.

---

## GAP-P5-04 — Entry gate yaml stale

**Discover:** `reports/phase-5-entry-verified.yaml` shows `PENDING` for phase-4 gate and postgres SoT.

**Solution:** Document update procedure in CLOSURE-CHECKLIST 5.0; do not mark 5.0 VERIFIED until yaml fields PASS.

**Doc:** [`subphases/5.0-entry-gate.md`](../subphases/5.0-entry-gate.md) cross-link.

---

## Agent rule

```yaml
forbidden:
  - "5.6 VERIFIED because phase-5-guard json ok:true alone"
  - "5.4 PASS without outbox relay integration test"
required_read:
  - appendices/PRECISION-DOC-INDEX.md
  - audits/SUBPHASE-READY-SPEC.md
```
