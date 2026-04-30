# Edge Cases and Failure Paths v2

Document-ID: MKT-DOC-EDGE-CASES-FAILURE-PATHS-V2  
Version: v1.0  
Status: Active  
Owner: Product Documentation Team  
Last-Updated: 2026-04-28  
Language: English  
Canonical-Reference: docs/20-architecture/canonical_framework.md

## Purpose

Freeze deterministic edge/failure behavior across FE, BE, and flow documents for P1-critical implementation safety.

## Normative Interpretation (BCP 14)

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and
"OPTIONAL" in this document are to be interpreted as described in
BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all capitals.

## Edge Handling Rules

- No edge path may violate canonical statuses:
  - Registration: `Pending|Accepted|Rejected|Cancelled|NoShow`
  - Payment Aggregate: `Pending|Paid|Failed|Refunded|Cancelled`
  - Registration Payment Field: `NotPaid|Partial|Paid`
  - Waitlist: `Waiting|Converted|Cancelled`
- Fail-closed MUST apply for tenant/authz uncertainty.
- Critical transitions MUST emit required audit events per `docs/20-architecture/contracts/audit_event_schema.md`.

## B) Edge Case Matrix (Case ID -> Requirement -> Endpoint -> Expected Error/State -> Audit -> Test Ref)

| Case ID | Trigger | Guard | Requirement | Endpoint | Expected Error/State | Audit Expectation | Test Ref |
|---|---|---|---|---|---|---|---|
| `EC-REG-001` | participant submits second active registration for same `(user_id,tour_id)` | active states are `Pending|Accepted` | `SR-FR-001` | `POST /api/v2/registrations` | `REGISTRATION_DUPLICATE_ACTIVE`; existing active record unchanged | no new critical transition event | Step-07 §5 `SR-FR-001` duplicate attempt |
| `EC-REG-002` | leader accepts while capacity already full | only `Accepted` consumes capacity | `SR-FR-001`, `SR-FR-005` | `PATCH /api/v2/registrations/{registrationId}/status` | `CAPACITY_FULL`; status remains previous value | if transition blocked, no `registration_status_changed` event | Step-07 §5 `SR-FR-001` + `SR-FR-005` |
| `EC-REG-003` | invalid registration transition requested (e.g., `Rejected -> Accepted` if guard disallows) | transition table guard | `SR-FR-006`, `SR-NFR-002` | `PATCH /api/v2/registrations/{registrationId}/status` | `STATE_TRANSITION_INVALID` | blocked transition MUST NOT emit state-changed event | Step-07 §5 `SR-FR-006` |
| `EC-REG-004` | concurrent accept commands on same registration | optimistic/transactional concurrency guard | `SR-FR-001`, `SR-NFR-002` | `PATCH /api/v2/registrations/{registrationId}/status` | one succeeds; loser gets `CONCURRENCY_CONFLICT` | exactly one `registration_status_changed` for winning transition | Step-07 §4.2 transactional consistency |
| `EC-WAIT-001` | FIFO conversion attempt skips earlier eligible item | strict FIFO ordering | `SR-FR-005` | `POST /api/v2/waitlist-items/{waitlistItemId}/convert` | `STATE_TRANSITION_INVALID` (or command rejected by eligibility guard) | no conversion event on rejected command | Step-07 §5 `SR-FR-005` FIFO correctness |
| `EC-WAIT-002` | conversion race creates active waitlist+registration conflict | uniqueness/conflict guard | `SR-FR-005`, `SR-FR-001` | `POST /api/v2/waitlist-items/{waitlistItemId}/convert` | `WAITLIST_CONFLICT_ACTIVE_RECORD` | rejected conversion MUST NOT emit `waitlist_status_changed` | Step-07 §5 `SR-FR-005` conflict-safe conversion |
| `EC-WAIT-003` | cancel request arrives after successful convert | state freshness guard | `SR-FR-005`, `SR-NFR-002` | `PATCH /api/v2/waitlist-items/{waitlistItemId}/cancel` | `STATE_TRANSITION_INVALID` (`Converted` cannot move to `Cancelled`) | no new waitlist state-change event | Step-07 §4.2 waitlist conversion workflow |
| `EC-WAIT-004` | simultaneous convert and cancel on same `Waiting` item | atomic state transition lock | `SR-FR-005`, `SR-NFR-002` | `POST /api/v2/waitlist-items/{waitlistItemId}/convert`, `PATCH /api/v2/waitlist-items/{waitlistItemId}/cancel` | one command succeeds, other receives `CONCURRENCY_CONFLICT` or `STATE_TRANSITION_INVALID` | exactly one `waitlist_status_changed` for winning path | Step-07 §4.2 transactional consistency |
| `EC-PAY-001` | registration payment field update uses non-canonical enum | enum guard | `SR-FR-004` | `PATCH /api/v2/registrations/{registrationId}/payment` | `VALIDATION_ENUM_INVALID` | no `payment_status_changed` event | Step-07 §5 `SR-FR-004` enum validation |
| `EC-PAY-002` | amount/status algebra mismatch (e.g., `Paid` with invalid amount relation) | payment algebra guard | `SR-FR-004` | `PATCH /api/v2/registrations/{registrationId}/payment` | `PAYMENT_STATUS_TRANSITION_INVALID` | no state-change event on rejected update | Step-07 §5 `SR-FR-004` state persistence |
| `EC-PAY-003` | concurrent payment updates on same registration | concurrency guard | `SR-FR-004`, `SR-NFR-002` | `PATCH /api/v2/registrations/{registrationId}/payment` | one update wins, loser gets `CONCURRENCY_CONFLICT` | exactly one winning `payment_status_changed` per committed update | Step-07 §4.2 transactional consistency |
| `EC-PAY-004` | export snapshot overlaps with in-flight updates | snapshot consistency guard | `SR-FR-007`, `SR-NFR-004` | `GET /api/v2/reconciliation/export.csv` | `EXPORT_SNAPSHOT_INCONSISTENT` or stable snapshot output | NonCritical-SHOULD `reconciliation_export_requested`; no critical audit dependency | Step-07 §6.3 export contract tests |
| `EC-PAY-005` | provider webhook repeats same terminal status | idempotent webhook handling | `SR-FR-004`, `SR-NFR-002` | `POST /internal/payments/webhook` | endpoint returns `200`; duplicate state change is ignored safely | no duplicate critical transition side effects | Step-07 §4.2 idempotent/retry behavior |
| `EC-PAY-006` | pending payment exceeds timeout threshold | timeout processor guard | `SR-FR-004`, `SR-FR-005` | scheduled timeout processor | payment transitions to `Failed`; registration capacity recovery path runs | emits canonical payment + registration transition events once | Step-07 §4.2 transactional consistency |
| `EC-ID-001` | Telegram-required path called without valid Telegram context | mode-aware auth guard | `SR-FR-009`, `SR-FR-008` | `POST /api/v2/auth/telegram/session`, `POST /api/v2/registrations` (`entry_mode=telegram`) | `AUTH_TELEGRAM_CONTEXT_REQUIRED` | no critical transition event | Step-07 §5 `SR-FR-009` |
| `EC-ID-002` | relink replay with same data | idempotency guard | `SR-FR-010` | `POST /api/v2/auth/link-telegram` | success replay (same result) | NonCritical-SHOULD `identity_linked` emitted once logically | Step-07 §4.3 web-mode + connect path |
| `EC-ID-003` | idempotency key replay with different payload | idempotency mismatch guard | `SR-FR-010` | `POST /api/v2/auth/link-telegram` | `IDEMPOTENCY_KEY_REPLAY_MISMATCH` | no linking event on rejected replay | Step-07 §4.2 idempotent/retry behavior target |
| `EC-ID-004` | linking/auth operation with tenant mismatch | tenant fail-closed | `SR-NFR-001`, `SR-FR-010` | `POST /api/v2/auth/link-telegram`, `POST /api/v2/auth/telegram/session` | `TENANT_SCOPE_CONFLICT` or `TENANT_SCOPE_FORBIDDEN` | no critical transition event | Step-07 §7.2 tenant safety gate |
| `EC-TNT-001` | trusted tenant signal missing in required endpoint class | fail-closed invariant | `SR-NFR-001` | all protected endpoints | `TENANT_CONTEXT_MISSING` | blocked command emits no domain transition event | Step-07 §7.2 fail-closed tests |
| `EC-TNT-002` | actor role lacks operation permission | authz guard | `SR-NFR-001`, `SR-FR-003` | all protected endpoints | `AUTH_FORBIDDEN_ROLE` | no domain transition event | Step-07 §7.2 authorization tests |
| `EC-TNT-003` | cross-tenant by-id read/write attempt | tenant predicate guard | `SR-NFR-001` | by-id endpoints (`registrations`, `waitlist`, `payment`, `tours`) | `TENANT_SCOPE_FORBIDDEN` or `RESOURCE_NOT_FOUND` (scoped) | no unauthorized state-change event | Step-07 §5 `SR-NFR-001` |

## A) Validation Rule Matrix (summarized links to UX contract)

| Validation Domain | Primary Endpoint(s) | Canonical Error Codes | Source Contract |
|---|---|---|---|
| Intake required/enum/conditional | `POST /api/v2/registrations` | `VALIDATION_REQUIRED_FIELD_MISSING`, `VALIDATION_ENUM_INVALID`, `AUTH_TELEGRAM_CONTEXT_REQUIRED` | `docs/10-product/form_validation_ux_contract_v2.md` |
| Mutation transition guards | `PATCH /api/v2/registrations/{registrationId}/status`, `POST /api/v2/waitlist-items/{waitlistItemId}/convert`, `PATCH /api/v2/registrations/{registrationId}/payment` | `STATE_TRANSITION_INVALID`, `CAPACITY_FULL`, `WAITLIST_CONFLICT_ACTIVE_RECORD`, `PAYMENT_STATUS_TRANSITION_INVALID` | `docs/10-product/form_validation_ux_contract_v2.md` |
| Tenant/auth fail-closed | protected endpoints | `TENANT_CONTEXT_MISSING`, `TENANT_SCOPE_CONFLICT`, `TENANT_SCOPE_FORBIDDEN`, `AUTH_FORBIDDEN_ROLE` | `docs/20-architecture/contracts/authz_tenant_endpoint_matrix_v2.md` |

## C) Conflict Resolution Notes

1. **Duplicate-active vs capacity-full precedence**:
   - command first checks active duplicate invariant for same participant-tour; if already active, returns `REGISTRATION_DUPLICATE_ACTIVE`.
   - capacity check applies to acceptance transitions where duplicate rule is not violated.
2. **Waitlist cancel-after-convert ambiguity**:
   - once item is `Converted`, cancellation request is invalid and MUST return `STATE_TRANSITION_INVALID`.
3. **Identity relink behavior**:
   - same logical linking replay is idempotent success.
   - different payload with same idempotency key MUST return `IDEMPOTENCY_KEY_REPLAY_MISMATCH`.
4. **Tenant violation response policy**:
   - use fail-closed with `TENANT_*` codes; do not leak cross-tenant data.

## D) Residual Risks

- **Risk-01 (Medium):** Full formal transition table for all legal registration/payment/waitlist from->to pairs is distributed across contracts; central consolidated transition table would further reduce interpretation risk.
- **Risk-02 (Low):** NonCritical telemetry events (`identity_linked`, `reconciliation_export_requested`) are documented but not part of SR-NFR-002 hard-gate set.

## Determinism Statement

All P1-critical edge and failure outcomes above are deterministic by:
- explicit trigger + guard,
- explicit endpoint,
- canonical error code,
- explicit audit expectation,
- explicit requirement and test reference mapping.

## Self-Check

- validation rules with endpoint mapping count: `17` (source: `docs/10-product/form_validation_ux_contract_v2.md`)
- edge cases with full mapping (req+endpoint+test) count: `19`
- contradictions found with existing contracts: `0`
