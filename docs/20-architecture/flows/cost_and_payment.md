Document-ID: MKT-FLOW-COST-PAYMENT-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Cost and Payment Flow v2

## Purpose
Define MVP operational payment tracking for leader workflows.

## MVP Scope
- Track payment lifecycle per registration in `payments` aggregate:
  - `Pending`
  - `Paid`
  - `Failed`
  - `Refunded`
  - `Cancelled`
- Store provider metadata (`provider`, `provider_payment_id`, amount, currency).
- Support admin/leader operational visibility and reconciliation snapshots.
- Keep registration-facing payment fields (`NotPaid` / `Partial` / `Paid`) for command/UI compatibility.

## Out of Scope (MVP)
- Full PSP workflow orchestration beyond status ingestion contract
- Automatic settlement ledgering and accounting closing
- Complex financial accounting

## Flow
1. Leader defines tour cost model context.
2. Participant enters registration flow; when payment is required, a `Pending` payment intent is created.
3. Internal webhook endpoint ingests provider status updates.
4. Payment transition side effects:
   - `Pending -> Paid` updates registration to `AcceptedPaid`.
   - `Pending -> Failed` updates registration to `Rejected`, recovers capacity, and may promote waitlist.
   - `Paid -> Refunded` updates registration to `Refunded`, recovers capacity, and may promote waitlist.
5. Timeout processor periodically marks stale `Pending` payments as `Failed` using the same side-effect path.
6. Dashboard/ops surfaces expose payment and recovery metrics for reconciliation.

## Data Rules
- Payment record is authoritative source-of-truth for read/export operations. Registration is a preliminary source; on mismatch, follow policy: 'Retry (up to 3x) then Reject and create reconciliations task'.
- Payment records store operational provider status but do not represent full accounting settlement state in MVP.

## Tenant Safety
- Payment and reconciliation views are isolated by leader tenant.

## Related Backend References
- `docs/20-architecture/data_model.md`
- `docs/20-architecture/contracts/reconciliation_export_contract.md`
- `docs/20-architecture/contracts/audit_event_schema.md`

---

## Changelog

- 2026-04-28: Added backend cross-references for payment source-of-truth, export contract, and audit consistency.
- 2026-04-28: Updated payment source-of-truth and mismatch handling policy text to resolved CLAR wording. — Decision Source: CLAR-017 — 2026-04-28
