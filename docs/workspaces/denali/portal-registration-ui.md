# Portal registration UI — component tree

```yaml
doc_id: DENALI-PORTAL-REGISTRATION-UI
version: "2026-08-16-v12"
extends: public-catalog.md
apps: [portal]
phase: P6-1
authority: platform-portal-otp-flow.mdoc · platform-portal-registration.mdoc · platform-portal-registration-intake.mdoc · platform-portal-member-profile.mdoc · portal-member-login-modal.mdoc · member-session-portal-authority.mdoc
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
  PortalProviders
    PortalLoginModalProvider          ← design PCMS-UX-MODAL (dialog/sheet)
  └── app/login/page.tsx              ← thin SSR host · data-portal-login-thin-host
        PortalLoginThinHost auto-open host="login"
        dismiss → data-portal-login-host-lede + host-trigger
        modal onAuthenticated → completeMemberLoginEgress (portalReturn)
        smoke tourId = modal bootstrap only (no inline OTP, no 404)
  └── app/catalog/[tourId]/register/page.tsx
        PortalAuthExperienceShell     ← FULL PAGE tour registration chrome
        session: PublicCatalogRegistrationFlow (intake-only)
        guest: auth gate + auto login modal (PCMS-UX-MODAL-04)
               reopen «ورود» · ?auth=login compatible
               modal onAuthenticated → close + reload register URL

@app-tour/catalog-registration-flow-ui
  GuestAuthTransport                  ← network + probeSession only
  createPortalSameOriginGuestAuthTransport  ← /api/public-auth/* + /api/me/profile
  GuestAuthHostProvider               ← { transport, onAuthenticated }
  phone / otp / profile steps         ← no fetch URLs, no location.assign, no intake hydrate
```

**Design SoT (login modal):** [portal-member-login-modal.mdoc](../../phase-19/portal-member-login-modal.mdoc) · PCMS §5.0 · DL-40 · DL-41.

### Auth experience shell (Denali — registration page)

| Hook | Purpose |
| ---- | ------- |
| `[data-portal-auth-experience]` | Root marker on catalog register route (+ thin login host backdrop) |
| `[data-portal-auth-backdrop]` | Full-viewport alpine gradient + mountain silhouette |
| `[data-portal-auth-layout]` | Centered column (28rem; 36rem on intake resume) |
| `[data-portal-auth-card]` | Glass card wrapping stepper + OTP/intake form |
| `[data-portal-auth-hero]` | Page `<h1>` + lede |
| `[data-portal-auth-session-chip]` | Member resume badge (mobile) when session skips auth steps |
| `[data-portal-auth-lede]` | Secondary hero copy |
| `[data-portal-register-guest-auth="modal-first"]` | Guest register host (PCMS-UX-MODAL-04) |
| `[data-portal-register-auth-gate]` | Card CTA while waiting for / after dismiss of login modal |
| `[data-portal-register-auth-gate-lede]` | Gate helper copy (hidden when hero lede present) |
| `[data-portal-register-sign-in-button]` | Primary reopen control inside the gate |
| `[data-portal-login-thin-host]` | Thin `/login` host marker |
| `[data-portal-login-host-lede]` | Fallback copy when modal closed; hidden while modal open |

**Login modal hooks (PCMS-UX-MODAL):**

| Hook | Purpose |
| ---- | ------- |
| `[data-portal-login-modal]` | Modal root — Denali flex-centers on `[open]` (Preflight strips UA `margin: auto`) |
| `[data-portal-login-modal-open]` | Open |
| `[data-portal-login-modal-presentation="dialog"\|"sheet"]` | Desktop centered dialog · mobile bottom sheet |
| `[data-portal-login-modal-host="login"\|"register"]` | Host page |
| `[data-portal-login-modal-body]` | OTP flow surface (shares Denali form controls) |
| `[data-portal-login-modal-panel]` | Glass panel inside the flex frame |

Component: `apps/portal/src/catalog/portal-auth-experience-shell.tsx` (register page). Skin: `packages/workspaces/denali/theme/portal/login-page.css` + `denali-form-controls.css`.

**Resume at intake:** `buildRegistrationResumeInitialState` returns `{ initialState, memberMobile }`. Register page sets `heroLede` to `intake.resumeLede`, optional `sessionBadge` from `intake.signedInBadge`, and `data-registration-resume="intake"` on `<main>`.

**Intake / success styling:** `[data-public-registration-intake]` and `[data-public-registration-success]` inherit auth-card form controls (inputs, full-width submit, alerts). Intake `<h2>` is hidden inside the card (hero `<h1>` is canonical). Registrant tabs use segmented control styling; transport blocks use muted inset panels.

Smoke URLs: `http://denali.portal.localhost:3003/login` · `/catalog/{tourId}/register` · `/catalog/{tourId}/register?auth=login`

### Login vs register invariants (PCMS-UX-01 + MODAL)

| Route / trigger | User intent | UI | Intake |
| --------------- | ----------- | -- | ------ |
| `/login?portalReturn=/me/registrations` | Header / standalone sign-in | Thin host + **login modal** | **Never** |
| `/catalog/{id}/register` (guest) | Register for tour — auth first | Register chrome + **forced login modal** + auth gate | After OTP (intake-only) |
| `/catalog/{id}/register?auth=login` | Deep link / reopen | Same as guest (compatible) | After OTP on **page** |
| Register reopen «ورود» | Dismissed modal | Modal overlay again | After OTP on **page** |
| `/catalog/{id}/register` (session) | Resume registration | intake-only page | Yes |

Hooks:

| Hook | When |
| ---- | ---- |
| `[data-portal-return]` | Login host / modal — client egress fallback |
| `[data-portal-register-sign-in-link]` | Guest register — opens login modal (same page) |
| `[data-marketing-tour-sign-in]` | Marketing PDP → `register?auth=login` |

Example tour sign-in URL: `/catalog/{tourId}/register?auth=login`

### Phase 2 polish (PCMS-UX-05 — 2026-07-14)

| Hook / behavior | Purpose |
| --------------- | ------- |
| `[data-registration-resume-pending]` | Client session probe before phone step — avoids flash of guest auth when cookie exists but SSR resume missed |
| `[data-phone-hint="existing"]` | Returning member on register — copy switches to «تأیید موبایل برای ادامه» (preflight on blur + after send) |
| `[data-marketing-tour-sign-in]` | Secondary PDP link — text CTA below primary register button |

**Hydration (PCMS-UX-HYDRATE):** Login egress mode is **never** derived from `window.location` during React render. `/login` is a thin host (`data-portal-login-thin-host`) that auto-opens the shared modal. The modal mounts `PublicCatalogRegistrationFlow` with `memberLoginEgress`, which forwards `RegistrationFlowContext.memberLoginEgress` to shared auth steps. Client-only `isMemberLoginEgressFromLocation()` remains for redirect target resolution (`portalReturn` query / `data-portal-return`) after OTP — not for SSR markup.

### Registration stepper modes

| Mode | When | Steps shown |
| ---- | ---- | ----------- |
| `registration` | Guest register page (session present / after auth) | phone → otp → profile → intake |
| `intake-only` | Member resume at intake (PCMS-REG-02) | intake only — auth steps hidden |
| *(none)* | Login modal / `memberLoginEgress` | **No stepper** — title in modal header; flow still phone → OTP → profile |

Hook: `[data-registration-stepper-mode="intake-only"]`. Wired in `public-catalog-registration-flow.tsx` when `initialRuntimeState.currentStep === "intake"` or client `data-registration-resume="intake"`. Login modal (`memberLoginEgress`) skips `CatalogRegistrationStepper` entirely.

### BFF (server)

| Route | Upstream |
|-------|----------|
| `POST /api/public-auth/phone-preflight` | `POST /public/auth/phone-preflight` |
| `POST /api/public-auth/request-otp` | `POST /public/auth/request-otp` |
| `POST /api/public-auth/verify-otp` | `POST /public/auth/verify-otp` (+ session cookie) |
| `POST /api/public-auth/register-complete` | `POST /public/auth/register/complete` |
| `POST /api/catalog/registrations` | `POST /denali/registrations` or `/urban/registrations` |

Intake dispatch: `apps/portal/app/api/catalog/registrations/route.ts` calls SDK `buildCatalogRegistrationUpstreamRequest(bootstrap.pluginId, payload)` — **no inline `pluginId ===` branches**.

#### Catalog registration auth + idempotency (2026-08-07 v8)

| Layer | Contract |
| ----- | -------- |
| Portal BFF → API | Uses `buildMemberApiHeaders(host)` (same as member BFF): `x-tenant-id` + session `x-user-id` / role / workspace **and** `Authorization: Bearer` when the member session cookie is present |
| Denali intake feature | `features.idempotencyKey: true` (aligned with Urban) |
| Client `POST /api/catalog/registrations` | Must send `Idempotency-Key` (UUID per submit). BFF forwards into SDK `options.idempotencyKey` → Denali upstream `extraHeaders` |
| Server fallback | If the client omits the key, Denali `buildUpstreamRequest` mints `portal-denali-reg-{tourId}-{uuid}` so upstream always has a key |

**Phone hydration:** after OTP/session, intake state `phone` is set from profile `mobile` / resume `memberMobile` (not left at `initialPublicRegistrationPhone()` empty). Submit includes `phone` when known so guest contact matches the signed-in member.

**Ops note:** cold `next dev` compile of `/api/catalog/registrations` can take ~20s; clients with short timeouts may abort while the server still finishes — prefer Idempotency-Key + retry, not a second bare submit.

### Intake field rules (2026-06-30)

| Field | Profile step (new user) | Tour intake | Persist to profile (`self`) |
|-------|-------------------------|-------------|------------------------------|
| Name (`fullName` / `displayName`) | Required | Hidden when profile/session already has name | Yes when `displayName` empty |
| Email | Optional | **Not shown** — never collected at tour intake | — |
| Party size | — | Fixed `1` (no UI field) | — |
| National ID | — | When `nationalIdRequired` and profile empty | Yes |
| Father's name | — | When `fatherNameRequired` and profile empty | Yes |
| Birth date | — | When `birthDateRequired` and profile empty | Yes |

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

Duplicate booking guard: Denali **self** = member user id + tour id on an active self row (not email). **Other** = guest label / nationalId; same booker may submit multiple others. See [registration-self-other-uniqueness.mdoc](./registration-self-other-uniqueness.mdoc).

**Register-page self gate (2026-08-10 · extended 2026-08-12):** SSR/client loads `GET /api/me/registrations/for-tour?tourId=` — when `self` is non-null, disable “برای خودم”, **keep guest cards available and submit-able**, and show `data-registration-self-already` with:
- copy that states self is locked **and** guests can still be added (`intake.selfAlreadyRegistered`);
- detail CTA → `/me/registrations/{id}` (`data-registration-self-already-detail`);
- my-trips CTA → `memberModuleHref` (`data-registration-self-already-trips`) when the host injects it.

**Phone intake control (2026-08-12):** Schema widget `localized-digits` (Denali/Urban `phone`) must render as `type="text"` + `inputMode="numeric"` — **not** `type="number"`. Number inputs strip a leading `0` (Iranian mobiles) and expose a spinbutton, which makes guest submit look “broken” after a self lock even though the API accepts `other`. True numeric quantities keep `field.type === "number"`. Renderer: `packages/catalog-intake-ui/src/render-intake-field.tsx`.

**Self duplicate submit safety net:** On `self` POST:
- Host may **reclassify** an owned active `other` row that shares guest identity (nationalId / phone / label) into `self` (same registration id) — treat as success. See [registration-self-other-uniqueness.mdoc](./registration-self-other-uniqueness.mdoc) § Self vs own-other identity.
- `DENALI_REGISTRATION_DUPLICATE` → lock self + self-already banner **only when** `for-tour.self` is non-null (refresh for detail id). Never invent a self-already lock without an id.
- `BOOKING_GUEST_DUPLICATE` → refresh `for-tour` first; only if `self` exists treat as self-already. Otherwise show `errors.SELF_IDENTITY_DUPLICATE` on the self card (do **not** fake “already registered yourself”). See [registration-self-other-uniqueness.mdoc](./registration-self-other-uniqueness.mdoc) § UX.

**Catalog POST session:** Denali intake `features.requiresMemberSession: true` — BFF returns `401` without Bearer (no anonymous write).

### Registrant target tabs (2026-06-30)

Intake opens with two tabs:

| Tab | Behavior |
|-----|----------|
| **For myself** (`self`) | Hydrate from `GET /api/me/profile`; hide fields already on profile; **blocked** when an active self registration already exists for the tour |
| **For someone else** (`other`) | All participant fields empty — booker fills guest details manually |

| Tab | Duplicate guard |
|-----|-----------------|
| **For myself** | One active registration per booker + tour (`userId + tourId`) |
| **For someone else** | Blocks duplicate **guest name + tour**; same booker may register multiple different guests |

OTP/session still identifies the **booker**; `registrantTarget` only controls intake defaults and whether profile patches apply after submit.

### Profile-backed intake fields

Member profile stores egress-safe fields: `displayName`, `email`, `nationalId`, `fatherName`, `birthDate`, `mobile`.

When tour canonical flags a field required (e.g. `participantRequirements.nationalIdRequired`) **and** profile lacks it → show once at intake → persist to profile **only when** `registrantTarget=self`. **`displayName`** follows the same rule: intake `fullName` patches membership when `displayName` is empty (returning members who skipped the auth profile step).

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
| `data-denali-registrant-self-toggle` | checkbox برای «برای خودم» (controlled; uncheck auto-seeds first guest card when list empty) |
| `data-registration-self-already` | بنر وقتی self فعال برای همین تور وجود دارد (چک‌باکس قفل) |
| `data-registration-self-already-detail` | لینک جزئیات همان ثبت‌نام → `/me/registrations/{id}` |
| `data-registration-self-already-trips` | لینک سفرهای من → `context.memberModuleHref` (فقط وقتی host مقدار دارد) |
| `data-denali-self-duplicate-guide` | پیام safety-net وقتی self POST duplicate و هنوز id از for-tour نیامده (+ لینک trips) |
| `data-denali-self-guest-card` | کارت intake برای self وقتی checkbox فعال است |
| `data-denali-other-guest-list` | لیست کارت‌های guest (برای دیگری) |
| `data-denali-other-guest-card` | یک کارت guest (هر guest = یک submission) |
| `data-denali-add-guest` | افزودن کارت guest (تا سقف محصولی ۱۰) |
| `data-denali-remove-guest` | حذف کارت guest (فقط وقتی بیش از یک کارت باشد) |
| `data-denali-submit-results` | خلاصه partial success/failure بعد از چند POST |
| `data-denali-submit-partial-success` | پیام موفقیت جزئی + لینک `context.memberModuleHref` وقتی حداقل یک کارت ok باشد |
| `data-denali-submit-result-error` | خطای per-card داخل `data-denali-submit-results` |
| `data-denali-guest-limit` | وضعیت وقتی سقف ۱۰ مهمان پر شده (دکمه Add مخفی می‌شود) |
| `data-intake-field="{id}"` | schema-driven intake controls (`nationalId`, `fatherName`, `birthDate`, `email`, …) — preferred E2E selector (no `partySize`; fixed to 1) |
| `data-public-registration-email` | email at intake when capability + profile lacks email |
| `data-public-registration-notes` | optional notes (Urban capability) |
| `data-portal-member-profile` | `/me/profile` form |
| `data-public-registration-personal-car-opt-in` | optional personal-car opt-in (allowPersonalCar tours) |
| `data-public-registration-transport` | car / dong follow-up fieldset |
| `data-registration-price-hint` | estimated per-person price |
| `data-public-registration-success` | completion |

### Denali multi-guest probes (manual / non-CI)

Not selected by `playwright.portal.config.ts`. Run:

```bash
cd apps/portal && pnpm exec playwright test -c playwright.denali-probes.config.ts
```

Specs: `denali-multi-guest-intake.spec.ts`, `denali-multi-guest-partial-duplicate.spec.ts` (seed tour `…000212`). Legacy marketing→portal walkthroughs (`denali-purchase-flow.probe.spec.ts`, `denali-workspace-purchase-flow.spec.ts`) are **manual-only** (`test.skip`).

### Member area (P6-3)

| Route | Purpose |
|-------|---------|
| `/me/registrations` | List member bookings — **see** [portal-member-registrations.md](./portal-member-registrations.md) |
| `/me/registrations/{id}` | Detail + receipt upload |
| `/me/profile` | Edit profile fields used at intake — **see** [portal-member-profile.md](./portal-member-profile.md) |

### Registration chrome (PS-VIS-1 · 2026-07-12)

Minimal shell on `/catalog/{tourId}/register` (DL-01 — still **no** bottom nav):

| Hook | Location |
|------|----------|
| `data-portal-registration-chrome` | Brand bar header above flow |
| `data-portal-registration-back` | Link to marketing tour detail (`backHref`) |
| `data-portal-registration-logo` | Tenant logo from public branding API |
| `data-portal-registration-workspace-label` | `displayName` fallback |

Component: `apps/portal/src/catalog/portal-registration-chrome.tsx` · skin: `starter-portal.css` (L2 structure) + `denali-portal.css` link color.

Member shell (PS-VIS-5e/5f): `[data-portal-member-header-minimal]` — brand → marketing · member chip → profile. Logout: side-rail footer (desktop) or profile session card (mobile).

Registration stepper (PS-VIS-3 · 2026-07-12):

| Hook | Location |
|------|----------|
| `data-registration-stepper` | Ordered list above active flow step |
| `data-registration-step` | Step id (`phone` · `otp` · `profile` · `intake`) |
| `data-registration-step-state` | `upcoming` · `current` · `complete` |

Component: `apps/portal/src/catalog/catalog-registration-stepper.tsx` · i18n: `catalogRegistration.stepper.*`.

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

Profile BFF: `GET/PATCH /api/me/profile` → `PATCH /identity/me` (`displayName`, `nationalId`, `fatherName`, `birthDate`). Intake self-submit also patches membership via `createDenaliRegistration` → `saveGuestProfileFields`. API contract: `identity-me.spec.ts` · `API-9.6-ME-04d` · [platform-portal-member-profile.mdoc](../../phase-19/platform-portal-member-profile.mdoc).

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
| DEN-INTAKE-01 · 02 · 03 · 04 | `portal-registration-intake-smoke.spec.ts` | tour-flag gating · participant tour · self/other · intake→profile persist |
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

**Login loop (OTP → phone again):** Portal consumes `@app-tour/catalog-registration-flow-ui` **dist** — after auth-step changes run `pnpm --filter @app-tour/catalog-registration-flow-ui build` (or restart `pnpm --filter @apps/portal dev`; `predev` builds automatically). Stale dist used `completeMemberLoginEgressIfPresent()` (redirect before session cookie) instead of `completeMemberLoginEgressAfterSession()` (probe `GET /api/me/profile` then redirect). Hard refresh after rebuild.

**New member on `/login`:** API may return `requires_registration` — OTP → **profile** step (display name), not immediate redirect. Complete profile then egress runs.

**Phone canonicalization (PCMS-UX-MOBILE):** UI and portal BFF run `normalizePublicRegistrationMobile()` before every public-auth call. Never strip the leading `+` to digits-only — that breaks lookup against seeded E.164 rows (e.g. `15550001001` ≠ `+15550001001` in identity). US 11-digit numbers without `+` are promoted to `+1…`; Iranian `09…` → `+98…`.

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
| DEN-INTAKE-04 intake → profile persist E2E | Done 2026-07-16 — `registration.service.ts` + `DEN-INTAKE-04` |
| `/me/registrations` + receipt Denali skin | Done 2026-07-02 — [portal-member-registrations.md](./portal-member-registrations.md) |

Deferred (non-blocker):

| Item | Status |
|------|--------|
| Urban portal skin (`urban-portal.css`) | Deferred |
| Transport-based invoice pricing (portal estimate only) | Deferred |
| `airplane` transport mode | Deferred |
