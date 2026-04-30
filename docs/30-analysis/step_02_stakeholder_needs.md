Document-ID: MKT-DOC-ANALYSIS-STEP-02
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Analysis Step 02: Stakeholder Needs and Requirements Framing

## 1. Purpose

Transform Step-01 micro-problems into structured stakeholder needs and testable requirement candidates.

---

## 2. Inputs

- `docs/30-analysis/step_01_business_mission.md`
- `docs/20-architecture/canonical_framework.md`
- `docs/10-product/requirements.md`
- `docs/00-governance/documentation_governance.md`

---

## 3. Stakeholder Needs (Needs Layer)

## 3.1 Tour Leader Needs

- `NEED-L-01` Receive complete participant data in one structured intake.
- `NEED-L-02` Verify payment proof quickly with low ambiguity.
- `NEED-L-03` See registration/payment/capacity state in one tenant-scoped panel.
- `NEED-L-04` Keep fair and explicit waitlist ordering.
- `NEED-L-05` Complete reconciliation with minimal manual corrections.

## 3.2 Participant Needs

- `NEED-P-01` Understand exactly what is required for valid registration.
- `NEED-P-02` See transparent registration and payment status.
- `NEED-P-03` Access communication link only when acceptance is confirmed.

## 3.3 Platform/Admin Needs

- `NEED-A-01` Maintain strong tenant isolation across all operations.
- `NEED-A-02` Keep status/decision traces auditable and reviewable.

---

## 4. Micro-Problem to Need Mapping

| Micro-Problem | Primary Need(s) |
|---|---|
| `MP-01` duplicate submissions | `NEED-L-01`, `NEED-L-03` |
| `MP-02` missing fields | `NEED-L-01`, `NEED-P-01` |
| `MP-03` payment-proof mismatch | `NEED-L-02`, `NEED-L-05` |
| `MP-04` status ambiguity | `NEED-L-03`, `NEED-P-02` |
| `MP-05` capacity visibility lag | `NEED-L-03` |
| `MP-06` waitlist ordering drift | `NEED-L-04` |
| `MP-07` channel fragmentation | `NEED-L-03`, `NEED-A-02` |
| `MP-08` reconciliation fatigue | `NEED-L-05` |

---

## 5. Requirement Candidates (Testable)

Normative interpretation in this document follows BCP 14 (`RFC2119`, `RFC8174`) for uppercase keywords.

## 5.1 Functional Requirement Candidates (FR-C)

- `FR-C-01` The system MUST enforce one active registration (`Pending` or `Accepted`) per `(user, tour)` pair.
- `FR-C-02` The system MUST validate mandatory participant fields before creating a registration.
- `FR-C-03` The leader workspace MUST provide unified registration, payment, and capacity visibility for tenant-scoped tours.
- `FR-C-04` The system MUST support explicit payment status recording (`NotPaid`, `Partial`, `Paid`) per registration.
- `FR-C-05` The system MUST keep waitlist ordering as FIFO for MVP.
- `FR-C-06` The system MUST enforce accepted-only access for tour communication link.
- `FR-C-07` The system MUST provide reconciliation-ready participant/payment status output per tour.

## 5.2 Non-Functional Requirement Candidates (NFR-C)

- `NFR-C-01` All registration/payment/waitlist operations MUST be tenant-scoped.
- `NFR-C-02` Status transitions SHOULD be auditable with actor and timestamp metadata.
- `NFR-C-03` Leader decision workflows SHOULD minimize context switching between channels.
- `NFR-C-04` The system MAY provide exportable reconciliation format in MVP (recommended as CSV baseline).

---

## 6. Acceptance Criteria Draft (Per Requirement Candidate)

## 6.1 FR-C Acceptance

- `FR-C-01-AC`: Attempting second active registration for same `(user, tour)` is rejected.
- `FR-C-02-AC`: Missing mandatory fields returns validation error; registration is not created.
- `FR-C-03-AC`: Leader can view registration status, payment status, and accepted count in one workspace context.
- `FR-C-04-AC`: Leader can set `NotPaid`/`Partial`/`Paid`; invalid status values are rejected.
- `FR-C-05-AC`: Earliest `Waiting` waitlist record is selected first during conversion.
- `FR-C-06-AC`: Non-accepted participants cannot view `chat_link`; accepted participants can.
- `FR-C-07-AC`: Tour-level reconciliation output lists participant identity + registration status + payment status.

## 6.2 NFR-C Acceptance

- `NFR-C-01-AC`: Cross-tenant record access attempts are denied in tested endpoints/views.
- `NFR-C-02-AC`: Critical status changes include actor and timestamp in audit trail.
- `NFR-C-03-AC`: Leader can complete review decisions without switching to external tracking sheets.
- `NFR-C-04-AC`: CSV export includes minimum reconciliation columns (tour, participant, reg-status, pay-status, paid-amount).

---

## 7. Priority and MVP Fit

### Must for MVP

- `FR-C-01` to `FR-C-06`
- `NFR-C-01`

### Should for MVP

- `FR-C-07`
- `NFR-C-02`, `NFR-C-03`

### May / MVP+

- `NFR-C-04`

---

## 8. Open Items to Resolve in Step 03

- Final mandatory participant field set (minimum schema).
- Exact payment-proof validation policy (required evidence attributes).
- Reconciliation CSV canonical column schema and ordering.
- Pending timeout and stale-request handling policy.

---

## 9. Step-02 Completion Criteria

Step 02 is complete when:

- each Step-01 micro-problem maps to at least one stakeholder need
- each priority need maps to at least one requirement candidate
- requirement candidates have draft acceptance criteria
- MVP priority bands are explicit
