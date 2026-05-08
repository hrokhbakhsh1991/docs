# AuthZ and Tenant Endpoint Matrix v2

Document-ID: MKT-DOC-AUTHZ-TENANT-MATRIX-V2  
Version: v1.0  
Status: Active  
Owner: Product Documentation Team  
Last-Updated: 2026-05-05  
Language: English  
Canonical-Reference: docs/20-architecture/canonical_framework.md

## 1. Purpose

Define explicit per-endpoint authentication, authorization, and tenant-scope enforcement rules.

## 2. Normative Interpretation (BCP 14)

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and
"OPTIONAL" in this document are to be interpreted as described in
BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all capitals.

## 3. Role Definitions (Operational Scope)

- `Leader`: owner/admin permissions within tenant scope.
- `Leader`: downgraded to `USER` role with read-only access to non-owned workspaces.
- `Participant`: participant actions and own-journey reads.
- `Admin`: platform-level role. No cross-tenant admin read/write/export on MVP operational surfaces.
- `Anonymous`: unauthenticated session bootstrap only.

## 4. Endpoint Matrix

| Endpoint | AuthN | Allowed Roles | Tenant Rule | Fail-Closed Conditions | SR Coverage |
|---|---|---|---|---|---|
| `POST /api/v2/auth/telegram/session` | Telegram proof required | `Anonymous` | resolve tenant from trusted Telegram/session signal | missing/invalid Telegram context; tenant conflict | `SR-FR-008`, `SR-FR-009`, `SR-NFR-001` |
| `POST /api/v2/auth/web/session/otp` | phone + OTP | `Anonymous` | resolve tenant from trusted web signal (`Host` subdomain) | missing trusted context; tenant conflict | `SR-FR-008`, `SR-NFR-001` |
| `POST /api/v2/auth/link-telegram` | session required + Telegram proof | `Participant`, `Leader` | linked account MUST remain in session tenant | missing session; mismatched tenant; conflicting link target | `SR-FR-010`, `SR-NFR-001` |
| `POST /api/v2/tours` | session required | `Leader` | created tour MUST bind to trusted tenant | missing tenant context; forbidden role | `SR-FR-003`, `SR-NFR-001` |
| `PATCH /api/v2/tours/{tour_id}` | session required | `Leader` | by-id update MUST include tenant predicate | resource outside tenant; forbidden role | `SR-FR-003`, `SR-NFR-001` |
| `POST /api/v2/registrations` | mode-aware session/policy required | `Participant`, `Leader` | payload `tenant_id` MUST match trusted context | missing context; payload/trusted conflict | `SR-FR-001`, `SR-FR-002`, `SR-FR-008`, `SR-FR-009`, `SR-NFR-001` |
| `GET /api/v2/registrations/{registrationId}` | session required | `Participant`, `Leader` | by-id read MUST include tenant predicate | cross-tenant access attempt | `SR-FR-003`, `SR-NFR-001` |
| `PATCH /api/v2/registrations/{registrationId}/status` | session required | `Leader` | transition command MUST be tenant-scoped | forbidden role; cross-tenant target | `SR-FR-001`, `SR-FR-006`, `SR-NFR-001`, `SR-NFR-002` |
| `POST /api/v2/waitlist-items` | session required | `Participant`, `Leader` | create in trusted tenant scope | tenant conflict; duplicate active records | `SR-FR-005`, `SR-NFR-001` |
| `POST /api/v2/waitlist-items/{waitlistItemId}/convert` | session required | `Leader` | conversion MUST enforce tenant + FIFO eligibility | cross-tenant target; invalid status | `SR-FR-005`, `SR-NFR-001`, `SR-NFR-002` |
| `PATCH /api/v2/waitlist-items/{waitlistItemId}/cancel` | session required | `Participant`, `Leader` | cancel MUST be scoped to item tenant | cross-tenant target; invalid status | `SR-FR-005`, `SR-NFR-001`, `SR-NFR-002` |
| `PATCH /api/v2/registrations/{registrationId}/payment` | session required | `Leader` | payment update MUST be in registration tenant | cross-tenant target; forbidden role | `SR-FR-004`, `SR-NFR-001`, `SR-NFR-002` |
| `GET /api/v2/dashboard/leader-workspace` | session required | `Leader` | aggregate query MUST include tenant predicate | tenant mismatch/missing | `SR-FR-003`, `SR-NFR-001`, `SR-NFR-003` |
| `GET /api/v2/users` | session required | `Leader` (controller: JWT `owner`, `admin`) | list MUST be tenant membership for context `tenantId` | forbidden role; missing tenant context | — |
| `PATCH /api/v2/users/{id}` | session required | `Leader` (controller: JWT `owner`, `admin`) | target `user_tenants` row MUST be in tenant; workspace RBAC policy on role transitions | policy denial; cross-tenant target; not found in tenant | — |
| `POST /api/v2/workspaces/{tenantId}/invites` | session required | `Leader` (controller: JWT `owner`, `admin`) | invite MUST target path tenant; role assignment follows workspace invite policy | tenant mismatch; forbidden role; `owner` invite attempt rejected | — |
| `POST /api/v2/invites/accept` | session required | `Participant`, `Leader` | invite token MUST resolve to same email+tenant under trusted context | invite not found/expired; email mismatch; `owner` role invitation rejected | — |
| `POST /api/v2/workspaces/{tenantId}/ownership-transfer` | session required | `owner` | actor MUST be current owner in tenant; target MUST be active tenant member | actor not owner; target missing; tenant mismatch | — |
| `GET /api/v2/reconciliation/export.csv` | session required | `Leader` | export MUST be tenant + tour scoped | cross-tenant request; missing tour scope | `SR-FR-007`, `SR-NFR-001`, `SR-NFR-004` |

## 5. Tenant Enforcement Invariants

All operational endpoints MUST enforce:

1. Trusted context precedence from `docs/20-architecture/technical_spec.md` section 4.1.
2. Payload tenant assertions are advisory and MUST NOT override trusted context.
3. Missing required trusted context MUST fail closed.
4. Any trusted-context conflict MUST fail closed.
5. No cross-tenant admin read/write/export on MVP operational surfaces.
6. Workspace membership persistence MUST preserve ownership invariant (`exactly one active owner` at transaction commit).

## 6. Audit Emission Matrix (SR-NFR-002)

| Endpoint | Requirement Level | Event Type | SR-NFR-002 Scope |
|---|---|---|---|
| `POST /api/v2/registrations` | `Critical-MUST` | `registration_created` | Included |
| `PATCH /api/v2/registrations/{registrationId}/status` | `Critical-MUST` | `registration_status_changed` | Included |
| `PATCH /api/v2/registrations/{registrationId}/payment` | `Critical-MUST` | `payment_status_changed` | Included |
| `POST /api/v2/waitlist-items` | `Critical-MUST` | `waitlist_item_created` | Included |
| `POST /api/v2/waitlist-items/{waitlistItemId}/convert` | `Critical-MUST` | `waitlist_status_changed` (+linked `registration_created` if conversion creates registration) | Included |
| `PATCH /api/v2/waitlist-items/{waitlistItemId}/cancel` | `Critical-MUST` | `waitlist_status_changed` | Included |
| `POST /api/v2/auth/link-telegram` | `NonCritical-SHOULD` | `identity_linked` | Excluded |
| `GET /api/v2/reconciliation/export.csv` | `NonCritical-SHOULD` | `reconciliation_export_requested` | Excluded |

Rule: SR-NFR-002 coverage references only `Critical-MUST` rows.

## 7. Cross-References

- `docs/20-architecture/contracts/api_endpoint_contracts_v2.md`
- `docs/20-architecture/contracts/error_response_taxonomy_v2.md`
- `docs/20-architecture/contracts/audit_event_schema.md`
- `docs/20-architecture/technical_spec.md`

## 8. Mini Self-Check (Phase-1 Consistency Hardening)

- wildcard error references count: `0`
- inconsistent path param names count: `0`
- SR rows without endpoint mapping count: `0`
