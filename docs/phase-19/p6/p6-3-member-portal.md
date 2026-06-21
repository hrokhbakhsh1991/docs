# P6-3 — Member portal (`/me`)

```yaml
epic: P6-3
nanos: 10
priority: 4
prerequisite: P6-1-N-014 GUEST_SLICE_OK
app: apps/portal
payment: offline_receipt
parallel_with: P6-2
```

## Goal

After guest can **register** (P6-1), add **member self-service** on portal host — not admin login.

**Scope:** `/me/registrations`, receipt upload. **Not:** full profile/settings account.

---

## Nanos

### P6-3-N-001 — Member session contract

**Do:** `docs/phase-19/platform-portal-member.mdoc` — OTP session TTL, cookie, logout.

**Verify:** mdoc present

---

### P6-3-N-002 — GET my registrations API

**Do:** `GET /denali/registrations/mine` scoped by session user + tenant.

**Verify:** `portal-member-registrations.spec.ts`

---

### P6-3-N-003 — Portal `/me` shell

**Do:** Layout + nav when session exists.

**Files:** `apps/portal/app/me/layout.tsx`

**Verify:** route exists

---

### P6-3-N-004 — `/me/registrations` list

**Do:** List tour title, status, departure, payment status.

**Verify:** BFF + UI spec

---

### P6-3-N-005 — Registration detail

**Do:** `/me/registrations/[id]` status timeline.

**Verify:** read-only spec

---

### P6-3-N-006 — Receipt upload BFF

**Do:** `POST /api/me/registrations/[id]/receipt` → finance API.

**Verify:** `portal-member-receipt-bff.spec.ts`

---

### P6-3-N-007 — POST receipt (member)

**Do:** Upload proof; 403 for other users' registrations.

**Verify:** auth spec

---

### P6-3-N-008 — Register success → `/me`

**Do:** After success, CTA to `/me/registrations`.

**Files:** `public-catalog-registration-flow.tsx`

**Verify:** VS-04 path

---

### P6-3-N-009 — Portal home session redirect

**Do:** `/` → `/me/registrations` if session; else marketing.

**Verify:** `portal-home-redirect.spec.ts`

---

### P6-3-N-010 — Portal member i18n

**Do:** `messages/fa|en/portalMember.json`

**Verify:** locale load spec

---

## EPIC exit

VS-04 · VS-05 — member sees registration and uploads receipt on portal host.
