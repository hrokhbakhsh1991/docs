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
- Record participant payment status:
  - `NotPaid`
  - `Partial`
  - `Paid`
- Optionally record `paid_amount`.
- Provide leader reconciliation visibility.

## Out of Scope (MVP)
- Real payment gateway execution
- Automatic settlement
- Complex financial accounting

## Flow
1. Leader defines tour cost model context.
2. Participant completes registration lifecycle.
3. Payment occurs outside system (real-world transfer/process).
4. Leader records payment state in system.
5. Dashboard reflects payment visibility for reconciliation.

## Data Rules
- Payment record is authoritative source-of-truth for read/export operations. Registration is a preliminary source; on mismatch, follow policy: 'Retry (up to 3x) then Reject and create reconciliations task'.
- Payment records may store details but are not gateway-authoritative in MVP.

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
