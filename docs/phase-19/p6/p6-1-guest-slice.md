# P6-1 — Guest slice (public + portal register)

```yaml
epic: P6-1
nanos: 14
priority: 2
prerequisite: P6-0 complete
milestone: P6-1-N-014 GUEST_SLICE_OK
apps: [marketing, portal, web-minimal]
otp_flow_doc: docs/phase-19/platform-portal-otp-flow.mdoc
```

## Goal

**Milestone M1:** Guest browses published tour on marketing and completes **phone + OTP** registration on portal.

## OTP flow (frozen — already in trunk)

```text
phone → OTP (dev: 1234) →
  existing user? → intake (tour form) → success
  new user?      → profile (name* · email optional) → intake → success
```

Full spec: [`platform-portal-otp-flow.mdoc`](../platform-portal-otp-flow.mdoc)

Route: `{club}.portal.{root}/catalog/{tourId}/register`

---

## Guest flow (end-to-end)

```text
1. Admin (minimal): publishStatus = active
2. marketing /tours lists tour
3. Detail CTA → portal register URL
4. Portal: phone → OTP 1234 (dev)
5. New: profile name (required) · email (optional)
6. Intake: party size + contact for tour
7. [data-public-registration-success]
```

---

## Nanos

### P6-1-N-001 — Publish active (admin minimal)

**Do:** Wizard review sets `publishStatus: active`. Runbook: `runbooks/guest-slice-operator-minimal.md`.

**Verify:** VS-01

---

### P6-1-N-002 — Catalog list shows active tour

**Do:** Marketing `/tours` lists seeded active tour.

**Verify:** VS-02

---

### P6-1-N-003 — Catalog detail page

**Do:** `/tours/[tourId]` for published tour.

**Verify:** catalog fetch spec

---

### P6-1-N-004 — Detail CTA → portal

**Do:** `resolveWebRegistrationUrl` → `{club}.localhost:3003/catalog/{id}/register`.

**Verify:** `resolve-web-registration-url.spec.ts`

---

### P6-1-N-005 — Portal register page + phone step

**Do:** Page loads · `data-public-registration-phone` · phone-preflight hints new/existing.

**Files:** `register/page.tsx` · `public-catalog-registration-flow.tsx`

**Verify:** OTP-01 · contract spec

---

### P6-1-N-006 — OTP verify (dev 1234) + standards

**Do:** `request-otp` → `verify-otp` · API dev bypass `1234`. Registration flow follows [p6-implementation-standards.mdoc](../p6-implementation-standards.mdoc) — BFF-only, ui-primitives subpath, `data-*` hooks.

**Verify:** OTP-02 · `portal-public-auth-bff.spec.ts`

---

### P6-1-N-007 — New vs existing branch

**Do:**

- New → `data-public-registration-profile` (name required, email optional)
- Existing → skip profile → `data-public-registration-intake`

**Verify:** OTP-03 · OTP-04 · contract spec

---

### P6-1-N-008 — Publish → revalidate → catalog

**Do:** Operator publish active → marketing sees tour.

**Verify:** publish/catalog integration spec

---

### P6-1-N-009 — Pending booking row

**Do:** Intake `POST /api/catalog/registrations` → pending booking.

**Verify:** `portal-catalog-registrations-bff.spec.ts`

---

### P6-1-N-010 — Club home + design-token stack

**Do:** Branded home + `/tours`. Align marketing + portal `globals.css` with `@app-tour/design-tokens/styles.css` (G-P6-UI-01/02).

**Standards:** [p6-implementation-standards.mdoc](../p6-implementation-standards.mdoc) §2

**Verify:** marketing home spec · token import present

---

### P6-1-N-011 — fa-IR default

**Do:** RTL when tenant `defaultLocale: fa`.

**Verify:** locale spec

---

### P6-1-N-012 — site_surfaces marketing gate

**Verify:** maintenance spec

---

### P6-1-N-013 — Guest slice integration spec

**Do:** `p6-guest-slice.spec.ts` — VS-01..03 + OTP band.

**Verify:** green

---

### P6-1-N-014 — GUEST_SLICE_OK

**Do:** Manual smoke doc + Playwright SMK-PTL-01 path documented.

**Verify:** milestone complete

---

## EPIC exit

Guest completes phone + OTP registration on portal host — profile rules enforced for new users.
