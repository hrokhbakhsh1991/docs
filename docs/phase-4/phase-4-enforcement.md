## PHASE 4 ENFORCEMENT — VERIFICATION TABLE

> **CI binding:** [`ci.md`](ci.md) · **p4_* guards:** [`phase-4-guard.md`](phase-4-guard.md) · **Subphase map:** [`audits/subphase-enforcement-map.md`](audits/subphase-enforcement-map.md) · **Observability (scaffold):** [`appendices/observability.md`](appendices/observability.md)

```yaml
verification_table:
  - claim: "No API request without tenant context"
    id: P4-E-TENANT-01
    mechanism: apps/api/test/tenant-security.spec.ts
    FAIL_if: "HTTP 200 without headers or JWT on tenant-scoped route"
  - claim: "Dev bearer dead in prod"
    id: P4-E-AUTH-01
    mechanism: [apps/api/src/tenant-kernel/tenant-kernel.spec.ts, tenant-security.spec.ts]
    FAIL_if: "bearer accepted when AUTH_ALLOW_DEV_BEARER not true in prod-like env"
  - claim: "RLS blocks cross-tenant read"
    id: P4-E-RLS-01
    mechanism: apps/api/test/rls-isolation.integration.spec.ts
    FAIL_if: "tenant B reads tenant A row"
  - claim: "set_config transactional"
    id: P4-E-RLS-02
    mechanism: "unit mock pool reuse session leak test"
    FAIL_if: "session leak across pooled connection"
  - claim: "Postgres SoT"
    id: P4-E-DATA-01
    mechanism: "restart + find tour"
    FAIL_if: "production path in-memory only"
  - claim: "Host parse reserved"
    id: P4-E-HOST-01
    mechanism: packages/tenant-kernel/test/phase-4.contract.spec.ts
    FAIL_if: "api.localhost resolves to tenant"
  - claim: "Event carries tenantId"
    id: P4-E-EVT-01
    mechanism: packages/platform-events/test/events.spec.ts
    FAIL_if: "envelope missing tenantId"
  - claim: "Write path O(1) tenant scope"
    id: P4-E-SCALE-01
    mechanism: [repository spec, doc Big-O]
    FAIL_if: "full table scan on tenant write documented"
  - claim: "Red-flag prerequisite"
    id: P4-E-RF-40
    mechanism: [reports/phase-3.2-red-flag-status-*.md, phase-4-guard p4_red_flag_prerequisite]
    FAIL_if: "R0-R3 open or report missing"
  - claim: "Phase 3 regression"
    id: P4-E-REG-03
    mechanism: "phase-3:gate inside phase-4:gate"
    FAIL_if: "phase-3:gate fails"
  - claim: "Phase 4 closure gate"
    id: P4-E-GATE
    mechanism: "pnpm run phase-4:gate — build test phase-3:gate phase-4:guard"
    FAIL_if: "any step exit non-zero or p4_* check fails"

grep_only_rule:
  status: SUPPLEMENTARY_ONLY
  forbidden: "sole closure proof"
  ref: MIGRATION-MAP.md §20

anti_hollow_rule:
  status: MANDATORY
  doc: appendices/anti-hollow-contract.md
  ledger: audits/IMPLEMENTATION-TRUTH.md
  guard: p4_anti_hollow_tests
  forbidden: "P4-E PASS with empty test body or doc-only PR"

observability_scaffold:
  status: RECOMMENDED_NOT_GATING
  doc: appendices/observability.md
  rule: "Structured logs + correlation ID on API — no new P4-E-* required for Phase 4 merge"
  deferred_full_stack: "OpenTelemetry Phase 7 per MAP §10"
```

---

## FORBIDDEN ACTIONS

```yaml
forbidden_phase_4:
  - item: "packages/workspaces/denali"
    correct_phase: "6"
  - item: "outbox_events table + relay"
    correct_phase: "5"
  - item: "Dedicated DB per tenant implement"
    correct_phase: "7"
  - item: "Raw SQL without RLS review"
    correct_phase: "5+ architect"
  - item: "RLS-only without CASL"
    correct_phase: "never"
  - item: "grep-only gate closure"
    correct_phase: "never"
  - item: "platform-core import tenant-kernel"
    correct_phase: "never"
  - item: "Marketing/User-Portal static import workspace plugin"
    correct_phase: "6+ dynamic registry"
  - item: "apps/marketing separate app repo in phase 4"
    correct_phase: "later deploy split"
  - item: "tenantId from query body unauthenticated"
    correct_phase: "never — RF-F09 class"
  - item: "Schema-per-tenant migrations phase 4"
    correct_phase: "7 enterprise"
  - item: "Swap ThemeProviderChain Tenant Workspace order"
    correct_phase: "never"
  - item: "Start 4.2 before 4.0 complete"
    correct_phase: "4.0 first"
```

---

## DEFINITION OF DONE — PHASE 4

```yaml
phase_4_dod_hard:
  - id: DOD-1
    item: "4.0 R0-R3 report archived"
    verify: reports/phase-3.2-red-flag-status-*.md
  - id: DOD-2
    item: "@app-tour/tenant-kernel exists build test"
  - id: DOD-3
    item: "@app-tour/platform-events exists build test"
  - id: DOD-4
    item: "infra/docker-compose.yml documented and present"
  - id: DOD-5
    item: "Prisma + RLS e2e green P4-E-RLS-01"
  - id: DOD-6
    item: "two tenant subdomain e2e"
  - id: DOD-7
    item: "TenantThemeProvider from API config not mock"
  - id: DOD-8
    item: "TourCreated event test P4-E-EVT-01"
  - id: DOD-9
    item: "pnpm run phase-4:gate exit 0"
  - id: DOD-10
    item: "Forensic audit archived Purity >= 8"
  - id: DOD-11
    item: "verification-matrix.md each P4-E-* has CI mechanism — step 4.6-S3"
  - id: DOD-12
    item: "guard:doc-sync phases 4–5 in docs/phase-registry.json"

status_constraints:
  ENFORCED:
    - id: P4-SC-01
      claim: ThemeProviderChain order fixed
      constraint: FORBIDDEN swap Tenant with Workspace
      verify: code review + phase-4 forbidden list
    - id: P4-SC-02
      claim: Phase 3 honesty separate from Phase 4 production
      constraint: 4.0 closes red flags before 4.1 merge
      verify: P4-E-RF-40
  ASPIRATIONAL:
    - id: P4-SC-10
      claim: Multi-tenant enterprise production SoT
      until_enforced: P4-E-DATA-01 PASS
      on_claim_before: FAIL marketing closure
    - id: P4-SC-11
      claim: JWT production auth
      until_enforced: prod-like env rejects dev bearer
      verify: P4-E-AUTH-01
  DEFERRED:
    - id: P4-SC-20
      claim: Transactional outbox
      phase: "5"
      phase_4_allowed: in-process bus only P4-E-EVT-01
    - id: P4-SC-21
      claim: Hybrid silo TenantRoute
      phase: "7"
      phase_4_allowed: interface stub 4.1 only
  BACKLOG_SOFT:
    - id: P4-SC-30
      claim: Playwright subdomain e2e
      does_not_block: phase_4_dod hard items except optional forensic note
```

---

## PHASE 5 ENTRY CHECKLIST

```yaml
phase_5_entry_requires_modular:
  - item: "Phase 4 subphases 4.0–4.6 exit criteria PASS per subphases/*.md completion_proof"
    owner: docs/phase-4/subphases/
  - item: "Workspace interoperability model acknowledged"
    owner: docs/phase-4/appendices/workspace-interoperability-model.md
  - item: "pnpm run phase-4:gate exit 0"
    owner: package.json
  - item: "Forensic Phase 4 archived docs/audits/phase-4-zero-debt-forensic-audit.mdoc"
  - item: "Postgres SoT tours — STORAGE_DRIVER=prisma in production"
    owner: apps/api/src/storage/create-tour-storage.ts
  - item: "RLS on tours (+ policies for new tables in Phase 5)"
  - item: "Event bus hook points exist — outbox table NOT required at Phase 4 exit"

phase_5_entry_human_optional_T3:
  - "docs/phase-4-tenant-kernel.md sections 8-16 — narrative only; modular tree is execution SoT"

# Legacy single-line (retired for agents — use modular list above)
phase_5_entry_requires:
  - "See phase_5_entry_requires_modular — NOT monolith-only"
phase_5_next:
  - "canonical_data JSONB"
  - "projected columns"
  - "transactional outbox MAP §11 phase 5"
```
