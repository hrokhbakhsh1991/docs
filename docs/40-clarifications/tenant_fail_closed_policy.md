# Tenant Fail-Closed Policy v1 (Draft)

## Context
Defines fail-closed behavior for tenant context failures in operational paths.
Implements CLAR-005 and aligns with tenant boundary resolution policy.

Based on current behavior inventory: `docs/40-clarifications/spec_inventory_tenant.md`

## Scope & Out-of-Scope
### Scope
- Missing, ambiguous, and mismatched tenant context classes.
- User-facing handling and high-level error category.
- Requirement traceability linkage.

### Out-of-Scope
- Full API error object schema.
- Non-tenant business conflict classes.

## Normative Basis
- `docs/30-analysis/step_03_system_requirements.md` (`SR-NFR-001`, `SR-NFR-001-AC`, `SR-FR-003`)
- `docs/20-architecture/technical_spec.md` (strict tenant isolation)
- `docs/30-analysis/step_07_test_strategy.md` (Gate B, S1 severity)
- `docs/30-analysis/step_09_kpi_monitoring.md` (`KPI-10`, boundary events)
- `docs/40-clarifications/tenant_boundary_policy.md` (trusted signals and ambiguity definition)

## Canonical Term Alignment
Effective tenant key in current operational behavior is `tenant_id`.

Trusted signals used in this policy:
- `auth.session.tenant_id`
- `route.workspace.tenant_id`
- `admin_scope.target_tenant`
- `server_resolved_tenant_from_tour_id`

Ambiguous tenant context is defined exactly as in `docs/40-clarifications/tenant_boundary_policy.md`:
- more than one trusted signal present with different values, OR
- a required trusted signal missing in a context where it is mandatory.

Archive marketplace documents are historical reference only and are not canonical for current tenant behavior.

## Normative Fail-Closed Rules
1. Tenant-context failures MUST fail closed.
2. Operations MUST NOT continue when trusted tenant context is missing, ambiguous, or mismatched.
3. Payload tenant MUST NOT override trusted tenant signals.
4. Boundary-denied operations SHOULD be observable in monitoring/audit pipelines.

## Decision Matrix

| Context Issue | Signal Pattern | User-Facing Behavior | Error Class / Category | Supported Requirement IDs |
|---|---|---|---|---|
| Missing tenant context | Required trusted signal absent (e.g., missing `auth.session.tenant_id` where required) | Deny request; prompt re-auth/re-entry path | `TENANT_CONTEXT_MISSING` / Authorization boundary violation | `SR-NFR-001`, `SR-FR-003` |
| Ambiguous tenant context | Trusted signals disagree (e.g., `auth.session.tenant_id` != `route.workspace.tenant_id`) OR required trusted signal missing in mandatory context | Deny request; no fallback execution | `TENANT_CONTEXT_AMBIGUOUS` / Authorization boundary violation | `SR-NFR-001`, `SR-NFR-001-AC` |
| Auth/payload mismatch | Trusted auth/session tenant differs from `payload.tenant_id` | Deny request; ignore payload authority | `TENANT_SCOPE_MISMATCH` / Authorization boundary violation | `SR-NFR-001`, `SR-FR-003` |
| Admin scope mismatch | `admin_scope.target_tenant` not permitted by admin authorization scope | Deny request; no cross-tenant override in MVP | `TENANT_SCOPE_MISMATCH` / Authorization boundary violation | `SR-NFR-001` |

## Soft Fallback Review
OPEN: No explicit soft fallback is declared in active tenant baseline documents.  
OPEN: PM/Architect decision question: Should any controlled fallback path exist post-MVP, and if yes, for which exact operation class?

## Monitoring Link
- Boundary denials align conceptually with event `tenant_scope_violation_blocked`.
- Confirmed boundary breaches are counted in `KPI-10`.
