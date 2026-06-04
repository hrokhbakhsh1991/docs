# Phase 4 — Verification matrix

> Behavioral claims: **P4-E-*** (`phase-4-enforcement.md`). Automated guard: **p4_*** (`phase-4-guard.mjs`).

```yaml
enforcement_matrix:
  - enforcement_id: P4-E-RF-40
    guard_id: p4_red_flag_prerequisite
    verification: reports/phase-3.2-red-flag-status-*.md exists; R0-R3 closed
    failure_condition: report missing or red flags open
  - enforcement_id: P4-E-HOST-01
    guard_id: [p4_tenant_kernel_test, p4_contract_spec]
    verification: tenant-kernel tests ≥6 + test:phase-4 host adversarial
    failure_condition: reserved host resolves as tenant
  - enforcement_id: P4-E-RLS-02
    guard_id: p4_contract_spec
    verification: SET_LOCAL_RLS_TENANT_SQL transaction-local in contract
    failure_condition: session leak across pool
  - enforcement_id: P4-E-EVT-01
    guard_id: p4_platform_events_test
    verification: platform-events tests ≥2 + events.spec.ts tenantId envelope
    failure_condition: TourCreated missing tenantId
  - enforcement_id: P4-E-REG-03
    verification: pnpm run phase-3:gate inside phase-4:gate step 3
    failure_condition: phase-3 regression
  - enforcement_id: P4-E-TENANT-01
    verification: apps/api/test/tenant-security.spec.ts
    failure_condition: tenant-scoped route 200 without context
  - enforcement_id: P4-E-AUTH-01
    verification: tenant-kernel.spec.ts + tenant-security prod bearer deny
    failure_condition: dev bearer accepted in prod-like env
  - enforcement_id: P4-E-RLS-01
    verification: apps/api/test/rls-isolation.integration.spec.ts
    failure_condition: cross-tenant read succeeds
  - enforcement_id: P4-E-DATA-01
    verification: restart + find tour in Postgres
    failure_condition: production in-memory only SoT
  - enforcement_id: P4-E-SCALE-01
    verification: repository spec + documented Big-O
    failure_condition: full table scan on tenant write
  - enforcement_id: P4-E-GATE
    verification: pnpm run phase-4:gate exit 0
    failure_condition: any outer step or p4_* fails

p4_to_guard_only:
  p4_tenant_kernel_build: build artifact
  p4_platform_events_build: build artifact
  p4_no_denali_in_kernel: rg denali tenant-kernel platform-events
  p4_infra_compose: infra/docker-compose.yml present

appendix_E_binding:
  TK-1_TK-2: P4-E-HOST-01
  RLS-1: P4-E-RLS-01
  AUTH-1: P4-E-AUTH-01
  EVT-1: P4-E-EVT-01
  TH-1: subphase 4.4 tenant theme
```
