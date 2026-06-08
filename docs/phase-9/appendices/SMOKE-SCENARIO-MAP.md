# Phase 9 — Smoke scenario map (SMK-P9)

```yaml
smoke_version: "2026-06-08-v4"
subphase: "9.8"
req_ids: [REQ-P9-080, REQ-P9-083]
invariants: [INV-P9-007, INV-P8-007]
authority: subphases/9.8-operator-dod-gate.md · TRACEABILITY-MAP.md
behavioral_status: ABSENT
fixture_tenant: denali.localhost
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
| **SMK-P9-02** | Wizard create → tour in list        | same · `test('SMK-P9-02')`                     | POST /tours + GET /tours?view=operator | Tour title in `(app)/tours` card grid |
| **SMK-P9-03** | Invite → accept → directory         | same · `test('SMK-P9-03')`                     | invite + accept APIs                   | New member row                        |
| **SMK-P9-04** | Pending booking → approve           | same · `test('SMK-P9-04')`                     | POST approve                           | Status approved badge                 |
| **SMK-P9-05** | Template seed → wizard prefill      | same · `test('SMK-P9-05')`                     | PUT template + GET wizard              | Field = `SMK-P9-SEED`                 |
| **SMK-P9-06** | Leader review alias (admin session) | same · `test('SMK-P9-06')`                     | GET `/leader/review` (legacy URL)      | Inspection table renders              |
| **SMK-P9-07** | Manual booking create               | same · `test('SMK-P9-07')`                     | POST booking create                    | Row in queue pending                  |
| **SMK-P9-08** | Settings module round-trip          | same · `test('SMK-P9-08')`                     | PUT equipment item                     | Item visible on reload                |

**Supporting artifacts (required):**

| Artifact          | Path                                                        | Role                       |
| ----------------- | ----------------------------------------------------------- | -------------------------- |
| Fixture SoT       | `apps/api/test/fixtures/operator-smoke-e2e-tenant.ts`       | Stable UUIDs for SMK-P9-\* |
| Playwright config | `apps/web/playwright.operator.config.ts`                    | `baseURL` → denali host    |
| npm script        | `apps/web/package.json` → `test:e2e:operator`               | Invokes operator config    |
| Login UI          | `apps/web/app/auth/login/page.tsx`                          | OTP flow                   |
| Admin shell       | `apps/web/app/(app)/layout.tsx`                             | Session guard              |
| Identity API      | `apps/api/src/identity/auth.routes.ts`                      | OTP + session              |
| Session helper    | `apps/web/test/fixtures/operator-owner-session.ts` (target) | storageState bootstrap     |

---

## Host / env (all scenarios)

```bash
export NODE_ENV=test
export DATABASE_URL="${DATABASE_URL:-postgresql://app:app@localhost:5432/app_tour_test}"
export OPERATOR_SMOKE_TENANT_HOST=denali.localhost
export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://denali.localhost:3000}"
export OTP_FIXTURE_CODE="${OTP_FIXTURE_CODE:-123456}"
export OPERATOR_SMOKE_OWNER_MOBILE="+15550001001"
# Optional Redis for OTP throttle proof:
# export REDIS_URL=redis://localhost:6379
```

**Verification commands:**

```bash
pnpm --filter @apps/web exec node --import tsx --test test/operator-smoke.spec.ts
# Full E2E when Playwright wired:
# pnpm --filter @apps/web run test:e2e:operator
```

---

## Shared fixture contract (`operator-smoke-e2e-tenant.ts`)

| Key                 | UUID / value                           | Purpose                  |
| ------------------- | -------------------------------------- | ------------------------ |
| `tenantId`          | `00000000-0000-4000-8000-000000000014` | Denali workspace tenant  |
| `ownerUserId`       | `00000000-0000-4000-8000-000000000101` | `role: owner`            |
| `adminUserId`       | `00000000-0000-4000-8000-000000000102` | `role: admin`            |
| `memberUserId`      | `00000000-0000-4000-8000-000000000103` | `role: member`           |
| `seedTourId`        | `00000000-0000-4000-8000-000000000210` | SMK-P9-02 list target    |
| `pendingBookingId`  | `00000000-0000-4000-8000-000000000310` | SMK-P9-04 approve target |
| `templateSeedValue` | `SMK-P9-SEED`                          | SMK-P9-05 wizard prefill |

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

**Steps:**

1. Open `/tours/new` — complete minimal wizard (Phase 6 engine)
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

1. `(app)/settings/tour-wizard-template` — set seed `SMK-P9-SEED`
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
