Document-ID: MKT-DOC-FLOW-CONSISTENCY-VALIDATION
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Flow Consistency Validation (Leader-Centric v2)

## 1. Purpose

This document validates whether core operational flows remain consistent after the shift to a leader-centric, dual-mode model.

Validated flow domains:
- Registration
- Capacity and waitlist
- Payment verification and reconciliation
- Telegram access governance

---

## 2. Validation Criteria

Each flow is checked against:

1. `Tenant scope`: no cross-leader data mixing
2. `Dual-mode consistency`: works in Telegram Mini App and standalone web
3. `Identity policy`: Telegram-required in Telegram mode, optional linking in web mode
4. `Status integrity`: canonical status transitions only
5. `Operational continuity`: preserves archived pain-point solutions

---

## 3. Registration Flow Validation

Source baseline:
- `marketplace_v1/flows/registration_flow` (non-local archive reference)

### Result

- `Consistent with edits required`

### Keep

- Pending -> Accepted/Rejected lifecycle
- Leader review/approval actions
- Duplicate active registration prevention
- Cancellation impact logic

### Required edits for v2

- Replace any implied global discovery entry with leader-owned entry context.
- Ensure every registration operation resolves tenant context from leader workspace.
- Clarify mode-aware identity entry:
  - Telegram path starts with Telegram identity.
  - Web path may start without Telegram and link later.

| Required edit | Target canonical file | Owner/role |
|---|---|---|
| Formalize tenant context precedence for registration requests | `docs/40-clarifications/clarifications_backlog.md` (CLAR-TNT-001) | Architect |
| Pin fail-closed behavior for missing/mismatch tenant context | `docs/40-clarifications/clarifications_backlog.md` (CLAR-005, CLAR-TNT-001) | Security |
| Freeze mode-specific identity entry contract for registration | `docs/40-clarifications/clarifications_backlog.md` (CLAR-003, CLAR-021) | Tech Lead |

---

## 4. Capacity Flow Validation

Source baseline:
- `marketplace_v1/flows/capacity_management_flow_EN` (non-local archive reference)

### Result

- `Fully consistent`

### Keep as canonical

- `Accepted` is the only capacity-consuming registration status.
- `accepted_count` and `total_capacity` remain source-of-truth fields.
- Full-capacity behavior routes users away from direct acceptance.

### v2 clarification

- Capacity checks must always be tenant-scoped by leader context.

---

## 5. Waitlist Flow Validation

Source baseline:
- `marketplace_v1/flows/waitlist_flow` (non-local archive reference)

### Result

- `Fully consistent`

### Keep as canonical

- Waitlist is a separate entity from registration.
- FIFO ordering remains MVP behavior.
- Conversion to registration must avoid active-record conflicts.

### v2 clarification

- Waitlist queue boundaries are per-tour and per-tenant.

---

## 6. Cost and Payment Flow Validation

Source baseline:
- `marketplace_v1/flows/cost_and_payment_flow` (non-local archive reference)

### Result

- `Consistent with terminology edits`

### Keep

- MVP payment is operational tracking, not online transaction execution.
- Leader records payment state and paid amount.
- Dashboard-style payment visibility is required for operations.

### Required edits

- Align participant status wording with canonical registration terms (`Accepted` instead of mixed labels).
- Enforce tenant-scoped reconciliation views.

| Required edit | Target canonical file | Owner/role |
|---|---|---|
| Finalize payment source-of-truth statement for MVP | `docs/40-clarifications/clarifications_backlog.md` (CLAR-017) | Architect |
| Freeze reconciliation consistency model under concurrent updates | `docs/40-clarifications/clarifications_backlog.md` (CLAR-018) | QA |
| Quantify payment-state invariants and transition constraints | `docs/40-clarifications/clarifications_backlog.md` (CLAR-015, CLAR-016) | Tech Lead |

---

## 7. Telegram Integration Flow Validation

Source baseline:
- `marketplace_v1/flows/telegram_integration_flow` (non-local archive reference)

### Result

- `Consistent with dual-mode additions`

### Keep

- Telegram link visibility for accepted participants only.
- Leader control of tour link source.

### Required additions

- Explicit dual-mode identity interactions:
  - Telegram mode: Telegram identity required.
  - Web mode: optional post-registration account linking.
- Mode-aware UX notes for users without Telegram context.

| Required edit | Target canonical file | Owner/role |
|---|---|---|
| Finalize linking state model and duplicate callback semantics | `docs/40-clarifications/clarifications_backlog.md` (CLAR-021, CLAR-022) | Tech Lead |
| Resolve identity mismatch handling across Telegram/Web accounts | `docs/40-clarifications/clarifications_backlog.md` (CLAR-024, CLAR-025) | Security |
| Link release-gating identity scenarios to stable tests | `docs/40-clarifications/clarifications_backlog.md` (CLAR-026) | QA |

---

## 8. Verification/Reconciliation Integrity Checks

To preserve the solved archive pain points:

- Payment proof review must remain a first-class leader workflow.
- Status transitions must be explicit and traceable.
- Reconciliation views must show participant/payment state per leader tenant.
- Export-ready structure should remain available for accounting workflows.

---

## 9. Final Consistency Verdict

### Reuse without change

- Capacity flow
- Waitlist flow core

### Reuse with focused edits

- Registration flow (entry and tenant context updates)
- Cost/payment flow (terminology alignment)
- Telegram flow (dual-mode identity additions)

### No flow redesign blocker found

The leader-centric shift does not invalidate core operational flows.  
Required changes are boundary/context updates and policy freeze items, not flow redesign.

---

## 10. Sprint 1 Kickoff Readiness

- Kickoff-ready stories (can start now): `STORY-01-02`, `STORY-02-01`, `STORY-02-02`, `STORY-03-01`, `STORY-03-02`, `STORY-05-01`.
- Blocked stories (policy-gated): `STORY-01-01` (`OPEN-KICKOFF-001`, `OPEN-KICKOFF-002`), `STORY-02-03` (`OPEN-KICKOFF-003`), `STORY-04-01` (`OPEN-KICKOFF-003`), `STORY-04-02` (`OPEN-KICKOFF-003`), `STORY-06-01` (`OPEN-KICKOFF-004`, `OPEN-KICKOFF-005`).
- Open kickoff blockers and impact:
  - `OPEN-KICKOFF-001` (`CLAR-TNT-001`): blocks Pre-Sprint-0 and Gate B tenant-safety closure.
  - `OPEN-KICKOFF-002` (`CLAR-TNT-003`): blocks Pre-Sprint-0 admin-scope wording alignment and Gate B policy consistency.
  - `OPEN-KICKOFF-003` (`CLAR-017`): blocks Pre-Sprint-0 payment truth freeze, Gate C checks, and payment-related sprint exits.
  - `OPEN-KICKOFF-004` (`CLAR-027`): blocks Pre-Sprint-0 audit obligation freeze and Gate C readiness.
  - `OPEN-KICKOFF-005` (`CLAR-029`): blocks Gate C transition-to-event completeness and release hardening confidence.
- Kickoff view: immediate start is allowed for non-policy-dependent implementation/test work; blocked items are soft-start only (prepare/analyze/test scaffold, no merge) until related `OPEN-KICKOFF-*` is resolved.
- Alignment status: Step 07 test strategy gates, Step 09 KPI trust assumptions, Step 08 Pre-Sprint-0 and sprint gates, Step 06 story/task flags, and this flow validation are synchronized against current CLAR and OPEN-KICKOFF mapping.
- Flow status: no flow redesign blocker is identified; remaining blockers are policy/clarification only.
