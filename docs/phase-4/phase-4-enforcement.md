## PHASE 4 ENFORCEMENT — VERIFICATION TABLE (§14)

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

grep_only_rule:
  status: SUPPLEMENTARY_ONLY
  forbidden: "sole closure proof"
  ref: MIGRATION-MAP.md §20
```

---

## FORBIDDEN ACTIONS (§15)

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

## DEFINITION OF DONE — PHASE 4 (§16)

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
    item: "Verification table §14.1 = CI 1:1"
  - id: DOD-12
    item: "guard:doc-sync phase 4 in docs/phase-registry.json"

forensic_truth_mandatory_MAP_14_4:
  - claim: "Multi-tenant enterprise"
    reality_until: "P4-E-DATA-01 green"
    status: Aspirational_until_4_2
  - claim: "Subdomain routing"
    reality: "host parse 4.1 DB lookup 4.2"
    status: Partial_until_provision
  - claim: "Phase 3 Zero-Debt"
    reality: "gate scaffold not tenant production"
    status: Enforced_honesty_4_0_separate
  - claim: "ThemeProviderChain order"
    reality: "fixed phase 2/3 Tenant operational 4.4"
    status: "FORBIDDEN swap with Workspace"
  - claim: "@casl/prisma runtime"
    reality: "phase 3 in-memory reference"
    status: "4.2 Postgres path required"
  - claim: "JWT production auth"
    reality: "slot in API OTP may stub"
    status: Aspirational_if_stub_only
  - claim: "Hybrid silo TenantRoute"
    reality: "interface 4.1 only"
    status: Aspirational_until_phase_7
  - claim: "Transactional outbox"
    reality: "in-process 4.5 only"
    status: Deferred_phase_5
  - claim: "Playwright subdomain"
    status: Backlog_soft
```

---

## PHASE 5 ENTRY CHECKLIST (§17)

```yaml
phase_5_entry_requires:
  - "docs/phase-4-tenant-kernel.md sections 8-16 complete"
  - "pnpm run phase-4:gate exit 0"
  - "Forensic Phase 4 archived docs/audits/phase-4-zero-debt-forensic-audit.mdoc"
  - "Postgres SoT tours — NOT in-memory default production"
  - "RLS migration applied all tenant tables"
  - "Event bus hook points exist — outbox table NOT required"
phase_5_next:
  - "canonical_data JSONB"
  - "projected columns"
  - "transactional outbox MAP §11 phase 5"
```
