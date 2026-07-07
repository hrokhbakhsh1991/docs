# Portal registration UI — component tree

```yaml
doc_id: DENALI-PORTAL-REGISTRATION-UI
version: "2026-06-30-v3"
extends: public-catalog.md
apps: [portal]
phase: P6-1
authority: platform-portal-otp-flow.mdoc · platform-portal-registration.mdoc · platform-portal-registration-intake.mdoc · platform-portal-member-profile.mdoc
```

## Scope

**Platform shell (workspace-agnostic):** [platform-portal-registration-intake.mdoc](../../phase-19/platform-portal-registration-intake.mdoc) — SDK registries, BFF dispatch, transport intake helpers.

**This doc:** Denali-specific UX deltas, E2E hooks, and smoke URLs. Urban portal differences are capability-driven (`resolveCatalogIntakeCapabilities`) — no Denali imports in portal.

Workspace-agnostic **guest registration shell** in `apps/portal`. Business rules and intake persistence stay in workspace HTTP + API; portal **must not** static-import `@app-tour/workspace-*`.

**Authority:** [public-catalog.md](./public-catalog.md) § Registration · [platform-portal-otp-flow.mdoc](../../phase-19/platform-portal-otp-flow.mdoc)

---

## Route → component tree

```text
app/layout.tsx
  PortalProviders (tenant theme from branding API)
  └── app/catalog/[tourId]/register/page.tsx
        fetchCatalogTour (SDK path + bootstrap)
        PublicCatalogRegistrationFlow (client)
          phone → OTP → profile (new) → intake → success
```

### BFF (server)

| Route | Upstream |
|-------|----------|
| `POST /api/public-auth/phone-preflight` | `POST /public/auth/phone-preflight` |
| `POST /api/public-auth/request-otp` | `POST /public/auth/request-otp` |
| `POST /api/public-auth/verify-otp` | `POST /public/auth/verify-otp` (+ session cookie) |
| `POST /api/public-auth/register-complete` | `POST /public/auth/register/complete` |
| `POST /api/catalog/registrations` | `POST /denali/registrations` or `/urban/registrations` |

Intake dispatch: `apps/portal/app/api/catalog/registrations/route.ts` calls SDK `buildCatalogRegistrationUpstreamRequest(bootstrap.pluginId, payload)` — **no inline `pluginId ===` branches**.

### Intake field rules (2026-06-30)

| Field | Profile step (new user) | Tour intake |
|-------|-------------------------|-------------|
| Name | Required | Hidden when session/profile already has `displayName` |
| Email | Optional | **Not shown** — never collected at tour intake |
| Party size | — | Required |
| National ID | — | Shown only when catalog tour has `nationalIdRequired: true` **and** member profile has no saved `nationalId` |

Session defaults: `GET /api/me/profile` hydrates name (+ email for upstream only, not UI). Catalog detail exposes `nationalIdRequired` / `fatherNameRequired` / `birthDateRequired` from Denali canonical `participantRequirements.*`.

**Effective schema (2026-07-02):** `resolveEffectiveIntakeSchema` receives `tourRequirements` on `IntakeSchemaContext`. Denali includes participant fields in the effective schema **only when** the matching catalog flag is `true`, then applies session/profile hide rules for `registrantTarget=self`.

| Field | Tour gate | Session hide (`self`) |
|-------|-----------|------------------------|
| `fullName` | always | hidden when profile/session has name |
| `nationalId` | `nationalIdRequired` | hidden when profile has `nationalId` |
| `fatherName` | `fatherNameRequired` | hidden when profile has `fatherName` |
| `birthDate` | `birthDateRequired` | hidden when profile has `birthDate` |

`registrantTarget=other` shows all tour-gated fields empty (booker fills guest).

**Party size removed from intake UI (2026-07-02):** Denali registration is one participant per submission — a member registers **themself** (`self`) or **one other person** (`other`, whose identity fields the booker fills). The `partySize` UI field was removed from `DENALI_CATALOG_INTAKE_SCHEMA`; the flow now sends a fixed `partySize: 1` to the API. The API contract is **unchanged** — `denaliRegistrationPostSchema.partySize` (`z.number().int().min(1)`) and capacity/`spotsRemaining` math (`Σ approved.partySize`) still operate on the persisted value. To register additional people, the booker submits again per person (duplicate guard is guest user id + tour id, so distinct guests are allowed).

Portal wires catalog flags: `register/page.tsx` → `PublicCatalogRegistrationFlow` → `RegistrationFlowContext.tourRequirements`.

Duplicate booking guard: Denali uses **guest user id + tour id** (not email).

### Registrant target tabs (2026-06-30)

Intake opens with two tabs:

| Tab | Behavior |
|-----|----------|
| **For myself** (`self`) | Hydrate from `GET /api/me/profile`; hide fields already on profile |
| **For someone else** (`other`) | All participant fields empty — booker fills guest details manually |

| Tab | Duplicate guard |
|-----|-----------------|
| **For myself** | One active registration per booker + tour (`userId + tourId`) |
| **For someone else** | Blocks duplicate **guest name + tour**; same booker may register multiple different guests |

OTP/session still identifies the **booker**; `registrantTarget` only controls intake defaults and whether profile patches apply after submit.

### Profile-backed intake fields

Member profile stores egress-safe fields: `displayName`, `email`, `nationalId`, `fatherName`, `birthDate`, `mobile`.

When tour canonical flags a field required (e.g. `participantRequirements.nationalIdRequired`) **and** profile lacks it → show once at intake → persist to profile **only when** `registrantTarget=self`.

### Transport intake — default primary, minimal UI (2026-06-30)

Catalog detail exposes `transport.mode`, `transport.allowPersonalCar`, `transport.transportCost`, `transport.dongAmount`.

| Tour config | Portal default | UI shown |
|-------------|----------------|----------|
| Primary mode is bus / train / minibus / organizer vehicle | Guest uses **organized transport** | **No transport UI** — price = base + `transportCost` |
| Above + `allowPersonalCar=true` | Same default | **No UI** until guest opts in via «با ماشین شخصی می‌آیم» |
| Primary mode is `shared_cars` | Must declare car situation | **Always** ask: has personal car? |

Opt-in / shared-cars follow-up (only when visible):

```text
Has personal car?
  yes → occupants: 1 | 2 | 3 (includes companions who do not pay dong separately)
  no  → pays dong? yes (+ dongAmount) | no (acquaintance ride — no extra UI)
```

Persisted on booking as `registrationIntake.transport`:

| `kind` | Meaning |
|--------|---------|
| `primary` | Organized transport (default when no opt-in) |
| `personal_car` | Own vehicle; optional `personalCarOccupants` 1–3 |
| `no_car_dong` | No vehicle; pays dong share |
| `no_car_acquaintance` | No vehicle; rides with acquaintance — tour price only |

Price hint (portal display): `primary` → base + transportCost; `personal_car` / `no_car_acquaintance` → base; `no_car_dong` → base + dongAmount.

---

## Layout attributes (P6)

Set in `app/layout.tsx`:

| Attribute | Portal value |
|-----------|--------------|
| `data-app-surface` | `portal` |
| `data-workspace-plugin` | `{bootstrap.pluginId}` |
| `data-tenant-id` | resolved tenant UUID |

Workspace skin CSS scopes on:

```text
body[data-app-surface="portal"][data-workspace-plugin="denali"]
```

See `packages/workspaces/denali/theme/denali-portal.css`.

---

## `data-public-registration-*` hooks (E2E)

Stable selectors — **do not rename** without updating smoke specs.

| Hook | Step |
|------|------|
| `data-catalog-registration-page` | page shell (`register/page.tsx`) |
| `data-public-registration-phone` | phone entry |
| `data-registration-ready` | client hydration gate (Playwright wait) |
| `data-public-registration-otp` | OTP step shell — fill `#otp` (shared `CatalogRegistrationOtpStep`); segment boxes `[data-otp-cell]` are **operator login only**, not catalog registration |
| `data-public-registration-profile` | new-user profile |
| `data-public-registration-intake` | tour intake form (`RenderIntakeForm` / workspace step) |
| `data-registration-target-tabs` | self / other registrant tabs |
| `data-intake-field="{id}"` | schema-driven intake controls (`nationalId`, `fatherName`, `birthDate`, `email`, …) — preferred E2E selector (no `partySize`; fixed to 1) |
| `data-public-registration-email` | email at intake when capability + profile lacks email |
| `data-public-registration-notes` | optional notes (Urban capability) |
| `data-portal-member-profile` | `/me/profile` form |
| `data-public-registration-personal-car-opt-in` | optional personal-car opt-in (allowPersonalCar tours) |
| `data-public-registration-transport` | car / dong follow-up fieldset |
| `data-registration-price-hint` | estimated per-person price |
| `data-public-registration-success` | completion |

### Member area (P6-3)

| Route | Purpose |
|-------|---------|
| `/me/registrations` | List member bookings — **see** [portal-member-registrations.md](./portal-member-registrations.md) |
| `/me/registrations/{id}` | Detail + receipt upload |
| `/me/profile` | Edit profile fields used at intake — **see** [portal-member-profile.md](./portal-member-profile.md) |

**Architecture freeze:** [platform-portal-member-profile.mdoc](../../phase-19/platform-portal-member-profile.mdoc). Profile reads/writes use `GET/PATCH /api/me/profile` only (M4).

| Hook | Location |
|------|----------|
| `data-portal-member-registrations` | `/me/registrations` list (`main`) |
| `data-portal-member-registration-row` | List item card |
| `data-portal-member-registration-detail` | `/me/registrations/{id}` detail (`main`) |
| `data-portal-member-receipt-upload` | Receipt form on detail |
| `data-portal-member-receipt-submit` | Receipt upload button |
| `data-portal-member-receipt-success` | Receipt upload success |
| `data-portal-member-receipt-error` | Receipt upload failure |
| `data-portal-member-profile` | `/me/profile` form |
| SMK-PTL-02 | row visible after registration |
| SMK-PTL-04 | receipt upload on detail |
| SMK-PTL-05 | `/` redirects authenticated member to `/me/registrations` |
| SMK-PTL-06 | Logout clears session · middleware blocks `/me/*` + `/api/me/*` after `data-public-auth-logout` |

Profile BFF: `GET/PATCH /api/me/profile` → `PATCH /identity/me` (`nationalId`, `fatherName`, `birthDate`). API contract: `identity-me.spec.ts` · `API-9.6-ME-04d` · [platform-portal-member-profile.mdoc](../../phase-19/platform-portal-member-profile.mdoc).

### Operator visibility (2026-06-30)

Bookings command center inspection panel and tour transport roster read `registrationIntake` from `GET /bookings`:

| Field | Ops display |
|-------|-------------|
| `registrantTarget` | self / other |
| `transport.kind` | primary · personal_car · no_car_dong · no_car_acquaintance |
| `transport.personalCarOccupants` | 1–3 when `personal_car` |
| `nationalId` | When collected at intake (egress-safe; ops-only) |

---

## Smoke coverage

| ID | Spec | Host |
|----|------|------|
| SMK-PTL-01 | `portal-registration-smoke.spec.ts` | `operator.portal.localhost:3003` |
| DEN-INTAKE-01 · 02 · 03 | `portal-registration-intake-smoke.spec.ts` | tour-flag gating · participant tour · self/other |
| DEN-TRANS-01 · 02 · 03 | `portal-registration-transport-smoke.spec.ts` | bus default (no UI) · personal-car opt-in · shared_cars dong |
| SMK-PTL-02 · 04 · 05 · 06 | `portal-member-smoke.spec.ts` | member list · receipt · home redirect · logout |
| DEN-PROF-01 · 02 · 03 | `portal-member-profile-smoke.spec.ts` | profile fields · PATCH persist · intake hide |
| SMK-MKT-03 | `marketing-catalog-smoke.spec.ts` | marketing CTA → portal |
| SMK-P8-02 | `urban-e2e-integrity.spec.ts` | `urban.portal.localhost:3003` |

```bash
pnpm --filter @apps/portal run test:smoke              # 14 tests · SMK-PTL-* · DEN-PROF-* · DEN-INTAKE-* · DEN-TRANS-*
pnpm --filter @apps/marketing run test:smoke           # SMK-MKT-01..04, SMK-MKT-16
pnpm --filter @apps/marketing run test:smoke:urban     # SMK-MKT-05
pnpm --filter @apps/web run test:e2e:urban --grep SMK-P8  # P8-01..04
```

E2E helper `completeCatalogRegistrationIntake` (`fixtures/catalog-registration-otp.ts`) fills schema-driven intake via `[data-intake-field="{id}"]` (Denali: `nationalId`, `fatherName`, `birthDate`) and completes transport follow-up when `[data-public-registration-transport]` is visible (no personal car + dong yes). `partySize` is no longer an intake field (fixed to 1 in the flow). Asserts `POST /api/catalog/registrations` before expecting success.

### Transport intake E2E (DEN-TRANS)

`portal-registration-transport-smoke.spec.ts` proves the card-driven transport surface end to end against smoke tours `…213` (bus + `allowPersonalCar`) and `…214` (`shared_cars`):

| ID | Tour | Guest action | Persisted `transport.kind` |
|----|------|--------------|-----------------------------|
| DEN-TRANS-01 | `…213` bus | none — organized default | `primary` (or omitted) · no `[data-public-registration-transport]` shown |
| DEN-TRANS-02 | `…213` bus + opt-in | check `[data-public-registration-personal-car-opt-in]` → occupants | `personal_car` |
| DEN-TRANS-03 | `…214` shared_cars | mandatory `[data-public-registration-transport]` → no car → pays dong | `no_car_dong` · price hint = base + `dongAmount` |

Assertions read the outgoing `POST /api/catalog/registrations` body to confirm the SDK payload `transport.kind`; there is no `pluginId === "denali"` branch in the portal.

---

## Styling rules

| Rule | Detail |
|------|--------|
| No page CSS in `app/globals.css` | guest-shell + tailwind only |
| Workspace skin | `guestThemeStylesheets.portal` in manifest → generated bootstrap |
| Design-system SoT | [`design-system/denali-club/MASTER.md`](../../../design-system/denali-club/MASTER.md) → `denali-portal.css` tokens |
| Headings | Calistoga via `next/font/google` in portal layout (`--font-heading-en`) |
| Primitives | `@app-tour/ui-primitives/input` on registration fields |

---

## Local dev

Guest BFF API base: `@app-tour/guest-surface-host` `resolveTourOpsApiBaseUrl` (dev default `http://127.0.0.1:3001` when unset).

1. API: `cd apps/api && pnpm run dev`
2. Portal: optional `apps/portal/.env.local` from tracked `.env.local.example`
3. `pnpm --filter @apps/portal run dev`
4. Register URL examples:

| Host | Tenant |
|------|--------|
| `http://denali.portal.localhost:3003/catalog/{tourId}/register` | Denali `…000003` |
| `http://operator.portal.localhost:3003/catalog/{tourId}/register` | Operator smoke `…000014` |

Marketing back-link: `resolveMarketingTourDetailUrl` → `{club}.localhost:3002/tours/{tourId}`.

Dev OTP: `1234` when API runs with `AUTH_ALLOW_DEV_STATIC_OTP=true`.

**Dev origin:** Playwright smokes hit `{club}.portal.localhost:3003` while Next dev serves `localhost:3003`. `apps/portal/next.config.ts` sets `allowedDevOrigins: ["*.portal.localhost"]` (parity with `apps/web` `*.admin.localhost`).

---

## Verify

```bash
pnpm --filter @apps/portal run test -- test/guest-theme-stack.spec.ts
pnpm run guard:public-catalog-m17   # dynamic check count (also in p6:gate + p4:gate)
pnpm --filter @apps/api exec node --import tsx --test test/platform-club-product-exit.spec.ts  # EX-02c
pnpm --filter @apps/portal run test:smoke        # 11 portal smokes (SMK-PTL + DEN-PROF + DEN-INTAKE)
pnpm --filter @apps/marketing run test:smoke     # SMK-MKT-03 chain
pnpm run p6:gate                                 # daily product gate
pnpm run p4:gate                                 # Phase 17 club surfaces · same M17/SDK/G-ENV chain
```

Dev templates: tracked `apps/portal/.env.local.example` → `.env.local` (root `.gitignore` `!.env.local.example`).

---

## Roadmap (portal product)

Enterprise hardening **complete** for Denali registration shell (2026-06-30):

| Item | Status |
|------|--------|
| P6-1 Registration OTP + intake | Done |
| P6-3 `/me/registrations` + receipt (SMK-PTL-02/04/05) | Done |
| `denali-portal.css` ↔ denali-club MASTER + Calistoga | Done |
| `guest-theme-stack` G-P6-UI-06/07/08 + M17 guard (dynamic) | Done |
| SMK-PTL-01 + SMK-MKT-03 chain | Verified 2026-06-30 · see [marketing-catalog-ui.md](./marketing-catalog-ui.md) |
| SDK intake dispatch (BFF + portal capabilities) | Done — [platform-portal-registration-intake.mdoc](../../phase-19/platform-portal-registration-intake.mdoc) |
| Wizard `fatherNameRequired` / `birthDateRequired` codegen | Done — `pnpm --filter @app-tour/workspace-denali run denali:codegen` |
| `/me/profile` Denali skin + DEN-PROF E2E | Done 2026-07-02 — [portal-member-profile.md](./portal-member-profile.md) |
| Tour-flag intake gating + DEN-INTAKE E2E | Done 2026-07-02 — `denali-catalog-intake.ts` · tour `…000212` |
| `/me/registrations` + receipt Denali skin | Done 2026-07-02 — [portal-member-registrations.md](./portal-member-registrations.md) |

Deferred (non-blocker):

| Item | Status |
|------|--------|
| Urban portal skin (`urban-portal.css`) | Deferred |
| Transport-based invoice pricing (portal estimate only) | Deferred |
| `airplane` transport mode | Deferred |
