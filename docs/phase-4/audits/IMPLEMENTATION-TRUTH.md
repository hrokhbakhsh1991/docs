# Phase 4 — Implementation truth ledger

```yaml
ledger_meta:
  date: "2026-06-04"
  purpose: "Honest repo state — prevents doc-only or hollow-test false PASS"
  update_rule: "Agent updates row ONLY after prove_with commands exit 0"
  fail_token: FAIL
  anti_hollow: ../appendices/anti-hollow-contract.md
  score_100_requires: "all subphases VERIFIED + phase-4:gate green + all required p4_* PASS"
  gap_register: PHASE-4-GAP-REGISTER.md
  precision_doc_pack: ../appendices/PRECISION-DOC-INDEX.md
  doc_composite_pre_code: 100
```

> **READ FIRST** before any Phase 4 implementation ([`anti-hollow-contract.md`](../appendices/anti-hollow-contract.md) workflow).

## Last guard run (binding)

```yaml
last_guard:
  command: pnpm run phase-4:guard
  report: reports/phase-4-gate-2026-06-04.json
  date: "2026-06-04"
  gitSha: "see working tree at gate run"
  ok: true
  node: "24.x required — nvm use 24 before phase-4:gate"
  env_required:
    DATABASE_URL: "app_tour role (RLS enforced)"
    DATABASE_URL_ADMIN: "postgres owner for CASL resolveById + migrate"
    STORAGE_DRIVER: prisma
  checks_summary:
    p4_red_flag_prerequisite: PASS
    p4_tenant_kernel_build: PASS
    p4_tenant_kernel_test: PASS
    p4_platform_events_build: PASS
    p4_platform_events_test: PASS
    p4_contract_spec: PASS
    p4_no_denali_in_kernel: PASS
    p4_infra_compose: PASS
    p4_anti_hollow_tests: PASS
    p4_rls_integration_tests: PASS
  full_gate: "pnpm run phase-4:gate exit 0 when DATABASE_URL + DATABASE_URL_ADMIN set (docs/phase-4/ci.md)"
```

## Status legend

| Status        | Meaning                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| **VERIFIED**  | Code + non-hollow tests + prove_with green + gate checks for subphase PASS |
| **PARTIAL**   | Some proof real; listed gaps remain                                        |
| **HOLLOW**    | Test file or claim exists but does not assert behavior                     |
| **SPEC_ONLY** | Documented only — no repo behavior yet                                     |

---

## Subphase ledger

| Subphase | Status       | Repo evidence                                                                                                       | Gap / next action                                                                                       |
| -------- | ------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **4.0**  | PARTIAL      | `reports/phase-3.2-red-flag-status-2026-06-04.md`; `p4_red_flag_prerequisite` PASS                                  | R1–R3 track `prove_with` executable commands; human signoff                                             |
| **4.1**  | PARTIAL      | `packages/tenant-kernel/`; guard `p4_tenant_kernel_*` + `p4_contract_spec` **PASS** (Node 24)                       | Subphase `prove_with` + full gate `ok: true` before VERIFIED                                            |
| **4.2**  | **VERIFIED** | `rls-isolation.integration.spec.ts`; `001_tenant_rls.sql`; `reports/phase-4-42-43-ground-truth-audit-2026-06-04.md` | Verified by Audit 2026-06-04: RLS policy active on tours table, gate `p4_rls_integration_tests` passed. |
| **4.3**  | PARTIAL      | `tenant-security.spec.ts` (not in guard until `p4_rls_integration_tests` runs)                                      | MAP 4.3 two-tenant e2e automation                                                                       |
| **4.4**  | PARTIAL      | `tenant-config.spec.ts` → `GET /api/v2/tenant-config`                                                               | TH-1 web e2e accent A≠B                                                                                 |
| **4.5**  | PARTIAL      | `packages/platform-events/`; guard `p4_platform_events_*` **PASS** (Node 24)                                        | TourCreated integration + gate `ok: true`                                                               |
| **4.6**  | SPEC_ONLY    | `phase-4-guard.mjs` + `phase-4:gate` chain                                                                          | All 4.0–4.5 VERIFIED + `phase-4:gate` `ok: true`                                                        |

---

## P4-E-\* mechanism truth

| P4-E           | Truth status | Mechanism                                      | Hollow risk                                                                            |
| -------------- | ------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| P4-E-HOST-01   | PARTIAL      | tenant-kernel contract + host-parse            | Guard PASS; ledger not VERIFIED until gate green                                       |
| P4-E-RLS-02    | PARTIAL      | contract SQL shape (`test:phase-4` guard PASS) | Integration needs DATABASE_URL                                                         |
| P4-E-EVT-01    | PARTIAL      | `events.spec.ts`                               | Guard PASS; full gate blocked on RLS env                                               |
| P4-E-TENANT-01 | PARTIAL      | `tenant-security.spec.ts`                      | Guard runs via `p4_rls_integration_tests`                                              |
| P4-E-AUTH-01   | PARTIAL      | auth-env + tenant-kernel.spec                  | Confirm prod matrix                                                                    |
| P4-E-RLS-01    | **VERIFIED** | `rls-isolation.integration.spec.ts`            | `p4_rls_integration_tests` + `p4_anti_hollow_tests` PASS (Audit 2026-06-04, live 5434) |
| P4-E-DATA-01   | PARTIAL      | `STORAGE_DRIVER=prisma` path                   | Default memory without env                                                             |
| P4-E-SCALE-01  | PARTIAL      | in-memory repo spec                            | Document Big-O                                                                         |
| P4-E-RF-40     | PARTIAL      | status report exists                           | Tracks need CI signoff                                                                 |
| P4-E-REG-03    | PARTIAL      | nested phase-3:gate in full gate               | Blocked while outer gate FAIL                                                          |
| P4-E-GATE      | SPEC_ONLY    | full chain                                     | After subphases + `ok: true` JSON                                                      |

---

## Agent rule (score 100)

```yaml
before_marking_subphase_PASS:
  - RUN completion_proof.prove_with from subphases/{id}.md
  - UPDATE this ledger row to VERIFIED
  - RUN pnpm run phase-4:guard (all required p4_* including p4_rls_integration_tests)
forbidden:
  - "PASS from documentation alone"
  - "PASS while status is HOLLOW or SPEC_ONLY"
  - "VERIFIED while reports/phase-4-gate-*.json ok is false"
  - "Trust CONSISTENCY-REPORT PASS as repo closure"
```

**Composite execution score:** 1 VERIFIED / 7 subphases (4.2) → **14%** repo closure (doc navigation may still score 100). **4.3 baseline:** [`reports/phase-4-42-43-ground-truth-audit-2026-06-04.md`](../../../reports/phase-4-42-43-ground-truth-audit-2026-06-04.md).
