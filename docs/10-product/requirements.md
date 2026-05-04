Document-ID: MKT-DOC-REQUIREMENTS-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Requirements v2 (Leader-Centric, Dual-Mode)

## 1. Purpose

This document defines the active requirements baseline for the leader-centric product model.

It reuses validated operational requirements from archive and replaces only marketplace-discovery assumptions.

---

## 2. Requirement Normalization Policy

- Keep all previously validated leader operation requirements.
- Rewrite only requirements that assume global cross-leader browsing.
- Standardize terminology to tenant-scoped language.

Canonical terms:
- `leader workspace`
- `tenant scope`
- `dual-mode access`
- `account linking`

---

## 3. Functional Requirements (FR)

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and
"OPTIONAL" in this section are to be interpreted as described in
BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all capitals.

## 3.1 Tenant and Access Model

- `FR-01` The system MUST provide an isolated workspace per leader (tenant-scoped data and operations).
- `FR-02` Leader and authorized roles MUST access only their own tenant data.
- `FR-03` Participant-facing views MUST resolve in the context of the leader they entered from.

## 3.2 Dual-Mode Entry

- `FR-10` The app MUST support Telegram Mini App entry.
- `FR-11` The app MUST support standalone web entry.
- `FR-12` Both modes MUST use one shared business core (no split products).

## 3.3 Identity and Linking

- `FR-20` In Telegram mode, Telegram identity is mandatory.
- `FR-21` In standalone web mode, registration MAY continue without Telegram.
- `FR-22` Web users MUST be offered a visible `Connect Telegram` action after onboarding.
- `FR-23` The system MUST maintain account continuity between web and Telegram identities when linked.

## 3.4 Tour and Registration Operations

- `FR-30` Leaders can create and manage tours in their workspace.
- `FR-31` Participants MAY submit registration requests for a leader-specific tour.
- `FR-32` Registration lifecycle MUST support: `Pending`, `Accepted`, `Rejected`, `Cancelled`, `NoShow`.
- `FR-33` A participant MUST NOT hold more than one active registration (`Pending`/`Accepted`) per tour.
- `FR-34` Leaders MAY accept/reject/cancel registrations from a management panel.

## 3.5 Capacity and Waitlist

- `FR-40` Capacity source of truth remains tour-level (`total_capacity`, `accepted_count`).
- `FR-41` Only `Accepted` registrations consume capacity.
- `FR-42` If capacity is full, users MUST be routed to waitlist flow (not accepted directly).
- `FR-43` Waitlist ordering MUST remain FIFO for MVP.
- `FR-44` Converting a waitlist entry to registration MUST prevent duplicate active records.

## 3.6 Payment Tracking and Verification

- `FR-50` The system MUST support payment-proof-based manual verification workflow.
- `FR-51` Leaders MAY set participant payment states: `NotPaid`, `Partial`, `Paid`.
- `FR-52` Optional paid amount can be recorded per registration.
- `FR-53` Payment tracking remains operational (recording/visibility), not real transaction processing in MVP.

## 3.7 Telegram Link Governance

- `FR-60` Tour Telegram link MAY be stored and managed by leader roles.
- `FR-61` (**MVP behavior**) The tour chat link MUST be visible only to **tour leaders** in the workspace (non-leaders MUST NOT be shown the link in the MVP UI).

  The full product vision is that **accepted participants** can see the chat link when policy and channel context allow. For **MVP**, the web workspace is **leader-focused** (tour setup, registrations, payments, and operational links), so communication-link visibility is intentionally limited to **leaders only** to reduce scope and delivery risk. **Participant-facing visibility** of the same link (including enrollment and acceptance rules aligned with governance such as `FR-62`) is **out of scope for MVP** and will be implemented in a **future version**; until then, treat broader participant visibility as a **post-MVP** target unless a requirement is explicitly labeled **MVP behavior** as above.

- `FR-62` Waitlist and non-accepted states MUST NOT access Telegram link.

## 3.8 Dashboard and Reconciliation

- `FR-70` Leaders MUST have a dashboard view for registration and payment visibility.
- `FR-71` The system SHOULD provide operational summaries for reconciliation (counts/statuses/amount view).
- `FR-72` Export capability (CSV) is recommended for reconciliation workflows in MVP+.

---

## 4. Non-Functional Requirements (NFR)

- `NFR-01` Tenant isolation MUST be enforced consistently at API, data, and UI levels.
- `NFR-02` Mobile-first usability is required for both Telegram and standalone contexts.
- `NFR-03` Identity and authorization checks MUST be explicit and auditable.
- `NFR-04` Documentation and terminology MUST remain consistent across active docs.
- `NFR-05` MVP delivery MUST prioritize low-complexity, high-operations-impact capabilities.

---

## 5. Marketplace-to-Leader Requirement Rewrite Map

| Legacy Assumption | v2 Replacement |
|---|---|
| Users browse all leaders' tours in one global listing | Users enter leader-specific workspace context via leader-owned channels |
| Platform-level discovery is a primary funnel | Leader-owned entry links/channels are primary funnel |
| Cross-leader participant journey is core | Single leader-tenant journey is core |

---

## 6. Out of Scope (Current v2)

- Global cross-leader tour discovery marketplace
- Complex cross-tenant recommendation/ranking features
- Full online payment gateway and automated settlement
- Advanced multi-channel notification automation

---

## 7. Traceability Notes

Reused from archive (kept with minimal change):

- Registration lifecycle and leader actions
- Capacity and waitlist rules
- Manual payment tracking assumptions
- Telegram visibility constraints

Changed due to product delta:

- Entry funnel and workspace model
- Identity model across Telegram/web
- Tenant framing and terminology

---

## 8. Canonical References

- `docs/20-architecture/canonical_framework.md`
- `docs/20-architecture/decisions.md`
- `docs/50-validation/leader_app_delta_analysis.md`
- `docs/00-governance/documentation_standard.md`
