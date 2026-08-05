# Phase 9 — Smoke scenario map (SMK-P9)

```yaml
smoke_version: "2026-06-08-v5"
subphase: "9.8"
req_ids: [REQ-P9-080, REQ-P9-083]
invariants: [INV-P9-007, INV-P8-007]
authority: subphases/9.8-operator-dod-gate.md · TRACEABILITY-MAP.md
behavioral_status: VERIFIED_SMK_P9_01_09_E2E
fixture_tenant: operator.localhost · fallback 127.0.0.1 + TOUR_OPS_DEV_TENANT_ID
fixture_module: apps/api/test/fixtures/operator-smoke-e2e-tenant.ts
playwright_config: apps/web/playwright.operator.config.ts
spec_file: apps/web/test/operator-smoke.spec.ts
npm_script: test:e2e:operator
```

> **Agents:** Targets are **implementation contracts**. Each scenario asserts HTTP status, DOM landmark, or JSON `code` — no empty `test.skip` bodies at merge.

---

## Summary matrix

| ID            | Title                               | Playwright target                              | API chain target                       | Pass signal                           |
| ------------- | ----------------------------------- | ---------------------------------------------- | -------------------------------------- | ------------------------------------- |
| **SMK-P9-01** | Operator OTP login → dashboard      | `operator-smoke.spec.ts` · `test('SMK-P9-01')` | POST otp + verify + GET session        | Dashboard heading · nav Tours/Users   |
| **SMK-P9-LOGIN-01** | Unauthorized phone gated before OTP | same · `test('SMK-P9-LOGIN-01')` | POST request-otp 403 | `operator-login-phone-error` visible · no OTP segment |
| **SMK-P9-LOGIN-02** | Authorized phone → OTP segment      | same · `test('SMK-P9-LOGIN-02')` | POST request-otp 200 | `[data-otp-segment-input]` visible    |
| **SMK-P9-LOGIN-03** | Wrong OTP → inline field error      | same · `test('SMK-P9-LOGIN-03')` | POST verify-otp 401  | `operator-login-otp-error` visible    |
| **SMK-P9-LOGIN-04** | Full UI login (phone → 4-box → 1234) | same · `test('SMK-P9-LOGIN-04')` | BFF otp + verify   | `operator-dashboard-grid` visible     |
| **SMK-P9-LOGIN-05** | Change phone resets OTP step        | same · `test('SMK-P9-LOGIN-05')` | UI only            | `#phone` visible · no OTP segment     |
| **SMK-P9-LOGIN-06** | Empty phone → field error           | same · `test('SMK-P9-LOGIN-06')` | BFF 400            | `operator-login-phone-error` · no OTP segment |
| **SMK-P9-LOGIN-07** | Resend OTP after 45s cooldown       | same · `test('SMK-P9-LOGIN-07')` | POST request-otp 200 | Resend button enabled · second challenge |
| **SMK-P9-02** | Wizard create → tour in list        | same · `test('SMK-P9-02')`                     | POST /tours + GET /tours?view=operator | Tour title in `(app)/tours` card grid |
| **SMK-P9-03** | Invite → accept → directory         | same · `test('SMK-P9-03')`                     | invite + accept APIs                   | New member row                        |
| **SMK-P9-04** | Pending booking → approve           | same · `test('SMK-P9-04')`                     | POST approve                           | Status approved badge                 |
| **SMK-P9-05** | Template seed → wizard prefill      | same · `test('SMK-P9-05')`                     | PUT template + GET wizard              | Field = `SMK-P9-SEED`                 |
| **SMK-P9-06** | Leader review alias (admin session) | same · `test('SMK-P9-06')`                     | GET `/leader/review` (legacy URL)      | Inspection table renders              |
| **SMK-P9-07** | Manual booking create               | same · `test('SMK-P9-07')`                     | POST booking create                    | Row in queue pending                  |
| **SMK-P9-08** | Settings module round-trip          | same · `test('SMK-P9-08')`                     | PUT equipment item                     | Item visible on reload                |
| **SMK-P9-09** | Finance command center overview     | same · `test('SMK-P9-09')`                     | GET `/finance/reports/summary` BFF     | KPI strip visible on `/finance`       |
| **SMK-P9-10** | Profile settings save display name  | same · `test('SMK-P9-10')`                     | PATCH `/api/identity/me` BFF           | Reload retains `displayName`          |
| **SMK-P9-11** | Reconciliation triage page          | same · `test('SMK-P9-11')`                     | GET finance summary + schedules BFF    | Triage page · empty or findings list  |
| **SMK-P9-12** | Finance prepayments tab (R2)        | same · `test('SMK-P9-12')`                     | GET `/api/finance/prepayments` BFF     | Prepayments panel · list or empty     |
| **SMK-P9-USERS-03** | Ownership transfer panel (R5) | same · `test('SMK-P9-USERS-03')` | GET `/api/users` roster | Admin candidate in select · submit enabled |
| **SMK-P9-USERS-02** | Bulk suspend member (R8) | same · `test('SMK-P9-USERS-02')` | PATCH `/api/users/bulk/suspend` | Suspended badge on member row |
| **SMK-P9-USERS-01** | Row suspend admin (R1) | same · `test('SMK-P9-USERS-01')` | PATCH `/users/{id}/suspend` | Suspended badge on admin row |
| **SMK-P9-USERS-04** | Admin OTP blocked (DEC-P9-018) | same · `test('SMK-P9-USERS-04')` | BFF `login-web-session` 403 `AUTH_OWNER_PANEL_ONLY` | No session cookie for admin actor |

**Supporting artifacts (required):**

| Artifact          | Path                                                        | Role                       |
| ----------------- | ----------------------------------------------------------- | -------------------------- |
| Fixture SoT       | `apps/api/test/fixtures/operator-smoke-e2e-tenant.ts`       | Stable UUIDs for SMK-P9-\* |
| Playwright config | `apps/web/playwright.operator.config.ts`                    | `baseURL` → denali host    |
| npm script        | `apps/web/package.json` → `test:e2e:operator`               | Invokes operator config    |
| Login UI          | `apps/web/app/auth/login/page.tsx`                          | OTP flow · `OtpSegmentInput` (4-box) · field errors `operator-login-phone-error` / `operator-login-otp-error` · `operator-login-hydrated` before Playwright interacts |
| Admin shell       | `apps/web/app/(app)/layout.tsx`                             | Session guard              |
| Identity API      | `apps/api/src/identity/auth.routes.ts`                      | OTP + session              |
| Session helper    | `apps/web/test/fixtures/operator-owner-session.ts`            | BFF API login (`request-otp` → `login-web-session`) — sets `session` cookie; `skipDashboard: true` for bookings smoke (SMK-P9-04/07) |

---

## Host / env (all scenarios)

`smoke-operator-e2e-servers.mjs` bootstraps a **self-contained** stack (no Postgres):

| Process | `NODE_ENV` | Required env |
| ------- | ---------- | ------------ |
| API     | `test`     | `STORAGE_DRIVER=memory` · `AUTH_ALLOW_DEV_STATIC_OTP=true` · `OPERATOR_SMOKE_E2E_SEED=1` · `P5_VALIDATION_WORKERS_ENABLED=false` · tour seed `North Ridge Trek` at starter `basics.title` (SMK-P9-07) · **`DATABASE_URL` / `DATABASE_URL_ADMIN` stripped** from spawned API env so shell Postgres cannot bind tenant `…0014` to Denali while storage is in-memory · Web uses Denali wizard (tenant `…0014`) but `createTourAction` maps flat `title` → starter canonical for memory API (SMK-P9-02) · `AUTH_JWT_*` from env when both keys set, else script generates ephemeral RS256 pair (see IDENTITY-PORT-SCOPE § Dev JWT bootstrap) |
| Web     | `development` | `ALLOW_DEV_WEB_SESSION=true` · `TOUR_OPS_API_URL=http://127.0.0.1:3001` |

**Boot order:** API `/health` → Next `next dev --hostname 127.0.0.1` (spawn after API; background warm: `/` · `/auth/login` · `/bookings/new` for SMK-P9-07). Playwright `webServer.url` probes **API health only** (`3001`) so Playwright readiness does not hammer Next during first compile. `operator-smoke-global-setup.ts` repeats the same warm paths when Playwright owns `webServer`.

**P6 host-bind (soft):** After ready, `smoke-operator-e2e-servers.mjs` probes `GET /public/tenant-context` and may run `scripts/smoke-p6-host-bind.mjs`. Failure is **warn-only** — SMK-P6-HOST-01 must not tear down the memory operator stack (wizard/OTP via BFF still valid). Empty `DATABASE_URL` is **deleted** from the spawned API env (not set to `""`) so shell Postgres cannot leak into memory mode.

**Reuse guard (SMK-P9-07):** When ports 3000/3001 are already listening, `smoke-operator-e2e-servers.mjs` probes `GET /tours?view=operator` for seed title `North Ridge Trek`. If absent (stale API without `OPERATOR_SMOKE_E2E_SEED=1`), it **kills port 3001** and spawns a fresh API with the smoke env instead of reusing.

**Workspace type (memory smoke):** Phase **11.0** (DEC-P11-001) — API and web both resolve tenant `…000014` as **`denali`** (`resolve-workspace-type.ts` uses `tenant-registry`; no `starter` override). `GET /settings/modules` exposes full denali reference modules; `bootstrapOperatorSmokeCatalogIfNeeded` seeds equipment/locations/themes when `OPERATOR_SMOKE_E2E_SEED=1`. Tour create still uses the thin `createTourAction` starter-shape bridge until Phase **11.7** full canonical projection (SMK-P9-02 may need title-path alignment with denali validation).

```bash
export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:3000}"
export OTP_FIXTURE_CODE="${OTP_FIXTURE_CODE:-1234}"
export OPERATOR_SMOKE_OWNER_MOBILE="+15550001001"
export OPERATOR_INVITEE_MOBILE="+15550008803"
# Optional Redis for OTP throttle proof:
# export REDIS_URL=redis://localhost:6379
```

**Verification commands:**

```bash
# Playwright (starts memory API + web via smoke-operator-e2e-servers.mjs):
pnpm --filter @apps/web run test:e2e:operator

# Unit landmarks only (no browser):
pnpm --filter @apps/web exec node --import tsx --test test/users-directory.spec.ts test/invite-accept.spec.ts
```

---

## Shared fixture contract (`operator-smoke-e2e-tenant.ts`)

| Key                 | UUID / value                           | Purpose                  |
| ------------------- | -------------------------------------- | ------------------------ |
| `tenantId`          | `00000000-0000-4000-8000-000000000014` | Denali workspace tenant  |
| `ownerUserId`       | `00000000-0000-4000-8000-000000000101` | `role: owner`            |
| `adminUserId`       | `00000000-0000-4000-8000-000000000102` | `role: admin` · display **Smoke Admin** when `OPERATOR_SMOKE_E2E_SEED=1` |
| `memberUserId`      | `00000000-0000-4000-8000-000000000103` | `role: member` · display **Smoke Member** when `OPERATOR_SMOKE_E2E_SEED=1` |
| `adminMobile`       | `+15550001002`                         | SMK-P9-USERS-01/03/04    |
| `memberMobile`      | `+15550001003`                         | SMK-P9-USERS-02          |
| `seedTourId`        | `00000000-0000-4000-8000-000000000210` | SMK-P9-02 list target    |
| `pendingBookingId`  | `00000000-0000-4000-8000-000000000310` | SMK-P9-04 approve target |
| `templateSeedValue` | `SMK-P9-SEED`                          | SMK-P9-05 wizard prefill |
| `inviteMobile`      | `+15550008803`                         | SMK-P9-03 invitee (no membership until accept) |
| `inviteeUserId`     | `00000000-0000-4000-8000-000000000195` | SMK-P9-03 accept target |

Import: `import { OPERATOR_SMOKE } from './fixtures/operator-smoke-e2e-tenant.ts'`

---

## SMK-P9-01 — Login → dashboard

**Preconditions:** Migration 005 applied · `OPERATOR_SMOKE` tenant seeded · identity routes enabled.

**Steps:**

1. Navigate `{PLAYWRIGHT_BASE_URL}/auth/login`
2. Submit `OPERATOR_SMOKE.ownerMobile` → OTP (`OTP_FIXTURE_CODE` in test)
3. Verify → redirect `(app)/dashboard`
4. Assert `[data-operator-nav]` landmarks: Tours, Users, Bookings, Settings

**Forbidden:** Dev bearer without cookie for SMK path — must exercise real session (AH-9.8-01).

**Observability tokens:** `operator.session.missing` · `operator.shell.render`

---

## SMK-P9-02 — Wizard → list

**Preconditions:** SMK-P9-01 storageState · denali workspace.

**Authority:** [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md) · DEC-P9-014

**Wizard fields (Denali):** Minimal create uses platform render plan field **`title`** (not starter `basics.title`). Playwright: `getByRole('textbox', { name: 'title' })`.

**Steps:**

0. `(app)/settings/tour-wizard-template` — check **Publish wizard** · Save (W-track — `/tours/new` empty until published)
1. Open `/tours/new` — complete minimal wizard (Phase 6 engine; **title field only** when default published steps)
2. Submit create
3. Open `(app)/tours`
4. Assert created tour **title** visible in card grid (`data-testid=tour-list` or card heading)
5. Optional: filter `?search=` matches new title

**API proof (HTTP smoke):** `GET /tours?view=operator` returns projection row with matching `title`.

**Forbidden:** `(app)/tours/new` route (DEC-P9-007).

---

## SMK-P9-03 — Invite flow

**Preconditions:** Owner session · `inviteMobile` unused.

**Steps:**

1. `(app)/users` → invite flow
2. Open `/auth/invite/[token]`
3. Accept → login as invited user
4. Owner directory shows new member

---

## SMK-P9-04 — Booking approve

**Preconditions:** `pendingBookingId` seeded in `pending` status.

**Steps:**

1. `(app)/bookings` → open pending row
2. Approve action
3. Assert status `approved` · outbox row (API spec)

---

## SMK-P9-05 — Template seed

**Preconditions:** Admin session.

**Steps:**

1. `(app)/settings/tour-wizard-template` — set seed `SMK-P9-SEED` · check **Publish wizard**
2. Save (cache invalidation per DEC-P9-005)
3. Open `/tours/new`
4. Assert seed field pre-filled

---

## SMK-P9-06 — Leader review alias (admin session)

**Preconditions:** Admin session seeded in fixture (legacy DB `leader` hydrates to `admin` · DEC-P9-015).

**Steps:**

1. Navigate `(app)/leader/review`
2. Assert inspection table or summary cards render
3. Member role → **403** or locked panel

---

## SMK-P9-07 — Manual booking create

**Preconditions:** Admin session · seed tour with open capacity.

**Steps:**

1. Open `(app)/bookings/new`
2. Submit minimal guest + tour selection
3. Queue shows new `pending` row

---

## SMK-P9-08 — Settings module (equipment)

**Preconditions:** Admin session.

**Steps:**

1. Open `(app)/settings/equipment`
2. Create item · save
3. Reload — item persists

---

## SMK-P9-09 — Finance command center overview

**Preconditions:** Denali owner session (SMK-P9-01).

**Steps:**

1. Navigate to `/finance`
2. Overview tab renders KPI strip (`finance-kpi-strip`)
3. BFF proxies `GET /api/finance/reports/summary` (may return zeros on memory driver)

---

## SMK-P9-10 — Profile settings save display name

**Preconditions:** Owner session (SMK-P9-01).

**Steps:**

1. Navigate to `/settings/me`
2. Fill `displayName` with unique `SMK-P9-10-*` label · save
3. Reload — input retains saved value · toast `Profile saved.`

**API chain:** BFF `PATCH /api/identity/me` → `PATCH /identity/me` (`membership_metadata.displayName`).

---

## SMK-P9-12 — Finance prepayments tab (9.7 R2)

**Preconditions:** Denali owner session (SMK-P9-01).

**Steps:**

1. Navigate to `/finance?tab=prepayments`
2. Command center shell visible
3. Prepayments panel (`finance-prepayments-panel`) renders list or empty state

**Note:** Memory driver returns empty list — pass signal is **tab + panel shell**, not ledger credit (CP-9.7-10 requires Postgres integration spec).

---

## SMK-P9-11 — Reconciliation triage page

**Preconditions:** Denali owner session (SMK-P9-01).

**Steps:**

1. Navigate to `/settings/reconciliation-triage`
2. Page shell (`operator-reconciliation-triage-page`) visible
3. Either empty state (`operator-reconciliation-empty-state`) or findings list (`operator-reconciliation-findings-list`)

**Note:** Memory driver may show empty findings — pass signal is **page load + board shell**, not ledger adjust (R4).

---

## Urban regression hook (9.8 gate)

After SMK-P9 suite:

```bash
pnpm --filter @apps/api exec node --import tsx --test test/urban-settings-patch.spec.ts
```

Admin PATCH `/urban/settings` must remain **403** URBAN_OWNER_REQUIRED.

---

## Anti-hollow (9.8 E2E)

| ID        | Failure                                                 |
| --------- | ------------------------------------------------------- |
| AH-9.8-01 | SMK-P9-01 uses dev bearer only → **FAIL**               |
| AH-9.8-02 | Dashboard reachable without login → **FAIL** INV-P9-007 |
| AH-9.8-03 | Finance smoke on urban tenant → **FAIL** DEC-P9-002     |
| AH-9.8-04 | Doc-guard-only closure → **FAIL** P9-F-009              |
