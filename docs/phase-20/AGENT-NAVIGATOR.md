# Phase 20 / P7 — Agent navigator

```yaml
navigator_version: "1.1"
sole_entry: p7/AGENT-START.md
machine_snapshot: p7/AGENT-CURRENT-PHASE.yaml
umbrella: platform-denali-customer-delivery.mdoc
doc_architecture: p7/appendices/P7-DOC-ARCHITECTURE.md
decisions: p7/appendices/DEC-P7-INDEX.md
prerequisite_gate: pnpm run p6:gate
p7_gate: pnpm run p7:gate
```

> **Use after** [`p7/AGENT-START.md`](p7/AGENT-START.md). Answers **what to read and do next** without browsing all 27 nanos.

---

## Decision tree (normative)

```text
START
  │
  ├─ IF p6:gate fails
  │    → STOP P7 work — fix P6 regression first
  │    → READ: phase-19/p6/appendices/IMPLEMENTATION-TRUTH-P6.md
  │
  ├─ IF current_task starts with P7-0
  │    → READ: p7-0-live-infra.md · runbooks/p7-0-env-matrix.md · deploy/vps/README.md
  │    → GOAL: four processes on staging · seed · host smoke
  │    → FORBIDDEN: product refactor · gateway
  │    → PROVE: SMK-P7-INFRA-01..03 · verify-env-coherence.sh
  │
  ├─ ELIF current_task starts with P7-1
  │    → PREREQ: P7-0-N-005 complete
  │    → READ: P7-EXECUTION-DISCIPLINE.md · p7-1-wizard-completion.md · runbooks/p7-wizard-blocker-walkthrough.md
  │    → READ: workspaces/denali/wizard-experience.md
  │    → WRITE: P0 blockers only (Z2) — after walkthrough on staging
  │    → FORBIDDEN: move wizard to (app)/ · delete rules/composites (Z1) · code without walkthrough
  │    → PROVE: denali-publish-readiness.spec.ts · staging VS-01
  │
  ├─ ELIF current_task starts with P7-2
  │    → PREREQ: P7-1-N-009 (VS-01 staging)
  │    → READ: p7-2-workspace-ops.md · p6-2-operator-admin.md
  │    → READ: runbooks/first-customer-operator.md
  │    → WRITE: workspace paths under /tours/[id]/workspace only (Z3)
  │    → FORBIDDEN: refactor (app)/ shell · workspace before publish proven
  │    → PROVE: bookings-ops.spec.ts · tours-workspace.spec.ts · VS-06 staging
  │
  ├─ ELIF current_task starts with P7-3
  │    → PREREQ: P7-2 complete
  │    → READ: p7-3-delivery-exit.md · runbooks/p7-customer-sign-off.md
  │    → RUN: T2 E2E staging · T3 finance-ops · T4 sign-off
  │    → PROVE: p7:gate · VS-01..08 staging checklist
  │
  └─ ELSE
       → READ: p7/DOC-SYNC-INDEX.md · IMPLEMENTATION-TRUTH-P7.md
```

---

## EPIC bundle

| EPIC | Spec | P6 carryover |
| ---- | ---- | ------------ |
| P7-0 | `p7/p7-0-live-infra.md` | staging-deploy · first-customer-seed |
| P7-1 | `p7/p7-1-wizard-completion.md` | wizard-experience · preservation |
| P7-2 | `p7/p7-2-workspace-ops.md` | p6-2 tour workspace 3 tabs |
| P7-3 | `p7/p7-3-delivery-exit.md` | vertical slice VS-01..08 live |

---

## FORBIDDEN (P7)

| ID | Rule |
| -- | ---- |
| F-P7-01 | Reopen P6 greenfield |
| F-P7-02 | Delete/move denali rules or composites |
| F-P7-03 | Wizard into `(app)/` refactor |
| F-P7-04 | Skip `p7:gate` / `p6:gate` on any PR |
| F-P7-05 | Workspace work before publish path proven (P7-1) |
| F-P7-06 | Gateway / Stripe / Zibal in P7 |
| F-P7-07 | Code change in api/web/denali without doc-first (phase-20) |
| F-P7-08 | Code before walkthrough or before P7-0-N-005 |
| F-P7-09 | Speculative features / gate specs not tied to staging P0 |

---

## PROVE bands

| Band | Command |
| ---- | ------- |
| REG | `pnpm run p7:gate` |
| STG | `pnpm run p7:staging-verify` |
| T3 | `finance-ops.spec.ts` + staging DATABASE_URL |
| T4 | `runbooks/p7-customer-sign-off.md` |

---

## References

- [platform-denali-customer-delivery.mdoc](platform-denali-customer-delivery.mdoc)
- [p7/appendices/P7-DOC-ARCHITECTURE.md](p7/appendices/P7-DOC-ARCHITECTURE.md)
- [p7/appendices/DEC-P7-INDEX.md](p7/appendices/DEC-P7-INDEX.md)
- [p7/appendices/PACK-EXTENSION-GUIDE.md](p7/appendices/PACK-EXTENSION-GUIDE.md)
- [phase-19/AGENT-NAVIGATOR.md](../phase-19/AGENT-NAVIGATOR.md)
- [p7/appendices/P7-EXECUTION-DISCIPLINE.md](p7/appendices/P7-EXECUTION-DISCIPLINE.md)
- [p7/appendices/P6-P7-BOUNDARY.md](p7/appendices/P6-P7-BOUNDARY.md)
