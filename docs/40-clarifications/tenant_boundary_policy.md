# Tenant Boundary Policy v1 (Draft)

## Context
This document defines tenant-boundary resolution and mismatch handling in a leader-centric, tenant-isolated MVP.
Implements CLAR-001 and CLAR-003; references CLAR-005 for fail-closed treatment details.

Based on current behavior inventory: `docs/40-clarifications/spec_inventory_tenant.md`

## Current Behavior Anchors
- Effective tenant key in active artifacts is `tenant_id`.
- `workspace` appears as contextual routing/workspace concept, not as a modeled canonical key like `workspace_id`.
- Archive marketplace documents are historical reference only and are not canonical for current tenant behavior.

## Scope & Out-of-Scope
### Scope
- Trusted tenant context resolution by entry channel (Web UI, API, Telegram, Backoffice).
- Precedence and conflict behavior between trusted signals and payload `tenant_id`.
- High-level mismatch classification for API behavior.

### Out-of-Scope
- Full API error schema payload format.
- DB implementation details.
- Non-tenant business rules (capacity, payment, waitlist ordering).

## Trusted Tenant Signals (Authoritative Set)

| Trusted Signal | Meaning | Typical Source | Precedence Role |
|---|---|---|---|
| `auth.session.tenant_id` | Tenant bound to authenticated actor/session context | Backend auth/session service | Primary |
| `route.workspace.tenant_id` | Tenant implied by leader/workspace route context | Frontend route -> backend route/resource resolver | Secondary (checked against primary) |
| `admin_scope.target_tenant` | Explicit tenant target for admin-scoped operation | Backend admin control plane | Primary in admin-scoped flows |
| `server_resolved_tenant_from_tour_id` | Tenant resolved server-side from trusted tour ownership mapping | Backend domain/service layer | Secondary/derived verifier |

Normative rule:
- Trusted signals above are authoritative for tenant resolution.
- `payload.tenant_id` is not a trusted signal.

## Definition: Ambiguous Tenant Context
Ambiguous tenant context means either:
1) more than one trusted signal is present and they have different tenant values, or  
2) a trusted signal required by the current channel is missing.

Example: `auth.session.tenant_id != route.workspace.tenant_id` in Web UI, or missing `auth.session.tenant_id` where authenticated context is mandatory.

## Normative Resolution Rules
0. Tenant trusted-signal precedence: Web > API > Backoffice > Telegram. In case of missing trusted signal, apply FAIL-CLOSED by default.
1. The system MUST resolve tenant context from trusted signals before evaluating any payload tenant field.
2. If `auth.session.tenant_id` exists, client `payload.tenant_id` MUST be treated as advisory only.
3. Client `payload.tenant_id` MUST NOT override trusted tenant context.
4. Any trusted-signal conflict MUST fail closed.
5. Missing required trusted signal in a channel that requires it MUST fail closed.
6. Resolution behavior MUST be deterministic across Telegram and Web modes (`SR-FR-008-AC`).

## Tenant Context Resolution Order

| Entry Channel | Inputs Considered | Precedence Order | Conflict / Mismatch Failure Mode |
|---|---|---|---|
| Web UI | `auth.session.tenant_id`, `route.workspace.tenant_id`, `payload.tenant_id` | 1) `auth.session.tenant_id` 2) `route.workspace.tenant_id` 3) `payload.tenant_id` (advisory) | Deny request; category: authorization boundary violation; class: `TENANT_SCOPE_MISMATCH`; HTTP: `403` |
| API (authenticated) | `auth.session.tenant_id` (or token tenant), route/resource scope, `payload.tenant_id` | 1) auth tenant 2) route/resource tenant 3) payload tenant (advisory) | Deny request; category: authorization boundary violation; class: `TENANT_SCOPE_MISMATCH`; HTTP: `403` |
| Telegram | validated Telegram auth context, `server_resolved_tenant_from_tour_id`, `payload.tenant_id` | 1) validated auth/session tenant 2) server-resolved tenant from tour 3) payload tenant (advisory) | Deny request; category: authorization boundary violation; class: `TENANT_SCOPE_MISMATCH`; HTTP: `403` |
| Backoffice | `admin_scope.target_tenant`, admin auth scope, `payload.tenant_id` | 1) `admin_scope.target_tenant` 2) auth scope check 3) payload tenant (advisory) | Deny request on scope mismatch; class: `TENANT_SCOPE_MISMATCH`; HTTP: `403` |

## Client `tenant_id` Authority
- With trusted auth/session context: `payload.tenant_id` is advisory.
- Without trusted tenant context: request MUST be denied.
- `payload.tenant_id` as sole authority is not permitted in current MVP baseline.
- Effective tenant key in current operational behavior remains `tenant_id`.

## Mismatch Handling Category
- High-level category: Authorization boundary violation.
- Recommended class name: `TENANT_SCOPE_MISMATCH`.
- Recommended status:
  - `403 Forbidden` for authenticated mismatch/conflict.
  - `401 Unauthorized` when required auth context is absent/invalid.
- Tenant mismatch is not a pure validation error.

## Backoffice/Admin MVP Policy
Canonical phrase for MVP admin cross-tenant: 'No cross-tenant admin read/write/export on MVP operational surfaces'. Apply this phrase verbatim in all backend docs.

OPEN: PM/Architect decision needed on whether any cross-tenant admin capability is required post-MVP and, if yes, which exact operations are eligible.
OPEN: If post-MVP cross-tenant admin is approved, define mandatory guardrails (role checks, MFA requirement, audit event obligations, and explicit approval workflow).

## Traceability
- `SR-NFR-001`, `SR-FR-003`, `SR-FR-008`, `SR-FR-009`, `SR-FR-010`
- Align with: `docs/40-clarifications/tenant_fail_closed_policy.md`, `docs/40-clarifications/participant_context_resolution_contract.md`

---

## Changelog

- 2026-04-28: Applied resolved tenant precedence and canonical MVP admin phrase in normative policy text. — Decision Source: CLAR-TNT-001/CLAR-TNT-003 — 2026-04-28
