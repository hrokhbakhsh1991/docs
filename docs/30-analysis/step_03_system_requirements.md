Document-ID: MKT-DOC-ANALYSIS-STEP-03
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Analysis Step 03: System Requirements Baseline

## 1. Purpose

Promote Step-02 requirement candidates into a finalized system/software requirements baseline with stable identifiers and explicit traceability.

---

## 2. Inputs

- `docs/30-analysis/step_01_business_mission.md`
- `docs/30-analysis/step_02_stakeholder_needs.md`
- `docs/10-product/requirements.md`
- `docs/20-architecture/canonical_framework.md`
- `docs/20-architecture/flows/*.md`

---

## 3. Final Requirement Set (SR)

Normative interpretation in this document follows BCP 14 (`RFC2119`, `RFC8174`) for uppercase keywords.

## 3.1 Functional Requirements (SR-FR)

- `SR-FR-001` The system MUST enforce at most one active registration (`Pending`, `Accepted`) per `(user_id, tour_id)`.
- `SR-FR-002` The system MUST reject registration creation if mandatory participant fields are missing.
- `SR-FR-003` The system MUST expose tenant-scoped leader visibility for registration status, payment status, and capacity state.
- `SR-FR-004` The system MUST support payment status recording per registration using canonical values: `NotPaid`, `Partial`, `Paid`.
- `SR-FR-005` The system MUST enforce FIFO waitlist conversion for eligible `Waiting` entries in MVP.
- `SR-FR-006` The system MUST allow tour communication link access only when `Registration.status = Accepted`.
- `SR-FR-007` The system MUST provide per-tour reconciliation output with participant and status fields.
- `SR-FR-008` The system MUST support dual-mode access (Telegram Mini App and standalone web) with one shared business core.
- `SR-FR-009` The system MUST require Telegram identity in Telegram mode.
- `SR-FR-010` The system MUST provide a post-onboarding `Connect Telegram` pathway in standalone web mode.

## 3.2 Non-Functional Requirements (SR-NFR)

- `SR-NFR-001` All operational reads/writes for registration, waitlist, payment, and dashboard MUST be tenant-scoped.
- `SR-NFR-002` Critical status transitions MUST be audit-logged with actor and timestamp.

---

## 3.3 Requirement ID Lineage (FR/NFR -> SR)

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and
"OPTIONAL" in this section are to be interpreted as described in
BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all capitals.

- Every `SR-FR-*` entry MUST map to one or more source `FR-*` entries from `docs/10-product/requirements.md`.
- Every `SR-NFR-*` entry MUST map to one or more source `NFR-*` entries from `docs/10-product/requirements.md`.
- Every source `FR-*` and `NFR-*` MUST be represented by at least one `SR-*` entry.
- Any unmapped ID MUST be treated as a documentation QA failure.
- `SR-NFR-003` Leader workflows SHOULD minimize cross-channel context switching for core decisions.
- `SR-NFR-004` Reconciliation output SHOULD be available in exportable tabular format (CSV recommended).

---

## 4. Acceptance Criteria (Final Draft)

## 4.1 Functional

- `SR-FR-001-AC`: second active registration attempt for same participant-tour pair is denied.
- `SR-FR-002-AC`: payloads missing mandatory fields return validation errors and do not create records.
- `SR-FR-003-AC`: leader workspace shows synchronized registration/payment/capacity state for owned tours.
- `SR-FR-004-AC`: only canonical payment enum values are accepted; invalid values are rejected.
- `SR-FR-005-AC`: waitlist conversion chooses earliest eligible waiting entry first.
- `SR-FR-006-AC`: non-accepted users cannot retrieve communication link; accepted users can.
- `SR-FR-007-AC`: reconciliation output includes participant identity and canonical status fields.
- `SR-FR-008-AC`: same domain rules hold for Telegram and web entry modes.
- `SR-FR-009-AC`: Telegram mode requests without valid Telegram identity context are rejected.
- `SR-FR-010-AC`: standalone web users can discover and invoke Telegram linking after onboarding.

## 4.2 Non-Functional

- `SR-NFR-001-AC`: cross-tenant data access tests fail closed.
- `SR-NFR-002-AC`: status transitions include actor and timestamp metadata.
- `SR-NFR-003-AC`: leader can complete core decision path without external sheet dependency.
- `SR-NFR-004-AC`: export format contains stable, documented reconciliation columns.

---

## 5. Priority Bands

### MVP-Must

- `SR-FR-001` to `SR-FR-006`
- `SR-FR-008` to `SR-FR-010`
- `SR-NFR-001`

### MVP-Should

- `SR-FR-007`
- `SR-NFR-002`
- `SR-NFR-003`

### MVP+

- `SR-NFR-004`

---

## 6. Traceability Matrix (Need -> Requirement -> Flow -> Metric)

| Need ID | Requirement ID(s) | Primary Flow(s) | Primary Metric(s) |
|---|---|---|---|
| `NEED-L-01` | `SR-FR-001`, `SR-FR-002` | `docs/20-architecture/flows/registration.md` | `M-01`, `M-02` |
| `NEED-L-02` | `SR-FR-004`, `SR-FR-007` | `docs/20-architecture/flows/cost_and_payment.md` | `M-03`, `M-07` |
| `NEED-L-03` | `SR-FR-003`, `SR-FR-008` | `docs/20-architecture/flows/registration.md`, `docs/20-architecture/flows/capacity_management.md` | `M-04`, `M-05` |
| `NEED-L-04` | `SR-FR-005` | `docs/20-architecture/flows/waitlist.md` | `M-06` |
| `NEED-L-05` | `SR-FR-007`, `SR-NFR-004` | `docs/20-architecture/flows/cost_and_payment.md` | `M-07` |
| `NEED-P-01` | `SR-FR-002` | `docs/20-architecture/flows/registration.md` | `M-02` |
| `NEED-P-02` | `SR-FR-003`, `SR-FR-004` | `docs/20-architecture/flows/registration.md`, `docs/20-architecture/flows/cost_and_payment.md` | `M-04` |
| `NEED-P-03` | `SR-FR-006` | `docs/20-architecture/flows/telegram_integration.md` | `M-04` |
| `NEED-A-01` | `SR-NFR-001` | all tenant-scoped flows | `M-05` |
| `NEED-A-02` | `SR-NFR-002` | all status-changing flows | `M-07` |

---

## 7. Open Items for Step 04

- Finalize mandatory participant field schema and data types.
- Finalize audit-log minimal event schema.
- Freeze reconciliation export column contract.

---

## 8. Step-03 Completion Criteria

Step 03 is complete when:

- final SR identifiers are stable and unique
- each SR has draft acceptance criteria
- MVP priority bands are explicit
- traceability matrix is complete and consistent
