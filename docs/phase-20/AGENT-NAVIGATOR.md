# Phase 20 / P7 — Agent navigator (v1.6)

```yaml
navigator_version: "1.2"
pack_version: "1.6"
sole_entry: p7/AGENT-START.md
boot_manifest: p7/appendices/P7-BOOT-MANIFEST.yaml
fail_token: P7_FAIL
machine_snapshot: p7/AGENT-CURRENT-PHASE.yaml
anti_hollow: p7/appendices/P7-ANTI-HOLLOW-CONTRACT.md
verification: p7/appendices/P7-VERIFICATION-COMMANDS.yaml
prerequisite_gate: pnpm run p6:gate
p7_gate: pnpm run p7:gate
```

> **Boot:** [P7-BOOT-MANIFEST.yaml](p7/appendices/P7-BOOT-MANIFEST.yaml) T0 sequence **before** this tree. Then use decision tree for EPIC scope.

---

## Decision tree (normative)

```text
START
  │
  ├─ IF boot not from BOOT-MANIFEST
  │    → P7_FAIL · READ appendices/P7-DEPRECATED-ENTRYPOINTS.md
  │
  ├─ IF p6:gate fails
  │    → P7_FAIL · STOP P7 — fix P6 regression
  │    → READ: phase-19/p6/appendices/IMPLEMENTATION-TRUTH-P6.md
  │
  ├─ IF current_task starts with P7-0
  │    → LOAD: P7-VERIFICATION-COMMANDS.yaml#current_task
  │    → READ: p7-0-live-infra.md · linked runbook only
  │    → GOAL: four processes · seed · host smoke
  │    → FORBIDDEN: product refactor · gateway · tick staging from p7:gate alone
  │    → PROVE: expect_token from verification YAML · turn_report required
  │
  ├─ ELIF current_task starts with P7-1
  │    → P7_FAIL IF P7-0-N-005 not STAGING_PASS
  │    → LOAD: verification YAML · p7-1-wizard-completion.md nano block only
  │    → READ: runbooks/p7-wizard-blocker-walkthrough.md (N-001 first)
  │    → FORBIDDEN: wizard (app)/ move · Z1 delete · code without walkthrough §Results
  │    → PROVE: proof_tier from YAML — unit test ≠ staging VS
  │
  ├─ ELIF current_task starts with P7-2
  │    → P7_FAIL IF P7-1-N-009 not STAGING_PASS
  │    → LOAD: verification YAML · p7-2-workspace-ops.md nano block
  │    → FORBIDDEN: (app)/ shell refactor · conditional N-005/N-006 without SKIP doc
  │    → PROVE: VS-06 staging + bookings-ops dev tier separate
  │
  ├─ ELIF current_task starts with P7-3
  │    → LOAD: verification YAML · p7-3-delivery-exit.md
  │    → RUN: T2 · T3 · T4 per gate_chain in BOOT-MANIFEST
  │    → P7_FAIL IF claim BEHAVIORAL_COMPLETE without evidence manifest
  │
  └─ ELSE
       → detect_current_nano · READ IMPLEMENTATION-TRUTH-P7.md
```

---

## EPIC bundle

| EPIC | Spec | verify YAML prefix |
| ---- | ---- | ------------------ |
| P7-0 | `p7/p7-0-live-infra.md` | P7-0-N-* |
| P7-1 | `p7/p7-1-wizard-completion.md` | P7-1-N-* |
| P7-2 | `p7/p7-2-workspace-ops.md` | P7-2-N-* |
| P7-3 | `p7/p7-3-delivery-exit.md` | P7-3-N-* |

---

## FORBIDDEN (P7)

| ID | Rule | fail_token |
| -- | ---- | ---------- |
| F-P7-01 | Reopen P6 greenfield | P7_FAIL |
| F-P7-02 | Delete/move denali rules or composites | P7_FAIL |
| F-P7-03 | Wizard into `(app)/` refactor | P7_FAIL |
| F-P7-04 | Skip `p7:gate` / `p6:gate` on code PR | P7_FAIL |
| F-P7-05 | Workspace before P7-1-N-009 STAGING_PASS | P7_FAIL |
| F-P7-06 | Gateway / Stripe / Zibal in P7 | P7_FAIL |
| F-P7-07 | Code in api/web/denali without doc-first | P7_FAIL |
| F-P7-08 | Code before walkthrough or P7-0-N-005 | P7_FAIL |
| F-P7-09 | Speculative features / hollow gate specs | P7_FAIL |
| F-P7-10 | Boot from AGENT-CONTEXT or umbrella mdoc alone | P7_FAIL |
| F-P7-11 | Update staging column from DEV_STATIC only | P7_FAIL |
| F-P7-12 | Turn without P7-AGENT-TURN-SCHEMA report | P7_FAIL |

---

## PROVE bands (see anti-hollow)

| Band | Command | tier |
| ---- | ------- | ---- |
| REG | `pnpm run p7:gate` | DEV_STATIC |
| STG | `pnpm run p7:staging-gate` | STAGING |
| T2 | `runbooks/p7-staging-e2e.md` | STAGING_E2E |
| T3 | `finance-ops.spec.ts` + DATABASE_URL | STAGING_BEHAVIORAL |
| T4 | `runbooks/p7-customer-sign-off.md` | MANUAL |

---

## References

- [p7/appendices/P7-BOOT-MANIFEST.yaml](p7/appendices/P7-BOOT-MANIFEST.yaml)
- [p7/appendices/P7-ANTI-HOLLOW-CONTRACT.md](p7/appendices/P7-ANTI-HOLLOW-CONTRACT.md)
- [p7/appendices/P7-AGENT-TURN-SCHEMA.md](p7/appendices/P7-AGENT-TURN-SCHEMA.md)
- [p7/appendices/P7-TEST-INVENTORY.md](p7/appendices/P7-TEST-INVENTORY.md)
