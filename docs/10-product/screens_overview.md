Document-ID: MKT-DOC-SCREENS-OVERVIEW-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Screens Overview v2

## 1. Information Architecture

The interface is leader-centric and tenant-scoped.
There is no global cross-leader tour browsing surface in active v2 scope.

---

## 2. Leader Workspace Screens

- `S-LEAD-01` Leader Dashboard  
  Registration/payment summaries, operational alerts, quick actions.

- `S-LEAD-02` Tour List (Tenant Scope)  
  Leader-owned tours only.

- `S-LEAD-03` Tour Editor  
  Create/update tour details, capacity, communication link.

- `S-LEAD-04` Registration Queue  
  Pending review queue, accept/reject/cancel operations.

- `S-LEAD-05` Capacity and Waitlist Panel  
  Accepted count, available capacity, waitlist queue actions.

- `S-LEAD-06` Payment Tracking Panel  
  Payment status, paid amount, proof-tracking context, reconciliation view.

---

## 3. Participant Screens

- `S-PART-01` Leader-Specific Tour Details  
  Tour overview, eligibility context, registration CTA.

- `S-PART-02` Registration Form  
  Structured participant input for one tour.

- `S-PART-03` Registration Status View  
  Pending/accepted/rejected/cancelled/no-show visibility.

- `S-PART-04` Payment Status View  
  NotPaid/Partial/Paid visibility with guidance.

- `S-PART-05` Communication Access View  
  Telegram link visible only when registration is accepted.

---

## 4. Identity and Account Screens

- `S-ID-01` Telegram Session Entry  
  Telegram mode identity-bound launch.

- `S-ID-02` Standalone Web Sign-In/Sign-Up  
  Web onboarding without mandatory Telegram.

- `S-ID-03` Connect Telegram  
  Post-onboarding linking action for web users.

---

## 5. Admin/Support Screens (Optional Operational Layer)

- `S-ADM-01` Tenant Oversight (platform-only)
- `S-ADM-02` Support and diagnostics (platform-only)

These are not participant-facing and are outside leader workspace UX.

---

## 6. Explicitly Removed from v2 Scope

- Global catalog listing across all leaders
- Cross-leader discovery feed
- Marketplace-style participant browsing funnel
