# Phase 4 — Implementation truth ledger

```yaml
ledger_meta:
  date: "2026-06-06"
  purpose: "Honest repo state — prevents doc-only or hollow-test false PASS"
  update_rule: "Agent updates row ONLY after prove_with commands exit 0"
  fail_token: FAIL
  anti_hollow: ../appendices/anti-hollow-contract.md
  score_100_requires: "all subphases VERIFIED + phase-4:gate green + all required p4_* PASS"
  gap_register: PHASE-4-GAP-REGISTER.md
  precision_pack: ../appendices/PRECISION-DOC-INDEX.md
  doc_composite_pre_code: 100
```

> **READ FIRST** before any Phase 4 implementation ([`anti-hollow-contract.md`](../appendices/anti-hollow-contract.md) workflow).

## Last guard run (binding)

```yaml
last_guard:
  command: pnpm run phase-4:gate
  report: reports/phase-4-gate-2026-06-06.json
  date: "2026-06-06"
  gitSha: "1697b77"
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
  prove_with_highlights:
    - "4.5: test/4-integration/tour-created-http.spec.ts"
    - "4.4: pnpm --filter @apps/web run test:e2e:th-1"
    - "4.1: pnpm --filter @app-tour/tenant-kernel run test:phase-4"
    - "4.0: reports/phase-3.2-red-flag-status-2026-06-04.md phase_4_0_human_signoff true"
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

| Subphase | Status       | Repo evidence                                                                                                       | Gap / next action |
| -------- | ------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **4.0**  | **VERIFIED** | `reports/phase-3.2-red-flag-status-2026-06-04.md` (R0–R3 prove_with green); `p4_red_flag_prerequisite` PASS       | —                 |
| **4.1**  | **VERIFIED** | `packages/tenant-kernel/`; `pnpm --filter @app-tour/tenant-kernel run test:phase-4` exit 0                           | —                 |
| **4.2**  | **VERIFIED** | `rls-isolation.integration.spec.ts`; `001_tenant_rls.sql`; `reports/phase-4-42-43-ground-truth-audit-2026-06-04.md` | —                 |
| **4.3**  | **VERIFIED** | `provisioning.service.ts`; `routes/internal/tenants.ts`; `test/4.3-provisioning.spec.ts`; `db:seed`                 | —                 |
| **4.4**  | **VERIFIED** | `tenant-config.spec.ts`; `apps/web/tests/e2e/th-1-tenant-theme-isolation.spec.ts` (TH-1 Playwright)                 | —                 |
| **4.5**  | **VERIFIED** | `packages/platform-events/`; `test/4-integration/tour-created-http.spec.ts` (HTTP TourCreated + tenantId)          | —                 |
| **4.6**  | **VERIFIED** | `phase-4-guard.mjs` + `phase-4:gate` chain; `guard:doc-sync`                                                        | —                 |

---

## P4-E-* mechanism truth

| P4-E           | Truth status | Mechanism                                             | Hollow risk |
| -------------- | ------------ | ----------------------------------------------------- | ----------- |
| P4-E-HOST-01   | **VERIFIED** | tenant-kernel contract + host-parse + web host dev map | —           |
| P4-E-RLS-02    | **VERIFIED** | contract SQL shape + RLS integration specs            | —           |
| P4-E-EVT-01    | **VERIFIED** | `events.spec.ts` + `tour-created-http.spec.ts`        | —           |
| P4-E-TENANT-01 | **VERIFIED** | `tenant-security.spec.ts`; `4.3-provisioning.spec.ts` | —           |
| P4-E-AUTH-01   | **VERIFIED** | auth-env + tenant-kernel.spec                         | —           |
| P4-E-RLS-01    | **VERIFIED** | `rls-isolation.integration.spec.ts`                   | —           |
| P4-E-DATA-01   | **VERIFIED** | `STORAGE_DRIVER=prisma` path + gate env               | —           |
| P4-E-SCALE-01  | PARTIAL      | in-memory repo spec                                   | Document Big-O |
| P4-E-RF-40     | **VERIFIED** | red-flag report + prove_with re-run 2026-06-06        | —           |
| P4-E-REG-03    | **VERIFIED** | nested phase-3:gate in full gate                      | —           |
| P4-E-GATE      | **VERIFIED** | full chain `phase-4:gate` ok:true                     | —           |

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

**Composite execution score:** **7 VERIFIED / 7 subphases (4.0–4.6)** → **100%** repo closure (2026-06-06, gitSha `1697b77`).
