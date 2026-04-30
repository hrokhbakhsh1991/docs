Document-ID: MKT-DOC-ANALYSIS-STEP-01
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Analysis Step 01: Business and Mission Analysis

## 1. Purpose

Define the business problem, mission focus, scope boundaries, and measurable goals before feature-level analysis.

---

## 2. Problem Statement

Tour leaders currently operate with fragmented, message-based workflows.
Registration, payment proof handling, acceptance, and reconciliation are mostly manual and error-prone.

This creates:

- inconsistent participant records
- unclear payment state tracking
- heavy manual follow-up workload
- weak reconciliation reliability

## 2.1 Micro-Problem Breakdown (Atomic Issues)

`MP-01` Duplicate participant submissions  
- Same person sends data multiple times across chat threads.  
- Impact: duplicate checks, wrong counts, delayed acceptance.

`MP-02` Missing required participant fields  
- Name/contact/transport option is often incomplete.  
- Impact: leader cannot decide quickly; repeated follow-up messages.

`MP-03` Payment proof mismatch  
- Screenshot exists but payer identity or amount is unclear.  
- Impact: manual reconciliation errors and disputes.

`MP-04` Status ambiguity  
- Participant says “I paid” but internal state is not updated consistently.  
- Impact: accepted/not-accepted decisions are delayed or inconsistent.

`MP-05` Capacity visibility lag  
- Accepted count is tracked manually and updated late.  
- Impact: overbooking or unnecessary waitlisting.

`MP-06` Waitlist ordering drift  
- Queue is managed by memory/chat chronology, not explicit records.  
- Impact: fairness issues and trust loss.

`MP-07` Channel fragmentation  
- Inputs spread across Telegram chat, direct messages, and external calls.  
- Impact: no single operational source of truth.

`MP-08` End-cycle reconciliation fatigue  
- Leader manually compiles paid/unpaid outcomes at the end.  
- Impact: high time cost and high error probability.

## 2.2 Root Cause Layer

- No structured intake form at source entry.
- No canonical status transition discipline.
- No unified tenant-scoped operation dashboard.
- No explicit event log per participant journey.
- Message-first workflow instead of data-first workflow.

## 2.3 Current-State Operational Sequence (As-Is)

1. Leader publishes text announcement in channel/group.
2. Participants send messages and payment proofs in scattered threads.
3. Leader manually reads, validates, and replies.
4. Leader tracks acceptance/capacity mentally or in ad-hoc notes.
5. Leader later tries to reconcile who paid and who is accepted.

Failure points are strongest at steps 2, 3, and 5.

---

## 3. Mission Statement

Build a leader-centric management platform that standardizes tour operations in one tenant-scoped workspace, while supporting both Telegram Mini App and standalone web entry.

The platform MUST reduce operational friction for leaders and improve decision clarity during registration, payment verification, and capacity control.

---

## 4. Business Objectives

1. Reduce manual operational overhead for leaders.
2. Increase transparency of participant and payment status.
3. Improve reliability of end-of-cycle reconciliation.
4. Enable scalable onboarding of multiple leaders without cross-tenant risk.

## 4.1 Objective-to-Problem Mapping

- `OBJ-01` (reduce manual overhead) addresses `MP-01`, `MP-02`, `MP-07`, `MP-08`.
- `OBJ-02` (status transparency) addresses `MP-03`, `MP-04`.
- `OBJ-03` (reconciliation reliability) addresses `MP-03`, `MP-08`.
- `OBJ-04` (safe scaling) addresses tenant isolation and governance risk.

---

## 5. Scope Boundary (Current Direction)

### In Scope

- leader-centric workspace operations
- tenant-scoped tour, registration, capacity, waitlist, and payment tracking
- dual-mode product access (Telegram + standalone web)
- post-onboarding Telegram linking for web users

### Out of Scope

- global cross-leader discovery marketplace
- recommendation and ranking systems
- full payment gateway automation in MVP

---

## 6. Primary Stakeholders

- `Tour Leaders`: primary operational users
- `Participants`: registration and payment-state consumers
- `Platform Admin`: governance, support, and tenant safety

---

## 7. Strategic Constraints

- Documentation MUST remain English-only in active docs.
- Canonical statuses and terms MUST align with `docs/20-architecture/canonical_framework.md`.
- Significant architecture/product decisions MUST be logged in `docs/20-architecture/decisions.md`.

---

## 8. Success Metrics (Step-01 Baseline)

Initial measurable indicators:

- reduction in manual follow-up actions per tour
- percentage of registrations with clear final status
- percentage of participants with explicit payment state
- reconciliation completion time per tour cycle

## 8.1 Micro-Metrics (Operational)

- `M-01` Duplicate submission ratio per tour
- `M-02` Incomplete registration field ratio
- `M-03` Payment-proof mismatch ratio
- `M-04` Time-to-decision from `Pending` to final status
- `M-05` Capacity mismatch incidents (`accepted` vs actual planned capacity)
- `M-06` Waitlist order violation count
- `M-07` Reconciliation correction count after first pass

---

## 9. Risks and Assumptions

### Assumptions

- Leaders are willing to move from chat-only operations to structured workflows.
- Participants can follow structured entry from leader-owned links.

### Risks

- mode confusion between Telegram and standalone entry paths
- incomplete identity linking adoption for web-first users
- tenant isolation mistakes in future implementation

## 9.1 Critical Open Questions for Next Step

- Which minimum participant fields are mandatory for acceptance decisions?
- What is the exact evidence policy for payment-proof validation?
- What timeout rule converts stale `Pending` registrations into actionable outcomes?
- Which reconciliation format (CSV schema) is mandatory in MVP?

---

## 10. Acceptance Criteria for Step 01

Step 01 is complete when:

- mission and problem are documented and approved
- in-scope/out-of-scope boundaries are explicit
- business objectives are measurable
- stakeholder set and top risks are clear
- micro-problems are explicitly listed and mapped to objectives
- baseline micro-metrics are defined for future validation

---

## 11. Canonical References

- `docs/00-governance/documentation_governance.md`
- `docs/20-architecture/canonical_framework.md`
- `docs/50-validation/leader_app_delta_analysis.md`
- `docs/10-product/requirements.md`
