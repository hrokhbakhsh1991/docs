# P6-1 — Guest slice (public + portal register)

```yaml
epic: P6-1
nanos: 15
priority: 2
prerequisite: P6-0 complete
milestone: P6-1-N-014 GUEST_SLICE_OK
requires_theming: P6-1-N-015
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

**Do:** `resolveWebRegistrationUrl` → `buildDevPortalPublicBaseUrl` → `{club}.portal.localhost:3003/catalog/{id}/register` (legacy `{club}.localhost:3003` still accepted).

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

**Do:** Branded home + `/tours`. Guest `globals.css` = `guest-shell.css` + tailwind only; page rules live in workspace skins (`denali-portal.css`, `denali-marketing.css`).

**Standards:** [p6-enterprise-theming-architecture.mdoc](../p6-enterprise-theming-architecture.mdoc) · [p6-implementation-standards.mdoc](../p6-implementation-standards.mdoc) §2

**Verify:** `guest-theme-stack.spec.ts` (portal + marketing)

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

**Prerequisite:** P6-1-N-015 (theming file tree) ✅

**Do:** UI spec docs + Playwright SMK-PTL-01 / SMK-MKT-03 path documented.

**Authority:** [marketing-catalog-ui.md](../../workspaces/denali/marketing-catalog-ui.md) · [portal-registration-ui.md](../../workspaces/denali/portal-registration-ui.md)

**Verify:** milestone complete · `guard:public-catalog-m17` · `guest-theme-stack.spec.ts` G-P6-UI-06/07/08 · portal/marketing `test:smoke` (explicit YES)

---

### P6-1-N-015 — Enterprise theming file tree (mandatory)

**Do:** Lock canonical file tree — tokens · shell-bridge · workspace skins · generated ingress · fonts · thin globals.

**Authority:** [p6-theming-file-tree.md](p6-theming-file-tree.md) · [p6-enterprise-theming-architecture.mdoc](../p6-enterprise-theming-architecture.mdoc)

**Files:**

| Area | Path |
| ---- | ---- |
| Bridge | `packages/design-tokens/src/shell-bridge.css` |
| Guest entry | `packages/design-tokens/src/guest-shell.css` |
| Denali skins | `packages/workspaces/denali/theme/denali-{portal,marketing}.css` |
| Manifest | `guestThemeStylesheets` in `workspace.manifest.json` |
| Portal/marketing | `workspace-guest-theme-stylesheets.generated.ts` |
| Fonts | `apps/{portal,marketing}/src/i18n/app-fonts.ts` |
| Admin dedup | `apps/web/app/globals.css` imports `shell-bridge.css` |

**Verify:** `p6-theming-file-tree.spec.ts` · `guest-theme-stack.spec.ts` · `pnpm run generate:workspace-registry`

---

## EPIC exit

Guest completes phone + OTP registration on portal host — profile rules enforced for new users.
