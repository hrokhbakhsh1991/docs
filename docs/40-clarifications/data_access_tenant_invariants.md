# Data Access Tenant Invariants v1 (Draft)

## Context
Defines domain-level tenant invariants for operational reads, writes, dashboards, and exports.
Implements CLAR-002.

Based on current behavior inventory: `docs/40-clarifications/spec_inventory_tenant.md`

## Scope & Out-of-Scope
### Scope
- Mandatory tenant-bounded access invariants.
- Enforcement-layer mapping for each invariant.
- Identifier scoping assumptions used by access rules.

### Out-of-Scope
- DB performance/index details.
- Full API error taxonomy.
- Identity-linking policies.

## Normative Basis
- `docs/30-analysis/step_03_system_requirements.md` (`SR-NFR-001`, `SR-FR-003`, `SR-FR-007`)
- `docs/20-architecture/technical_spec.md` (strict tenant isolation at API/data layers)
- `docs/50-validation/flow_consistency_validation.md` (tenant scope criterion across core flows)
- `docs/20-architecture/contracts/reconciliation_export_contract.md` (tenant + tour export scope)
- `docs/30-analysis/step_07_test_strategy.md` (Tenant Safety Gate)

## Tenant Invariants

### INV-TEN-001
Every operational SELECT/READ MUST include tenant-bounded scope resolution before returning records.  
Enforced at: Domain Model / API Contract / Test Suite

### INV-TEN-002
Every operational CREATE/UPDATE/DELETE MUST execute within resolved tenant scope and MUST NOT mutate data outside that scope.  
Enforced at: Domain Model / API Contract / DB / Test Suite

### INV-TEN-003
Leader dashboard and aggregate operational views MUST be computed from tenant-bounded datasets only.  
Enforced at: Domain Model / API Contract / Test Suite

### INV-TEN-004
Exports and reconciliation views MUST be tenant-bounded and tour-bounded unless explicitly marked as cross-tenant administrative tooling.  
Enforced at: Domain Model / API Contract / Test Suite

### INV-TEN-005
If tenant context is missing or ambiguous, operational read/write/export MUST NOT proceed.  
Enforced at: API Contract / Test Suite

### INV-TEN-006
Client-provided tenant identifiers MUST NOT override trusted server-side tenant context.  
Enforced at: API Contract / Domain Model / Test Suite

### INV-TEN-007
Cross-tenant access attempts MUST be denied and treated as boundary violations.  
Enforced at: API Contract / Test Suite

## Identifier Scoping – Current Behavior

1. Current active artifacts consistently treat `tenant_id` as the effective tenant key.
2. `tour_id`: current contracts/flows treat tour operations and exports as tenant-bounded; `tour_id` is operationally evaluated within tenant scope.
3. `registration_id`: system-assigned, but active baseline does not finalize global uniqueness semantics; by-id access is currently safest when tenant-bounded.
4. `tenant_id`: authoritative only when resolved from trusted signals; payload `tenant_id` remains advisory.

OPEN: Architect decision needed: Are `tour_id` and `registration_id` globally unique across tenants at storage level, or only tenant-unique in access semantics?  
OPEN: If global uniqueness is guaranteed in storage, confirm whether tenant predicate may ever be omitted for strictly internal by-id reads.

## Query Classes and Tenant Predicates

- By-id read: current docs imply tenant-bounded behavior; explicit exception for globally unique by-id paths is not finalized.  
  OPEN: confirm if any by-id endpoint is intentionally non-tenant-predicate in current implementation.
- List/search endpoints: current requirements and flow validations imply tenant-constrained access.
- Export endpoints: current reconciliation contract implies tenant + tour constraints.
- Dashboard/aggregate queries: current requirement/test/KPI baselines imply tenant-bounded visibility for operational users.
- Cross-tenant admin query class: current tenant specs mark MVP as single-tenant admin context; any cross-tenant class remains OPEN.

## Known Exceptions
OPEN: None declared yet.

## Traceability
- Primary anchor: `SR-NFR-001`
- Related anchors: `SR-FR-003`, `SR-FR-007`
