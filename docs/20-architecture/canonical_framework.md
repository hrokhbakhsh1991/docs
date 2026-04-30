Document-ID: MKT-DOC-CANONICAL-FRAMEWORK-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: N/A

# Canonical Framework v2 (English-Only)

## 1. Purpose

This file locks terminology, status naming, and cross-document assumptions for all active v2 docs.
All v2 documents must follow this file as the canonical reference.

---

## 2. Product Model Assumptions

- The product is **leader-centric**.
- The runtime is **shared multi-tenant** with strict tenant isolation.
- Access is **dual-mode**:
  - Telegram Mini App mode
  - Standalone web mode
- Identity policy is mode-aware:
  - Telegram mode requires Telegram identity.
  - Web mode allows entry without Telegram, with post-onboarding account linking.

---

## 3. Canonical Terms

- `tenant`: isolated leader workspace boundary
- `leader workspace`: operational context for one leader
- `participant`: user joining a tour in a tenant context
- `tour`: managed activity owned by leader roles
- `registration`: participant request/approval lifecycle for one tour
- `waitlist item`: queue record used when capacity is full
- `dual-mode`: operation across Telegram Mini App and standalone web
- `account linking`: mapping web identity and Telegram identity to one user account

---

## 4. Canonical Status Models

## 4.1 Registration Status

Canonical enum:

- `Pending`
- `Accepted`
- `Rejected`
- `Cancelled`
- `NoShow`

Rules:
- Only `Accepted` consumes tour capacity.
- `Pending` and `Accepted` are considered active statuses for duplicate-prevention rules.

## 4.2 Payment Status

Canonical enum:

- `NotPaid`
- `Partial`
- `Paid`

Rules:
- MVP payment status is an operational tracking field.
- MVP does not imply real transaction execution.

## 4.3 Waitlist Status

Canonical enum (MVP-safe set):

- `Waiting`
- `Converted`
- `Cancelled`

Optional future extension:
- `Notified`

---

## 5. Canonical Role Model

- `Leader`: manages tours, registrations, and payment tracking within tenant scope.
- `Participant`: registers and participates in tours.
- `Admin`: platform-level operational role (outside participant/leader surfaces).
- `Driver`: participant attribute in tour context, not a standalone identity class.

---

## 6. Data Boundary Rules

- Every business record must resolve a tenant scope.
- No cross-tenant read/write is allowed in leader or participant surfaces.
- Tenant context must be enforced in API, business logic, and persistence layers.

---

## 7. Language and Formatting Rules

- Active v2 documents are English-only.
- Headings and requirement IDs must be stable and explicit.
- Any section inherited from archive must either:
  - remain behaviorally equivalent, or
  - include an explicit delta reason in wording.

---

## 8. Consistency Checklist

Before publishing any v2 document:

- Terminology matches this file.
- Status names match canonical enums.
- No section assumes global cross-leader marketplace browsing.
- In-scope and out-of-scope boundaries are explicit.
