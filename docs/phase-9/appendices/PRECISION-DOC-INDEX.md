# Phase 9 — Precision doc index

```yaml
index_version: "2026-06-08-v12"
sole_entry: ../phase-9-agent-router.md
doc_pack_target: 96
doc_pack_score: 96
files_on_disk: 84
pek_register: scripts/guards/lib/phase-9-doc-hardening.mjs
behavioral_ledger: ../audits/IMPLEMENTATION-TRUTH.md
guard_script: ../../../scripts/guards/phase-9-guard.mjs
charter_gates: 32
integration_depth_estimate: "~96%"
```

> Single index for every PEK file under `docs/phase-9/`. Readiness is **doc/structural** unless IMPLEMENTATION-TRUTH marks `VERIFIED_BEHAVIORAL`.

## Readiness enum

| State                      | Meaning                                             |
| -------------------------- | --------------------------------------------------- |
| `VERIFIED_SCAFFOLD`        | On disk · guard-valid · no behavioral code required |
| `LOCKED_SPEC`              | Architect-approved — change requires waiver         |
| `SPEC_ONLY`                | Executable spec — trunk implementation **ABSENT**   |
| `READY_FOR_IMPLEMENTATION` | Doc pack complete for subphase — code may start     |
| `ABSENT_BEHAVIORAL`        | Spec scaffold exists · handlers not on trunk        |

---

## T0 — Sole entry & covenant

| Path                                                                  | Purpose                              | Readiness           | Verification                      |
| --------------------------------------------------------------------- | ------------------------------------ | ------------------- | --------------------------------- |
| [`phase-9-agent-router.md`](../phase-9-agent-router.md)               | SOLE execution entry                 | `VERIFIED_SCAFFOLD` | `p9_boot_manifest`                |
| [`AGENT-NAVIGATOR.md`](../AGENT-NAVIGATOR.md)                         | Decision tree · scaffold guide       | `VERIFIED_SCAFFOLD` | manual · ≥12 nodes                |
| [`phase-9-charter.md`](../phase-9-charter.md)                         | Epic · invariants · TQ               | `VERIFIED_SCAFFOLD` | `p9_technical_quality`            |
| [`appendices/BOOT-MANIFEST.yaml`](BOOT-MANIFEST.yaml)                 | Boot · dependency_graph · prove_with | `VERIFIED_SCAFFOLD` | `p9_boot_manifest`                |
| [`audits/IMPLEMENTATION-TRUTH.md`](../audits/IMPLEMENTATION-TRUTH.md) | Honesty ledger · 9.1 attestation     | `VERIFIED_SCAFFOLD` | `p9_truth_honesty`                |
| [`AGENT-CURRENT-PHASE.yaml`](AGENT-CURRENT-PHASE.yaml)                | «الان کجاییم؟» machine snapshot      | `VERIFIED_SCAFFOLD` | BOOT `detect_current_subphase` v2 |
| [`audits/verification-matrix.md`](../audits/verification-matrix.md)   | REQ-P9-001..083                      | `VERIFIED_SCAFFOLD` | `p9_verification_matrix`          |
| [`phase-9-guards.md`](../phase-9-guards.md)                           | 28-gate matrix                       | `VERIFIED_SCAFFOLD` | direct guard run                  |

---

## T0 — Locked specs

| Path                                                         | Purpose                      | Readiness           | Verification               |
| ------------------------------------------------------------ | ---------------------------- | ------------------- | -------------------------- |
| [`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md) | DEC-P9-001..017              | `LOCKED_SPEC`       | `p9_decisions_locked`      |
| [`CASL-OPERATOR-SPEC.md`](CASL-OPERATOR-SPEC.md)             | Operator session + abilities | `LOCKED_SPEC`       | `p9_operator_spec_depth`   |
| [`ADMIN-ROUTE-MATRIX.md`](ADMIN-ROUTE-MATRIX.md)             | HTTP + web ACL + wizard      | `LOCKED_SPEC`       | `p9_admin_route_matrix`    |
| [`OPERATOR-PRODUCT-SCOPE.md`](OPERATOR-PRODUCT-SCOPE.md)     | Scope + explicit OUT         | `LOCKED_SPEC`       | `p9_product_scope_out`     |
| [`PHASE-BOUNDARY-MATRIX.yaml`](PHASE-BOUNDARY-MATRIX.yaml)   | PR boundary 9.1–9.7          | `VERIFIED_SCAFFOLD` | `p9_boundary_matrix_depth` |

---

## T1 — Integration maps

| Path                                                         | Purpose                           | Verification           |
| ------------------------------------------------------------ | --------------------------------- | ---------------------- |
| [`TRACEABILITY-MAP.md`](TRACEABILITY-MAP.md)                 | Master REQ ↔ spec ↔ SMK rollup    | `p9_traceability_map`  |
| [`TRACEABILITY-MATRIX-9.1.md`](TRACEABILITY-MATRIX-9.1.md)   | 9.1 detail matrix                 | `p9_traceability_9_1`  |
| [`TRACEABILITY-MATRIX-9.2.md`](TRACEABILITY-MATRIX-9.2.md)   | 9.2 admin shell matrix            | `p9_traceability_9_2`  |
| [`TRACEABILITY-MATRIX-9.3.md`](TRACEABILITY-MATRIX-9.3.md)   | 9.3 tours list matrix             | `p9_traceability_9_3`  |
| [`TRACEABILITY-MATRIX-9.4.md`](TRACEABILITY-MATRIX-9.4.md)   | 9.4 users directory matrix        | `p9_traceability_9_4`  |
| [`TRACEABILITY-MATRIX-9.7.md`](TRACEABILITY-MATRIX-9.7.md)   | 9.7 finance command center matrix | `p9_traceability_9_7`  |
| [`TRACEABILITY-MATRIX-9.5.md`](TRACEABILITY-MATRIX-9.5.md)   | 9.5 Command Center matrix         | `p9_traceability_9_5`  |
| [`TRACEABILITY-MATRIX-9.6.md`](TRACEABILITY-MATRIX-9.6.md)   | 9.6 settings registry matrix      | `p9_traceability_9_6`  |
| [`SPEC-REGISTRY-9.1.yaml`](SPEC-REGISTRY-9.1.yaml)           | 9.1 prove_with                    | `p9_prove_with_parity` |
| [`SPEC-REGISTRY-OPERATOR.yaml`](SPEC-REGISTRY-OPERATOR.yaml) | 9.2–9.8 prove_with                | BOOT-MANIFEST sync     |
| [`action-registry.md`](action-registry.md)                   | P9-\* actions + evidence          | manual cross-walk      |
| [`SMOKE-SCENARIO-MAP.md`](SMOKE-SCENARIO-MAP.md)             | SMK-P9-01..08                     | `p9_smoke_map_present` |
| [`env-runtime-matrix.md`](env-runtime-matrix.md)             | Env profiles v2                   | REQ-P9-010 env rows    |

---

## T1 — Dispatch addendums

| Path                                                                                 | Subphase                            |
| ------------------------------------------------------------------------------------ | ----------------------------------- |
| [`identity-api-dispatch-addendum.md`](identity-api-dispatch-addendum.md)             | 9.1 v2 dispatch                     |
| [`identity-web-bff-addendum.md`](identity-web-bff-addendum.md)                       | 9.1 BFF routes                      |
| [`OPERATOR-LOGIN-FLOW.md`](OPERATOR-LOGIN-FLOW.md)                                   | 9.1 login legacy parity             |
| [`ADMIN-SHELL-UX.md`](ADMIN-SHELL-UX.md)                                             | 9.2 mobile-first shell architecture |
| [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md)                                               | 9.3 operator tours list             |
| [`USERS-DIRECTORY-UX.md`](USERS-DIRECTORY-UX.md)                                     | 9.4 users directory · 3-tier RBAC   |
| [`tours-operator-api-dispatch-addendum.md`](tours-operator-api-dispatch-addendum.md) | 9.3 v2 dispatch                     |
| [`users-api-dispatch-addendum.md`](users-api-dispatch-addendum.md)                   | 9.4 v2 dispatch                     |
| [`bookings-api-dispatch-addendum.md`](bookings-api-dispatch-addendum.md)             | 9.5 v2 registry                     |
| [`BOOKINGS-OPS-UX.md`](BOOKINGS-OPS-UX.md)                                           | 9.5 Command Center architecture     |
| [`settings-api-dispatch-addendum.md`](settings-api-dispatch-addendum.md)             | 9.6 v2 registry                     |
| [`SETTINGS-MODULE-REGISTRY.md`](SETTINGS-MODULE-REGISTRY.md)                         | 9.6 architecture                    |
| [`SETTINGS-RISK-REGISTER-P9.md`](SETTINGS-RISK-REGISTER-P9.md)                       | 9.6 risks                           |
| [`finance-api-dispatch-addendum.md`](finance-api-dispatch-addendum.md)               | 9.7 v2 dispatch                     |
| [`FINANCE-OPS-UX.md`](FINANCE-OPS-UX.md)                                             | 9.7 finance command center          |
| [`FINANCE-RISK-REGISTER-P9.md`](FINANCE-RISK-REGISTER-P9.md)                         | 9.7 finance risks                   |

---

## T1 — Agent state maps

| Path                                                   | States           | Subphase |
| ------------------------------------------------------ | ---------------- | -------- |
| [`AGENT-STATE-MAP-9.0.yaml`](AGENT-STATE-MAP-9.0.yaml) | ASM-9.0-001..004 | 9.0      |
| [`AGENT-STATE-MAP-9.1.yaml`](AGENT-STATE-MAP-9.1.yaml) | ASM-9.1-001..008 | 9.1      |
| [`AGENT-STATE-MAP-9.2.yaml`](AGENT-STATE-MAP-9.2.yaml) | ASM-9.2-001..012 | 9.2      |
| [`AGENT-STATE-MAP-9.3.yaml`](AGENT-STATE-MAP-9.3.yaml) | ASM-9.3-001..014 | 9.3      |
| [`AGENT-STATE-MAP-9.7.yaml`](AGENT-STATE-MAP-9.7.yaml) | ASM-9.7-001..020 | 9.7      |
| [`AGENT-STATE-MAP-9.8.yaml`](AGENT-STATE-MAP-9.8.yaml) | ASM-9.8-001..006 | 9.8      |
| [`AGENT-STATE-MAP-9.6.yaml`](AGENT-STATE-MAP-9.6.yaml) | ASM-9.6-001..012 | 9.6      |

---

## T1 — ERIP COPs (9.1–9.8)

| Path                                                                       | Status |
| -------------------------------------------------------------------------- | ------ |
| [`erip/9.1-cop-identity-port.md`](erip/9.1-cop-identity-port.md)           | DRAFT  |
| [`erip/9.2-cop-admin-shell.md`](erip/9.2-cop-admin-shell.md)               | DRAFT  |
| [`erip/9.3-cop-tours-operator.md`](erip/9.3-cop-tours-operator.md)         | DRAFT  |
| [`erip/9.4-cop-users-rbac.md`](erip/9.4-cop-users-rbac.md)                 | DRAFT  |
| [`erip/9.5-cop-bookings-ops.md`](erip/9.5-cop-bookings-ops.md)             | DRAFT  |
| [`erip/9.6-cop-settings-templates.md`](erip/9.6-cop-settings-templates.md) | DRAFT  |
| [`erip/9.7-cop-finance-denali.md`](erip/9.7-cop-finance-denali.md)         | DRAFT  |
| [`erip/9.8-cop-operator-dod.md`](erip/9.8-cop-operator-dod.md)             | DRAFT  |

---

## Guard ↔ file mapping

| Guard check                | Files enforced                             |
| -------------------------- | ------------------------------------------ |
| `p9_doc_hardening`         | 64 paths in `REQUIRED_PHASE9_PEK_FILES`    |
| `p9_traceability_map`      | `TRACEABILITY-MAP.md` · REQ-P9-083         |
| `p9_boundary_matrix_depth` | `PHASE-BOUNDARY-MATRIX.yaml` subphase*9*\* |
| `p9_prove_with_parity`     | `SPEC-REGISTRY-9.1.yaml` ↔ BOOT 9.1        |
| `p9_hardening_artifacts`   | schemas · CASL · dispatch addendums        |
| `p9_truth_honesty`         | IMPLEMENTATION-TRUTH · **24/24** sync      |

---

## Spec scaffolds on trunk (operator rail)

| Path                                                            | Subphase | Status                              |
| --------------------------------------------------------------- | -------- | ----------------------------------- |
| `apps/api/test/identity-*.spec.ts`                              | 9.1      | SCAFFOLD                            |
| `packages/workspace-sdk/test/operator-ability.spec.ts`          | 9.1      | SCAFFOLD                            |
| `apps/web/test/auth-login-access.spec.ts`                       | 9.1      | partial green (contract)            |
| `apps/web/test/auth-login-flow.spec.ts`                         | 9.1      | SCAFFOLD                            |
| `apps/web/test/admin-shell-access.spec.ts`                      | 9.2      | SCAFFOLD                            |
| `apps/web/test/dashboard-smoke.spec.ts`                         | 9.2      | SCAFFOLD                            |
| `apps/api/test/tours-operator.spec.ts`                          | 9.3      | SCAFFOLD                            |
| `apps/web/test/tours-list.spec.ts`                              | 9.3      | SCAFFOLD                            |
| `packages/workspaces/denali/test/tour-list-projection.spec.ts`  | 9.3      | VERIFIED (projection R0)            |
| `apps/api/test/identity-users.spec.ts`                          | 9.4      | SCAFFOLD                            |
| `apps/web/test/users-directory.spec.ts`                         | 9.4      | SCAFFOLD                            |
| `apps/api/test/bookings-ops.spec.ts`                            | 9.5      | SCAFFOLD                            |
| `apps/api/test/bookings-create.spec.ts`                         | 9.5      | SCAFFOLD                            |
| `apps/web/test/bookings-approve.spec.ts`                        | 9.5      | SCAFFOLD                            |
| `apps/web/test/bookings-command-center.spec.ts`                 | 9.5      | SCAFFOLD                            |
| `packages/workspace-sdk/test/bookings-ops-manifest.spec.ts`     | 9.5      | VERIFIED (manifest validate)        |
| `packages/workspaces/denali/test/bookings-ops-manifest.spec.ts` | 9.5      | VERIFIED (manifest R0)              |
| `apps/api/test/settings-modules.spec.ts`                        | 9.6      | SCAFFOLD                            |
| `apps/api/test/settings-resources.spec.ts`                      | 9.6      | SCAFFOLD                            |
| `apps/api/test/settings-config-version.spec.ts`                 | 9.6      | SCAFFOLD                            |
| `apps/api/test/settings-audit-trail.spec.ts`                    | 9.6      | SCAFFOLD                            |
| `apps/web/test/settings-template.spec.ts`                       | 9.6      | SCAFFOLD                            |
| `apps/web/test/settings-generic-crud.spec.ts`                   | 9.6      | SCAFFOLD                            |
| `packages/workspace-sdk/test/settings-manifest.spec.ts`         | 9.6      | VERIFIED (manifest validate)        |
| `packages/workspaces/denali/test/settings-manifest.spec.ts`     | 9.6      | VERIFIED (manifest R0)              |
| `packages/workspaces/denali/test/finance-admin.spec.ts`         | 9.7      | IMPLEMENTED                         |
| `apps/api/test/finance-ops.spec.ts`                             | 9.7      | IMPLEMENTED (requires DATABASE_URL) |
| `apps/web/test/finance-page.spec.ts`                            | 9.7      | SCAFFOLD (nav helper only)          |
| `apps/web/test/phase-9.contract.spec.ts`                        | 9.8      | SCAFFOLD                            |
| `apps/web/test/operator-smoke.spec.ts`                          | 9.8      | SCAFFOLD                            |

---

## Machine read order

1. `IMPLEMENTATION-TRUTH.md`
2. `phase-9-charter.md`
3. `BOOT-MANIFEST.yaml`
4. Active subphase spec (`subphases/{n}.md`)
5. `TRACEABILITY-MAP.md` + subphase traceability
6. `PHASE-BOUNDARY-MATRIX.yaml` before any PR
