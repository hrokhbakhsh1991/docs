# Phase 8 — Agent navigator («قدم بعدی چیست؟»)

```yaml
navigator_version: "2026-06-08-v1"
sole_entry: phase-8-agent-router.md
machine_snapshot: appendices/AGENT-CURRENT-PHASE.yaml
scaffold_sot: ../../TEMP/phase8-wip-specs/README.md
roadmap: ../../TEMP/phase8-doc-95plus-plan.md
decision_nodes: 10
```

> **Use after** [`phase-8-agent-router.md`](phase-8-agent-router.md) step 2 ([`IMPLEMENTATION-TRUTH`](audits/IMPLEMENTATION-TRUTH.md)). This file answers **what to read and do next** without browsing the full PEK.

---

## Decision tree (normative)

```text
START
  │
  ├─ IF phase_7_gate.status != PASS in reports/phase-8-entry-verified.yaml (TG-P8-001)
  │    → STOP at subphase 8.0
  │    → READ: subphases/8.0-entry.md · reports/phase-8-entry-verified.yaml
  │    → RUN: pnpm run phase-7:gate (or GHA phase-7-gate workflow)
  │    → DO NOT start 8.1+ behavioral work
  │
  ├─ ELIF subphase_8_0 != VERIFIED_ENTRY
  │    → READ: subphases/8.0-entry.md
  │    → UPDATE: reports/phase-8-entry-verified.yaml · IMPLEMENTATION-TRUTH
  │    → RUN: pnpm run guard:import-boundary
  │
  ├─ ELIF doc_ready_subphase == "8.1" AND trunk auth ABSENT
  │    → READ: TEMP/phase8-wip-specs/README.md § T-8.1
  │    → READ: subphases/8.1-single-owner-auth.md · CASL-URBAN-OWNER-SPEC.md
  │    → READ: erip/8.1-cop-auth-isolation.md · AGENT-STATE-MAP-8.1.yaml
  │    → CHOICE: doc-only OR promote T-8.1 (Architect YES) OR implement 8.1
  │    → FORBIDDEN: catalog routes · lazy-urban-plugin extend · packages/workspaces/urban/**
  │
  ├─ ELIF implementing 8.1 auth handlers
  │    → READ: urban-api-dispatch-addendum.md · PHASE-BOUNDARY-MATRIX.yaml
  │    → WRITE: only paths in subphase_8_1_extended_boundaries (PHASE-BOUNDARY-MATRIX)
  │    → PROVE: 6 specs in SPEC-REGISTRY-8.1.yaml (promote T-8.1 if absent on trunk)
  │    → RUN: pnpm run guard:p8-boundary-diff on PR diff
  │
  ├─ ELIF doc_ready >= "8.2" AND subphase_8_1 != VERIFIED_BEHAVIORAL (TG-P8-002)
  │    → FAIL TG-P8-002 — close 8.1 before catalog/product port
  │
  ├─ ELIF doc_ready_subphase == "8.2"
  │    → READ: subphases/8.2-urban-features.md · URBAN-PRODUCT-SCOPE.md · LEGACY-URBAN-REFERENCE
  │    → WRITE: packages/workspaces/urban/** · lazy-urban-plugin extend · urban HTTP routes
  │    → PROVE: urban-catalog-registration.spec.ts · workspace-urban build+test
  │
  ├─ ELIF doc_ready in {8.3, 8.4} AND 8.2 not VERIFIED_BEHAVIORAL (TG-P8-003)
  │    → FAIL TG-P8-003 — parallel hardening requires 8.2 closed
  │
  ├─ ELIF doc_ready_subphase == "8.3"
  │    → READ: subphases/8.3-silo-tier.md · TENANT-ROUTER-SPEC (phase-7)
  │    → WRITE: packages/tenant-kernel/** silo URL wiring only
  │    → PROVE: tenant-connection-router.spec.ts · urban-silo-fixture.spec.ts
  │
  ├─ ELIF doc_ready_subphase == "8.4"
  │    → READ: subphases/8.4-e2e-integrity.md · SMOKE-SCENARIO-MAP.md
  │    → PROVE: test:e2e:urban · urban-e2e-http.spec.ts · SMK-P8-01..04
  │
  ├─ ELIF doc_ready_subphase == "8.5"
  │    → READ: subphases/8.5-platform-dod.md
  │    → RUN: pnpm run phase-8:gate (Architect YES only)
  │    → PROVE: phase-8.contract.spec.ts · forensic ≥ 8
  │
  ├─ ELIF task is doc-only sync
  │    → READ: TEMP/phase8-doc-95plus-plan.md current sprint
  │    → RUN: pnpm run phase-8:guard
  │    → UPDATE: IMPLEMENTATION-TRUTH · AGENT-CURRENT-PHASE.yaml
  │
  └─ ELSE unknown state
       → RE-READ: IMPLEMENTATION-TRUTH · BOOT-MANIFEST detect_current_subphase
       → EMIT: FAIL — cite blocker ID · halt
```

---

## Per-subphase file bundle (quick index)

| Subphase | Subphase spec              | Authority                                        | Dispatch / ASM                           | Traceability                        | Prove_with            |
| -------- | -------------------------- | ------------------------------------------------ | ---------------------------------------- | ----------------------------------- | --------------------- |
| **8.0**  | `subphases/8.0-entry.md`   | phase-7-bridge                                   | —                                        | verification-matrix REQ-P8-001..009 | `phase-7:gate`        |
| **8.1**  | `8.1-single-owner-auth.md` | CASL-URBAN-OWNER-SPEC · TOURS-PUBLISH-FIELD-GATE | urban-api-dispatch · AGENT-STATE-MAP-8.1 | TRACEABILITY-MATRIX-8.1             | T-8.1 train (6 specs) |
| **8.2**  | `8.2-urban-features.md`    | URBAN-PRODUCT-SCOPE                              | —                                        | verification-matrix REQ-P8-020..023 | workspace-urban test  |
| **8.3**  | `8.3-silo-tier.md`         | TENANT-ROUTER-SPEC (P7)                          | —                                        | REQ-P8-030..032                     | tenant-kernel test    |
| **8.4**  | `8.4-e2e-integrity.md`     | SMOKE-SCENARIO-MAP                               | —                                        | SMK-P8-01..04                       | `test:e2e:urban`      |
| **8.5**  | `8.5-platform-dod.md`      | phase-8-charter § closure                        | —                                        | FORENSIC-RUBRIC (8.5)               | `phase-8:gate`        |

---

## Common failure modes (do not loop)

| Symptom                                       | Cause                          | Fix                                                                        |
| --------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `phase-8:guard` fails `p8_spec_path_registry` | T-8.1 not promoted             | `TEMP/phase8-wip-specs/README.md` (historical local scratch `README.md`; not fresh-clone authority — see docs/audits/snapshots/2026-07-31/psr-2b-temp-authority-inventory.yaml) |
| prove_with exits ENOENT                       | spec absent on trunk           | promote train · do not invent paths                                        |
| Wrote `lazy-urban-plugin.ts` in 8.1 PR        | violated PHASE-BOUNDARY-MATRIX | revert · defer to 8.2                                                      |
| Wrote `packages/workspaces/urban/**` in 8.1   | TG-P8-002 boundary             | revert · 8.1 = auth rail only                                              |
| `admin` passes urban settings PATCH           | violated DEC-P8-001            | use `isWorkspaceOwner` not `isAdminOrOwner`                                |
| platform-core diff on PR                      | INV-P8-001                     | revert · plugin/SDK only                                                   |
| Copied broken command from matrix table       | pipe in markdown cell          | use [`verification-commands.md`](appendices/verification-commands.md)      |

---

## Fast commands by intent

| Intent             | Command                                 |
| ------------------ | --------------------------------------- |
| Doc attestation    | `pnpm run phase-8:guard`                |
| Full closure       | `pnpm run phase-8:gate` (Architect YES) |
| 8.1 PR boundary    | `pnpm run guard:p8-boundary-diff`       |
| Entry prerequisite | `pnpm run phase-7:gate`                 |
| Changed tests only | `pnpm run test:changed`                 |
| Pre-commit         | `pnpm run pre-commit:fast`              |

---

## Sync obligation

After any doc PR touching subphase status or scaffolds:

1. Update [`IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md) § scaffold promote table
2. Update [`AGENT-CURRENT-PHASE.yaml`](appendices/AGENT-CURRENT-PHASE.yaml)
3. Run `pnpm run phase-8:guard`
