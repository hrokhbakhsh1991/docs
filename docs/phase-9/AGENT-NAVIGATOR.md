# Phase 9 — Agent navigator («قدم بعدی چیست؟»)

```yaml
navigator_version: "2026-06-08-v1"
sole_entry: phase-9-agent-router.md
machine_snapshot: appendices/AGENT-CURRENT-PHASE.yaml
scaffold_sot: appendices/SPEC-REGISTRY-OPERATOR.yaml
roadmap: ../../TEMP/phase9-doc-95plus-roadmap.md
decision_nodes: 12
```

> **Use after** [`phase-9-agent-router.md`](phase-9-agent-router.md) step 2 ([`IMPLEMENTATION-TRUTH`](audits/IMPLEMENTATION-TRUTH.md)). This file answers **what to read and do next** without browsing the full PEK.

---

## Decision tree (normative)

```text
START
  │
  ├─ IF phase_8_gate != PASS (TG-P9-001)
  │    → STOP at subphase 9.0
  │    → READ: subphases/9.0-entry.md · reports/phase-9-entry-verified.yaml
  │    → RUN: pnpm run phase-8:gate
  │    → DO NOT start 9.1+ behavioral work
  │
  ├─ ELIF doc_ready_subphase == "9.1" AND identity handlers ABSENT
  │    → READ: subphases/9.1-identity-session.md · IDENTITY-PORT-SCOPE.md · erip/9.1-cop-identity-port.md
  │    → PROVE: identity-otp.spec.ts · identity-session.spec.ts (ON_TRUNK scaffolds)
  │    → BLOCKED until phase_8_gate PASS (TG-P9-001) for behavioral PR
  │
  ├─ ELIF implementing 9.1 identity handlers
  │    → READ: identity-api-dispatch-addendum.md · identity-web-bff-addendum.md · OPERATOR-LOGIN-FLOW.md
  │    → WRITE: apps/api/src/identity/** · apps/web/app/auth/** (doc-first if SDK CASL)
  │    → PROVE: identity-otp.spec.ts · identity-session.spec.ts · auth-login-access.spec.ts
  │
  ├─ ELIF doc_ready_subphase == "9.2"
  │    → READ: subphases/9.2-admin-shell.md · ADMIN-SHELL-UX.md · AGENT-STATE-MAP-9.2.yaml
  │    → WRITE: apps/web/app/(app)/** · apps/web/src/admin/**
  │    → PROVE: admin-shell-access.spec.ts · dashboard-smoke.spec.ts (promote T-9.2 if absent)
  │    → LATER: CP-9.2-11 migrate app/finance → (app)/finance (DEC-P9-017)
  │
  ├─ ELIF doc_ready_subphase == "9.3"
  │    → READ: TOURS-LIST-UX.md · tours-operator-api-dispatch-addendum.md · TRACEABILITY-MATRIX-9.3.md
  │    → FORBIDDEN: (app)/tours/new duplicate wizard (DEC-P9-007)
  │    → PROVE: tours-operator.spec.ts · tours-list.spec.ts
  │
  ├─ ELIF doc_ready_subphase == "9.4"
  │    → READ: USERS-DIRECTORY-UX.md · users-api-dispatch-addendum.md · DEC-P9-015 RBAC vocabulary
  │    → ACTORS: owner | admin | member ONLY — leader/viewer = hydrate aliases
  │    → PROVE: identity-users.spec.ts · users-directory.spec.ts
  │
  ├─ ELIF doc_ready_subphase == "9.5"
  │    → READ: BOOKINGS-OPS-UX.md · bookings-api-dispatch-addendum.md · DEC-P9-011
  │    → /leader/review = URL alias (admin session) — NOT a RBAC role
  │    → PROVE: bookings-ops.spec.ts · bookings-command-center.spec.ts · SMK-P9-06
  │
  ├─ ELIF doc_ready_subphase == "9.6"
  │    → READ: SETTINGS-MODULE-REGISTRY.md · settings-api-dispatch-addendum.md · DEC-P9-009/010
  │    → PROVE: settings-resources.spec.ts · settings-manifest.spec.ts
  │
  ├─ ELIF partial_subphases contains 9.7 PARTIAL_R1
  │    → READ: FINANCE-OPS-UX.md §2.2 gap table · subphases/9.7-finance-denali.md r1_checklist
  │    → INTERIM UI: apps/web/app/finance/** (DEC-P9-017) — NOT only (app)/finance
  │    → API: apps/api/src/denali-finance/** · INV-P9-006 (urban 404)
  │    → DO NOT claim 9.7 closed — R1 reconciliation shipped · R2–R4 prepayment/installments pending
  │    → PROVE: finance-admin.spec.ts · finance-ops.spec.ts · finance-page.spec.ts · reconciliation-triage.spec.ts · SMK-P9-11
  │
  ├─ ELIF doc_ready_subphase == "9.8"
  │    → READ: subphases/9.8-operator-dod-gate.md · SMOKE-SCENARIO-MAP.md · FORENSIC-RUBRIC-P9.md
  │    → RUN: pnpm run phase-9:guard (27/28 min until T-9.1) then phase-9:gate (Architect YES only)
  │    → PROVE: operator-smoke.spec.ts · phase-9.contract.spec.ts
  │
  ├─ ELIF task is doc-only sync
  │    → READ: TEMP/phase9-doc-95plus-roadmap.md current sprint
  │    → RUN: pnpm run phase-9:guard
  │    → UPDATE: IMPLEMENTATION-TRUTH · AGENT-CURRENT-PHASE.yaml
  │
  └─ ELSE unknown state
       → RE-READ: IMPLEMENTATION-TRUTH · BOOT-MANIFEST detect_current_subphase v2
       → EMIT: FAIL — cite blocker ID · halt
```

---

## Per-subphase file bundle (quick index)

| Subphase | Subphase spec               | UX / authority                            | Dispatch                        | Traceability                        | Prove_with          |
| -------- | --------------------------- | ----------------------------------------- | ------------------------------- | ----------------------------------- | ------------------- |
| **9.0**  | `subphases/9.0-entry.md`    | —                                         | —                               | verification-matrix REQ-P9-001..009 | `phase-8:gate`      |
| **9.1**  | `9.1-identity-session.md`   | IDENTITY-PORT-SCOPE · OPERATOR-LOGIN-FLOW | identity-api · identity-web-bff | TRACEABILITY-MATRIX-9.1             | T-9.1 train         |
| **9.2**  | `9.2-admin-shell.md`        | ADMIN-SHELL-UX                            | —                               | TRACEABILITY-MATRIX-9.2             | T-9.2 train         |
| **9.3**  | `9.3-tours-operator.md`     | TOURS-LIST-UX                             | tours-operator-api              | TRACEABILITY-MATRIX-9.3             | T-9.3 train         |
| **9.4**  | `9.4-users-rbac.md`         | USERS-DIRECTORY-UX                        | users-api                       | TRACEABILITY-MATRIX-9.4             | T-9.4 train         |
| **9.5**  | `9.5-bookings-ops.md`       | BOOKINGS-OPS-UX                           | bookings-api                    | TRACEABILITY-MATRIX-9.5             | T-9.5 train         |
| **9.6**  | `9.6-settings-templates.md` | SETTINGS-MODULE-REGISTRY                  | settings-api                    | TRACEABILITY-MATRIX-9.6             | T-9.6 train         |
| **9.7**  | `9.7-finance-denali.md`     | FINANCE-OPS-UX                            | finance-api                     | TRACEABILITY-MATRIX-9.7             | finance-\* on trunk |
| **9.8**  | `9.8-operator-dod-gate.md`  | SMOKE-SCENARIO-MAP                        | —                               | TRACEABILITY-MAP                    | T-9.8 train         |

---

## Common failure modes (do not loop)

| Symptom                                       | Cause                      | Fix                                                                        |
| --------------------------------------------- | -------------------------- | -------------------------------------------------------------------------- |
| `phase-9:guard` fails `p9_spec_path_registry` | T-9.1 not promoted         | `TEMP/phase9-wip-specs/README.md` (historical local scratch `README.md`; not fresh-clone authority — see docs/audits/snapshots/2026-07-31/psr-2b-temp-authority-inventory.yaml) |
| prove_with command exits ENOENT               | spec on trunk absent       | promote train · do not skip guard                                          |
| Built finance under `(app)/finance` only      | ignored DEC-P9-017 interim | use `app/finance/**` until CP-9.2-11                                       |
| Added RBAC role `leader`                      | violated DEC-P9-015        | actor = admin + tour ACL                                                   |
| Claimed 9.7 closed                            | PARTIAL_R1 only            | check r1_checklist · R2–R4 open                                            |
| platform-core diff on PR                      | INV-P9-001                 | revert · move logic to workspace                                           |

---

## Fast commands by intent

| Intent             | Command                                 |
| ------------------ | --------------------------------------- |
| Doc attestation    | `pnpm run phase-9:guard`                |
| Full closure       | `pnpm run phase-9:gate` (Architect YES) |
| 9.1 PR boundary    | `pnpm run guard:p9-boundary-diff`       |
| Changed tests only | `pnpm run test:changed`                 |
| Pre-commit         | `pnpm run pre-commit:fast`              |

---

## Sync obligation

After any doc PR touching subphase status or scaffolds:

1. Update [`IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md) § scaffold promote table
2. Update [`AGENT-CURRENT-PHASE.yaml`](appendices/AGENT-CURRENT-PHASE.yaml)
3. Run `pnpm run phase-9:guard`
