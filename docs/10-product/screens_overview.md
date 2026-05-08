Document-ID: MKT-DOC-SCREENS-OVERVIEW-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-05-05
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

- `S-LEAD-07` Workspace Members (`/users`)  
  Directory of users in the **active tenant**: name, email, role badge, membership status. Data from **`GET /api/v2/users`** (tenant-scoped on the server with cursor pagination + optional search/role filters). **Role changes** use **`PATCH /api/v2/users/:id`** where workspace RBAC allows; the API remains authoritative (e.g. no self-change, no owner-row edits in general PATCH, hierarchical rules, `session_version` bump on success). **Owner transfer** is a dedicated operation: **`POST /api/v2/workspaces/:tenantId/ownership-transfer`** (owner-only). **Member detail** at `/users/:id` resolves the same roster client-side—there is **no** separate `GET /users/:id` contract. **Invite / “add member” from this screen** is **not** implemented; additionally, workspace invites MUST NOT assign `owner` role.

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
  Web workspace sign-in without mandatory Telegram: **step 1 phone**, **step 2 OTP**, then `POST /api/v2/auth/web/session/otp` (tenant from subdomain). See **`docs/authentication-phone-otp.md`**.

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
