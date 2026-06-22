# Phase 20 / P7 — Agent navigator (sketch)

```yaml
navigator_version: "0.1"
sole_entry: p7/AGENT-START.md
umbrella: platform-denali-customer-delivery.mdoc
prerequisite_gate: pnpm run p6:gate
```

> **v0.1 — نقشه کلی.** nano و gate کامل بعداً در بسط pack اضافه می‌شود.

---

## Decision tree

```text
START
  │
  ├─ IF P6 not complete (p6:gate fails)
  │    → STOP — fix P6 regression first
  │    → READ: phase-19/p7/AGENT-START.md equivalent (phase-19)
  │
  ├─ ELIF current_task starts with P7-0
  │    → READ: p7-0-live-infra.md · phase-19/p6/runbooks/staging-deploy.md
  │    → GOAL: customer club live on staging URLs
  │    → FORBIDDEN: product code refactor
  │
  ├─ ELIF current_task starts with P7-1
  │    → READ: p7-1-wizard-completion.md · workspaces/denali/wizard-experience.md
  │    → GOAL: real customer tour publishable end-to-end
  │    → FORBIDDEN: wizard host move · rules delete · large UI redesign (Z1)
  │    → PROVE: wizard specs · test:changed on tours/new
  │
  ├─ ELIF current_task starts with P7-2
  │    → PREREQ: P7-1 publish path green
  │    → READ: p7-2-workspace-ops.md · p6-2-operator-admin.md
  │    → GOAL: operator daily ops on ONE real tour
  │    → FORBIDDEN: refactor (app)/ shell · merge workspace into wizard
  │    → PROVE: tours-workspace specs · bookings-ops
  │
  ├─ ELIF current_task starts with P7-3
  │    → READ: p7-3-delivery-exit.md · p6-e2e-smoke.md
  │    → RUN: T2 + T3 + T4 · p7:gate (when wired)
  │
  └─ ELSE
       → READ: p7/DOC-SYNC-INDEX.md
```

---

## EPIC bundle

| EPIC | Spec | P6 carryover |
| ---- | ---- | ------------ |
| P7-0 | `p7-0-live-infra.md` | staging-deploy · first-customer-seed |
| P7-1 | `p7-1-wizard-completion.md` | preservation gate · wizard-experience |
| P7-2 | `p7-2-workspace-ops.md` | tour workspace 3 tabs |
| P7-3 | `p7-3-delivery-exit.md` | vertical slice VS-01..08 live |

---

## FORBIDDEN (P7)

| ID | Rule |
| -- | ---- |
| F-P7-01 | Reopen P6 greenfield |
| F-P7-02 | Delete/move denali rules or composites |
| F-P7-03 | Wizard into `(app)/` refactor |
| F-P7-04 | Skip `p6:gate` on any PR |
| F-P7-05 | Workspace work before publish path proven (P7-1) |

---

## References

- [platform-denali-customer-delivery.mdoc](../platform-denali-customer-delivery.mdoc)
- [phase-19/AGENT-NAVIGATOR.md](../phase-19/AGENT-NAVIGATOR.md)
