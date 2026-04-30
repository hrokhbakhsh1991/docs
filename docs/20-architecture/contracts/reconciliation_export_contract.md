Document-ID: MKT-DOC-ANALYSIS-STEP-04C
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Analysis Step 04-C: Reconciliation Export Contract

## 1. Purpose

Freeze the minimum export contract for per-tour reconciliation outputs (`SR-FR-007`, `SR-NFR-004`).

---

## 2. Scope

Applies to leader-facing reconciliation export in MVP, recommended format: CSV.

---

## 3. Export Schema (Column Contract)

## 3.1 Required Columns

| Column Name | Type | Description |
|---|---|---|
| `tenant_id` | string | Tenant boundary identifier |
| `tour_id` | string | Tour identifier |
| `tour_title` | string | Tour title snapshot |
| `participant_id` | string | Participant identifier |
| `participant_full_name` | string | Participant name |
| `participant_contact_phone` | string | Contact reference |
| `registration_status` | enum | `Pending`, `Accepted`, `Rejected`, `Cancelled`, `NoShow` |
| `payment_status` | enum | `NotPaid`, `Partial`, `Paid` |
| `paid_amount` | number | Recorded paid amount (0 if absent) |
| `transport_mode` | enum/string | Selected transport mode |
| `entry_mode` | enum | `telegram` or `web` |
| `last_status_updated_at` | datetime | Latest status update time |

## 3.2 Optional Columns

| Column Name | Type | Description |
|---|---|---|
| `leader_note` | string | Internal note |
| `participant_note` | string | Participant note |
| `telegram_link_eligible` | boolean | Derived from accepted status rule |

---

## 4. Contract Rules

- `EXPORT-RULE-001`: Column names and ordering MUST remain stable once published for MVP.
- `EXPORT-RULE-002`: Export MUST be tenant-scoped and tour-scoped.
- `EXPORT-RULE-003`: Enum values in export MUST match canonical framework exactly.
- `EXPORT-RULE-004`: Numeric fields MUST use dot-decimal notation and UTF-8 output encoding.

## 4.1 Consistency Semantics (Backend Baseline)

- Export generation MUST use a single `snapshot_at` timestamp for a run.
- Every exported row MUST represent entity states as of `snapshot_at`.
- If domain updates happen during export run, they MUST either:
  - be excluded from current file and included in next run, or
  - be included only if they are fully visible before `snapshot_at`.
- Mixed pre/post-update row states within one export file are not allowed.

---

## 5. CSV Format Rules

- Header row REQUIRED.
- Delimiter SHOULD be comma (`,`).
- Text fields containing delimiter or quotes MUST be quoted per CSV escaping rules.
- File name convention SHOULD be:
  - `reconciliation_<tenant_id>_<tour_id>_<YYYYMMDD>.csv`

---

## 6. Acceptance Criteria

- `AC-EXPORT-001`: Export includes all required columns in defined order.
- `AC-EXPORT-002`: Export excludes records outside requested tenant/tour scope.
- `AC-EXPORT-003`: Registration and payment status values match canonical enums.
- `AC-EXPORT-004`: Generated file can be opened and parsed by standard spreadsheet tools without schema drift.
- `AC-EXPORT-005`: Export output is internally snapshot-consistent for the selected `snapshot_at`.

---

## 7. Traceability

- `SR-FR-007` -> per-tour reconciliation output
- `SR-NFR-004` -> exportable tabular contract
- `SR-NFR-001` -> tenant-scoped export boundaries

Related clarifications:
- `docs/40-clarifications/clarifications_backlog.md` (`CLAR-017`, `CLAR-018`)

---

## Changelog

- 2026-04-28: Added snapshot-consistency baseline semantics for export generation.
- 2026-04-28: Added export acceptance criterion for consistency window behavior and related clarification links.
