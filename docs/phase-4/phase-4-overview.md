# Phase 4 — Overview

```yaml
agent_load_tier: T2_CONTEXT
machine_readable: true
execution_router: phase-4-ai-exec.md
rule: "Agents implementing code MUST NOT load this file — use T0 in appendices/agent-load-tiers.md"
fail_if: "T0 execution task loads this file without T2 dispute"
```

> **Agents:** [`phase-4-ai-exec.md`](phase-4-ai-exec.md) · **Tiers:** [`appendices/agent-load-tiers.md`](appendices/agent-load-tiers.md)  
> **Human narrative:** [`../phase-4-tenant-kernel.md`](../phase-4-tenant-kernel.md) · Subphases: [`subphases/`](subphases/)

## STEP 1 — PHASE DETECTION (COMPLETE)

```yaml
phase_id: "4"
phase_name: "Tenant Kernel & Multi-Tenant Enterprise Boundary"
north_star: "Platform logic = generic · Workspace = injectable · Tenant = security boundary"
interop_model: appendices/workspace-interoperability-model.md
product_type: "Interoperable workspace platform (app-tour) — NOT legacy Tour Ops Phase 4"
document_status_claim: "Open"
prerequisite_phase: "3"
prerequisite_gate: "pnpm run phase-3:gate — exit 0"
prerequisite_subphase_before_4_1: "4.0 — R0–R3 closed per backlog exit criteria"
legacy_name_collision:
  app_tour: "packages/tenant-kernel · Postgres+RLS · subdomain · TenantThemeProvider production · in-process event bus"
  legacy_tour_ops: "legacy/map.md Phase 4 = Canonical SoT + workspaces/urban — NOT app-tour Phase 4 — reference port only"
subphases:
  - id: "4.0"
    name: "Gate of Gates R0–R3"
    blocked_until: ["phase_3_gate_green"]
    enforcement_ids: [P4-E-RF-40, P4-E-AUTH-01, P4-E-SCALE-01]
    merge_rule: "FORBIDDEN merge PR labeled Phase 4.1+ until 4.0 exit ALL PASS"
  - id: "4.1"
    name: "packages/tenant-kernel"
    blocked_until: ["4.0"]
    packages: ["@app-tour/tenant-kernel"]
    enforcement_ids: [P4-E-HOST-01, P4-E-RLS-02]
  - id: "4.2"
    name: "Postgres + Redis + RLS + Prisma"
    blocked_until: ["4.1"]
    artifacts:
      - infra/docker-compose.yml
      - infra/sql/001_tenant_rls.sql
      - apps/api/prisma/schema.prisma
    enforcement_ids: [P4-E-RLS-01, P4-E-RLS-02, P4-E-DATA-01, P4-E-SCALE-01]
  - id: "4.3"
    name: "provision + two tenants"
    blocked_until: ["4.2"]
    map_output: "MAP 4.3 two isolated tenants"
    enforcement_ids: [P4-E-TENANT-01]
  - id: "4.4"
    name: "TenantThemeProvider production"
    blocked_until: ["4.2"]
    parallel_after: "4.2"
    blocked_until_not: ["4.3"]
    routes: ["GET /api/v2/tenant-config OR GET /tenant/theme"]
    test_matrix_ids: [TH-1]
    dod_ids: [DOD-7]
  - id: "4.5"
    name: "in-process event bus"
    blocked_until: ["4.2"]
    packages: ["@app-tour/platform-events"]
    events: [TourCreated]
    enforcement_ids: [P4-E-EVT-01]
  - id: "4.6"
    name: "phase-4:gate + forensic"
    blocked_until: ["4.0", "4.1", "4.2", "4.3", "4.4", "4.5"]
    ci: "pnpm run phase-4:gate"
    enforcement_ids: [P4-E-GATE, P4-E-REG-03]
    forensic_output: docs/audits/phase-4-zero-debt-forensic-audit.mdoc
phase_detection_blocker: null
```

---

## SECTION 1 — PLATFORM ORDER (§1)

```yaml
platform_order_law:
  phase_0: "workspace-sdk contract"
  phase_1: "platform-core headless"
  phase_2: "visual layer — Closed Zero-Debt Verified"
  phase_3: "starter + apps/* + CASL — gate green scaffold — red-flag honesty → 4.0"
  phase_4: "tenant-kernel + RLS + Postgres SoT — THIS DOCUMENT"
  phase_5: "canonical JSONB schema + transactional outbox"
  phase_6: "Denali workspace plugin"

product_rule: "Denali = first product workspace — NOT first tenant security boundary"
failure_if_skip_phase_4:
  - "multi-tenant marketing ≠ dev-tenant-local runtime"
  - RF-F01 in-memory SoT persists in production path
  - RF-F09 unsigned dev bearer in production
  - RF-F05 module-static web session
  - RF-F08 web wizard without API persist
  - RF-G07 CASL without RLS safety net

phase_3_red_flags_to_close_in_4_0:
  - id: RF-F01
    phase_4_rule: "Postgres persistence + restart survival — 4.2 P4-E-DATA-01"
  - id: RF-F09
    phase_4_rule: "Fail-closed prod; JWT/host lookup — 4.0 R0 P4-E-AUTH-01"
  - id: RF-F05
    phase_4_rule: "Per-request RSC session — 4.0 R1"
  - id: RF-F06
    phase_4_rule: "Per-request RSC session — 4.0 R1"
  - id: RF-F08
    phase_4_rule: "Server Action → POST /tours — 4.0 R3"
  - id: RF-G07
    phase_4_rule: "Testcontainers RLS e2e — 4.2 P4-E-RLS-01"
  - id: phase_3_section_16_host
    phase_4_rule: "4.1 design + 4.2 migration"

phase_4_one_liner: >
  Every request API and web resolves verified tenant identity;
  tenant-scoped data isolated in Postgres with CASL + RLS;
  tenant visual theme fed from kernel not static env.
```

---

## SECTION 2 — ENTERPRISE MULTI-TENANT RULES (§2) — ALL ENFORCEABLE

```yaml
isolation_spectrum:
  pool:
    definition: "shared schema + tenant_id + RLS"
    phase_4: REQUIRED_DEFAULT
  bridge:
    definition: "schema-per-tenant or DB-per-tenant on one cluster"
    phase_4: FORBIDDEN_IMPLEMENT
    defer: "phase 7 enterprise"
  silo:
    definition: "physical DB/VPC/stack per tenant"
    phase_4: FORBIDDEN_IMPLEMENT
    defer: "phase 7 compliance"

decision_app_tour_phase_4:
  - id: P4-ENT-01
    rule: "B2B operator tours · tenant = SaaS security boundary · Pool + RLS"
  - id: P4-ENT-02
    rule: "Every tenant-scoped table MUST have tenant_id UUID NOT NULL + index (tenant_id, …) + RLS policy — NO EXCEPTION"
  - id: P4-ENT-03
    rule: "FORBIDDEN schema-per-tenant in phase 4 for security without compliance trigger"
  - id: P4-ENT-04
    rule: "Hybrid TenantConnectionRouter tier silo — interface stub only 4.1 — implement phase 7"

tenant_resolution_layers:
  - id: P4-ENT-10
    layer: "Resolution"
    rule: "Determine which tenant owns request BEFORE any business query"
    mechanisms: ["Host subdomain → label → tenants.subdomain lookup", "JWT tenantId verified"]
  - id: P4-ENT-11
    layer: "Isolation"
    rule: "Pool + RLS + CASL"
  - id: P4-ENT-12
    layer: "Execution"
    rule: "All services run in same tenant context — ALS/middleware"

resolution_patterns:
  subdomain:
    status: REQUIRED_DEFAULT
    dev_example: "{label}.localhost"
  header_x_tenant_id:
    status: ALLOWED_ONLY_AFTER_VERIFY
    rule: "FORBIDDEN as primary trust source"
  path_tenant:
    status: NOT_PRIMARY_OPERATOR_PATH
  custom_domain:
    status: DEFERRED_PHASE_7

trust_order_fail_closed:
  steps:
    - step: 1
      source: "Valid JWT or session — claim tenantId + membership"
    - step: 2
      source: "Host subdomain → DB mapping with reserved labels api www admin"
    - step: 3
      source: "Explicit headers x-authenticated-tenant-id ONLY if step 1 or 2 verified"
    - step: 4
      action: "401 or 403 — FORBIDDEN execute business logic"
  forbidden_sources:
    - "tenantId from query string"
    - "tenantId from unauthenticated request body"
    - "dev.<base64> bearer without AUTH_ALLOW_DEV_BEARER=true in non-production"

rls_postgresql_canonical:
  - id: P4-ENT-20
    rule: "tenant_id UUID NOT NULL FK tenants — NOT sequential int"
  - id: P4-ENT-21
    rule: "CREATE INDEX on (tenant_id, id) or (tenant_id, created_at)"
  - id: P4-ENT-22
    rule: "ALTER TABLE ENABLE ROW LEVEL SECURITY"
  - id: P4-ENT-23
    rule: "ALTER TABLE FORCE ROW LEVEL SECURITY"
  - id: P4-ENT-24
    rule: "Policy USING and WITH CHECK both use current_setting('app.current_tenant_id', true)::uuid"
  - id: P4-ENT-25
    rule: "First statement in transaction SELECT set_config('app.current_tenant_id', $1, true)"
  - id: P4-ENT-26
    rule: "Runtime DB role app_user non-superuser — cross-tenant test expects 0 rows"
  - id: P4-ENT-27
    rule: "statement_timeout on role; policy WITHOUT per-row subquery tenant_id IN SELECT"
  session_variable_name: "app.current_tenant_id"
  forbidden:
    - "SET app.current_tenant_id without LOCAL on PgBouncer transaction pooling"
    - "RLS ENABLE before policies written"
    - "RLS replaces CASL — BOTH required"

defense_in_depth_stack:
  order:
    - "Tenant resolve tenant-kernel + apps/api ingress"
    - "AuthZ CASL createApiAbility accessibleByTourWhere"
    - "ORM Prisma tenant scope"
    - "Postgres RLS safety net"
    - "Response no cross-tenant leak in body headers"
  layer_roles:
    casl: "authorization semantics performance index-friendly"
    rls: "data plane guarantee even if findMany empty filter bug"

tenant_context_propagation:
  - id: P4-ENT-30
    rule: "API middleware BEFORE handler"
  - id: P4-ENT-31
    rule: "Web RSC layout per request force-dynamic"
  - id: P4-ENT-32
    rule: "AsyncLocalStorage for workers jobs — tenantId in store"
  - id: P4-ENT-33
    rule: "Fail-closed — no context → 401/403"
  package_rule: "@app-tour/tenant-kernel pure TS — NO Nest NO Prisma inside package"
  adapters: ["apps/api/src/tenant-kernel/", "apps/web per phase-3 §11"]

end_to_end_isolation_checklist:
  - level: HTTP_API
    requirement: "every tenant-scoped route kernel + CASL"
    test: apps/api/test/tenant-security.spec.ts
    enforcement: P4-E-TENANT-01
  - level: ORM
    requirement: "accessibleBy every mutation scoped"
    enforcement: P3-E-DB-01 regression P4-E-REG-03
  - level: Postgres
    requirement: "RLS non-superuser integration"
    enforcement: P4-E-RLS-01
  - level: Events
    requirement: "tenantId on envelope — FORBIDDEN cross-tenant publish"
    enforcement: P4-E-EVT-01
  - level: Redis
    requirement: "idempotency key includes tenantId — 4.5 scaffold"
  - level: Web
    requirement: "data-tenant-id attribute theme after auth"
    test: TH-1

events_phase_boundary:
  phase_4: "in-process bus tenant_id envelope idempotent handler"
  phase_5: "outbox_events table relay — FORBIDDEN in phase 4"
  plugin_rule: "FORBIDDEN plugin direct publish to finance — API orchestration only"

scale_escalation_triggers:
  - trigger: "< ~1000 tenant B2B normal"
    action: "Pool + RLS sufficient — phase 4"
  - trigger: "noisy neighbor"
    defer: "phase 5-7 read replica statement_timeout"
  - trigger: "HIPAA PCI FedRAMP"
    defer: "phase 7 silo"
  - trigger: "enterprise whale"
    defer: "phase 7 tenant_routes.tier silo"
  - trigger: "> 10M rows per table"
    defer: "phase 7+ partition by tenant_id"

three_apps_contract:
  repo_reality: "ONLY apps/web in phase 3-4"
  forbidden_phase_4: "CREATE apps/marketing separate repo"
  marketing: "future public routes in apps/web"
  user_portal: "CURRENT /tours/new wizard POST /tours"
  admin_panel: "future RBAC same session"
  session: "domain-scoped single session MAP §3.6 JWT slot apps/api"
  hydration_canonical: "DEFERRED phase 5+ — phase 4 requires tenant + one vertical persist path"

anti_patterns_FORBIDDEN:
  - "WHERE tenant_id only in application code without RLS"
  - "tenantId from query body without auth bind"
  - "RLS without CASL or CASL without RLS for tenant data"
  - "schema-per-tenant in phase 4 for security"
  - "session-scoped SET without transaction local on pooled connections"
  - "global cache without tenant prefix"
  - "claim multi-tenant with in-memory SoT production default"
```

---

## SECTION 3 — LEGACY PORT / ANTI-PORT (§3)

```yaml
legacy_port_table:
  - legacy: legacy/packages/tenant-host parse-workspace-tenant-label
    target: packages/tenant-kernel/src/host/
  - legacy: legacy/apps/api/.../tenant-resolver.middleware.ts
    target: "pattern only — adapter apps/api/src/tenant-kernel/"
  - legacy: legacy/apps/api/.../tenant-session-binding.service.ts
    target: "withTenantTransaction + Prisma $executeRaw"
  - legacy: legacy/apps/api/.../rls-tenant-session.ts
    target: "packages/tenant-kernel/src/rls/session.ts — variable app.current_tenant_id"
  - legacy: legacy/apps/api/test/e2e/subdomain-multi-tenant.e2e-spec.ts
    target: "Testcontainers in app-tour"
  - legacy: legacy/apps/web/lib/tenant/build-tenant-theme-style.ts
    target: "@app-tour/theme-react wire API 4.4"
  - legacy: legacy/apps/web/lib/tenant/tenant-provider.tsx
    target: "RSC props → TenantThemeProvider"
  - legacy: legacy/apps/api/src/common/events/
    target: "@app-tour/platform-events hook CanonicalTourService"
  - legacy: legacy/infra/docker-compose.yml
    target: infra/docker-compose.yml

anti_port_FORBIDDEN:
  - action: "Copy full Nest TenantModule into platform-core"
  - action: "Denali code inside tenant-kernel package"
  - action: "RLS only without CASL"
  - action: "tenantId from query header without verify"
  - action: "grep-only phase-4 closure"
```

---

## SECTION 4 — HARD / SOFT OUTPUTS (§4)

```yaml
hard_outputs:
  - id: "4.0"
    name: "R0-R3 red-flag backlog closed"
    exit_doc: docs/backlog/phase-3.2-red-flag-backlog.md
    report: reports/phase-3.2-red-flag-status-YYYY-MM-DD.md
    enforcement: P4-E-RF-40
  - id: "4.1"
    name: "@app-tour/tenant-kernel host context TenantRoute"
    verify: [unit tests, adversarial host tests, phase-4.contract.spec.ts]
  - id: "4.2"
    name: "Postgres Redis Docker RLS Prisma tours"
    verify: [isolation e2e, restart survival, P4-E-RLS-01, P4-E-DATA-01]
  - id: "4.3"
    name: "provision tenant default workspace_type"
    verify: [two tenant e2e automated]
  - id: "4.4"
    name: "tenant theme from kernel DB"
    verify: [web API e2e accent differs per tenant]
  - id: "4.5"
    name: "in-process event bus TourCreated"
    verify: [handler test with tenantId]
  - id: "4.6"
    name: "phase-4:gate contract forensic"
    verify: [Purity >= 8, Verification table CI 1:1]

soft_outputs:
  - Playwright subdomain smoke non-blocking
  - GET /tours/:id full hydrate
  - OTP login production may start JWT stub 4.1

dod_one_liner: >
  Tenant boundary provable in code CI and DB —
  NOT dev env and in-memory store alone.
```

---

## SECTION 5 — REQUEST ARCHITECTURE (§5)

```yaml
request_flow:
  input: "Request Host + Authorization"
  step_1:
    package: "@app-tour/tenant-kernel"
    actions: ["parse host", "validate label", "TenantRoute design stub"]
  step_2_api:
    path: apps/api/src/tenant-kernel/
    actions:
      - "resolveTenantContextFromRequest"
      - "createApiAbility + accessibleByTourWhere"
      - "Prisma + SET_LOCAL_RLS_TENANT_SQL from packages/tenant-kernel/src/rls/session.ts"
  step_2_web:
    path: apps/web
    actions:
      - "resolveBootstrapAppSession per request apps/web/app/layout.tsx"
      - "ThemeProviderChain Platform → Tenant → Workspace"
      - "WorkspaceThemeProvider + CASL before ingress P3-E-CASL-01 unchanged"
  step_3:
    layer: "Postgres RLS policies safety net"

theme_layers:
  platform:
    tokens: "@app-tour/design-tokens"
    vars: "--color-* semantic"
    phase: "2 done"
  tenant:
    contract: TenantThemeConfig
    source: "DB tenant settings validate SDK"
    phase: "4 operational provider API"
  workspace:
    contract: WorkspacePlugin.theme
    vars: "--ws-* ingress T-1-T-7"
    phase: "2-3 done"

provider_order_FIXED:
  - PlatformThemeProvider
  - TenantThemeProvider
  - WorkspaceThemeProvider
  rule: "FORBIDDEN swap Tenant and Workspace order"

TenantRoute_stub:
  file: packages/tenant-kernel/src/route.ts
  fields: [tenantId, tier pool|silo, databaseUrl]
  implement_tier_silo: "phase 7 only"
```
