Document-ID: MKT-DOC-PERSONAS-USECASES-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Personas and Use Cases v2

## 1. Personas

## 1.1 Primary Persona: Tour Leader

Profile:
- organizes and manages tours regularly
- coordinates participants through messaging channels
- validates payment proofs manually

Needs:
- one operational workspace
- fast status control
- payment visibility and reconciliation support

## 1.2 Secondary Persona: Participant

Profile:
- joins tours through leader-owned links/channels
- needs clear registration and payment expectations

Needs:
- simple registration flow
- transparent approval/payment state
- predictable communication access

## 1.3 Platform Admin (Operational)

Profile:
- maintains platform-level governance and support

Needs:
- secure tenant boundaries
- stable operational telemetry
- low-maintenance architecture for growth

---

## 2. Core Use Cases (Leader-Centric)

## 2.1 Leader Use Cases

- `L-01` Create and publish a tour in tenant workspace.
- `L-02` Review pending registrations and approve/reject them.
- `L-03` Track and manage accepted capacity.
- `L-04` Record payment status and paid amount manually.
- `L-05` Reconcile payment state across participants.
- `L-06` Manage Telegram tour link visibility through accepted-state governance.

## 2.2 Participant Use Cases

- `P-01` Open leader-specific tour page and submit registration.
- `P-02` Track registration status changes.
- `P-03` Submit payment proof outside system and follow in-system payment status.
- `P-04` Access Telegram tour link only after acceptance.

## 2.3 Identity Use Cases

- `I-01` Enter from Telegram Mini App and continue with Telegram identity.
- `I-02` Enter from standalone web and complete onboarding without Telegram.
- `I-03` Link Telegram account later from web profile flow.

---

## 3. Priority Set for MVP

Must-have:
- `L-01` to `L-05`
- `P-01` to `P-03`
- `I-01` and `I-02`

Should-have:
- `L-06`
- `P-04`
- `I-03`

Later:
- automated reminders
- integrated online payments
- advanced notification automation

---

## 4. Out-of-Scope Use Cases (Current)

- browsing tours across all leaders in one global marketplace
- cross-leader recommendation or ranking flows
- platform-level consumer discovery funnel optimization
