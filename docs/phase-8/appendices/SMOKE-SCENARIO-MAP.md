# Phase 8 — Smoke scenario map (8.4)

```yaml
map_version: "2026-06-11-v2"
subphase: "8.4"
req_ids: [REQ-P8-040, REQ-P8-041, REQ-P8-042]
invariants: [INV-P8-007, INV-P8-005]
authority: subphases/8.4-e2e-integrity.md · URBAN-ROUTE-MATRIX.md · CASL-URBAN-OWNER-SPEC.md
behavioral_status: VERIFIED_BEHAVIORAL
```

> **Agents:** Targets below are **implementation contracts** — files are **not on trunk** until 8.2 (product) + 8.4 (E2E) land. Do not stub `test.skip` or empty bodies; each scenario must assert HTTP status, DOM surface, or JSON `code` per block.

## Summary matrix

| ID        | Title                             | Playwright target                                                      | API chain target                                                 | Pass signal                                                             |
| --------- | --------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| SMK-P8-01 | Public catalog browse (anonymous) | `apps/web/tests/e2e/urban-e2e-integrity.spec.ts` · `test('SMK-P8-01')` | `apps/api/test/urban-e2e-http.spec.ts` · `describe('SMK-P8-01')` | **200** catalog page · ≥1 published tour visible · no auth cookie       |
| SMK-P8-02 | Public registration intake        | same file · `test('SMK-P8-02')`                                        | same API file · `describe('SMK-P8-02')`                          | OTP + intake UI · **201** API · `[data-public-registration-success]`    |
| SMK-P8-03 | Owner settings load               | same file · `test('SMK-P8-03')`                                        | same API file · `describe('SMK-P8-03')`                          | **200** `/settings/urban` · settings form rendered                      |
| SMK-P8-04 | Member denied settings            | same file · `test('SMK-P8-04')`                                        | same API file · `describe('SMK-P8-04')`                          | **403** + `URBAN_OWNER_REQUIRED` OR `[data-workspace-wizard-forbidden]` |

**Supporting artifacts (required, not optional stubs):**

| Artifact           | Path                                                                                          | Role                                                          |
| ------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Playwright config  | `apps/web/playwright.urban.config.ts`                                                         | `baseURL` → `http://urban.localhost:3000`                     |
| npm script         | `apps/web/package.json` → `test:e2e:urban`                                                    | Invokes Playwright urban config                               |
| E2E fixture module | `apps/api/test/fixtures/urban-smoke-e2e-tenant.ts`                                            | Stable tenant/tour/users — **single SoT** for SMK-P8-\*       |
| Web public routes  | `apps/web/app/(public)/catalog/page.tsx` · `[tourId]/page.tsx` · `[tourId]/register/page.tsx` | Server components → API                                       |
| Web settings route | `apps/web/app/(app)/settings/urban/page.tsx`                                                  | Owner guard → `canLoadUrbanSettings`                          |
| API dispatch       | `apps/api/src/urban/urban.routes.ts`                                                          | Registered in `apps/api/src/openapi/dispatch-routes.ts` (8.2) |
| Session helpers    | `apps/web/tests/e2e/fixtures/urban-owner-session.ts` · `urban-member-session.ts`              | Dev web session bootstrap for SMK-P8-03/04                    |
| M17 OTP fixture    | `apps/web/tests/e2e/fixtures/catalog-registration-otp.ts` · `apps/portal/tests/e2e/fixtures/catalog-registration-otp.ts` | Shared OTP + intake helpers for SMK-P8-02 · SMK-DREG-01 · SMK-PTL-01 |

### Cross-workspace M17 smokes (Denali + marketing)

| ID           | Title                              | Playwright target                                              | Host / notes                                                                 |
| ------------ | ---------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| SMK-DREG-01  | Denali portal OTP + intake         | `apps/web/tests/e2e/denali-catalog-registration.spec.ts`       | `operator.localhost:3003` · `apps/portal` · `pnpm --filter @apps/web run test:e2e:denali` |
| SMK-PTL-01   | Portal-owned registration smoke    | `apps/portal/tests/e2e/portal-registration-smoke.spec.ts`        | `operator.localhost:3003` · `pnpm --filter @apps/portal run test:smoke` |
| SMK-MKT-03   | Marketing CTA → portal OTP → intake | `apps/marketing/tests/e2e/marketing-catalog-smoke.spec.ts`     | `operator.localhost:3002` → portal register · `pnpm --filter @apps/marketing run test:smoke` |
| SMK-MKT-05   | Urban marketing catalog browse + detail | `apps/marketing/tests/e2e/marketing-urban-catalog-smoke.spec.ts` | `urban.localhost:3002` · urban skin · city filter · `PW_NO_REUSE_SERVER=1 pnpm --filter @apps/marketing run test:smoke:urban` |

Authority: [`docs/workspaces/denali/public-catalog.md`](../../workspaces/denali/public-catalog.md) · UI specs: [marketing-catalog-ui.md](../../workspaces/denali/marketing-catalog-ui.md) · [portal-registration-ui.md](../../workspaces/denali/portal-registration-ui.md) · guard `pnpm run guard:public-catalog-m17` (dynamic count · also in `p6:gate` / `p4:gate`).

---

## Host / env (all scenarios)

```bash
export NODE_ENV=test
export AUTH_ALLOW_DEV_BEARER=true
export DATABASE_URL="${DATABASE_URL:-postgresql://app:app@localhost:5432/app_tour_test}"
export SMOKE_WEB_BASE_URL="${SMOKE_WEB_BASE_URL:-http://urban.localhost:3000}"
export SMOKE_API_URL="${SMOKE_API_URL:-http://localhost:4000}"
export URBAN_SMOKE_TENANT_ID="00000000-0000-4000-8000-000000000004"
export URBAN_SMOKE_SUBDOMAIN="urban"
# Optional — rate-limit flood proof (CP-8.4-06 soft):
# export REDIS_URL=redis://localhost:6379
```

**Verification commands:**

```bash
pnpm --filter @apps/web run test:e2e:urban:install   # first-time chromium
pnpm --filter @apps/web run test:e2e:urban
pnpm --filter @apps/api exec node --import tsx --test test/urban-e2e-http.spec.ts
```

---

## Shared fixture contract (`urban-smoke-e2e-tenant.ts`)

Target module exports **stable UUIDs** — must match `@app-tour/workspace-urban` `URBAN_SMOKE_TENANT_ID` / host map in `apps/web/src/tenant/resolve-host-tenant.ts`.

| Key               | UUID / value                           | Purpose                                     |
| ----------------- | -------------------------------------- | ------------------------------------------- |
| `tenantId`        | `00000000-0000-4000-8000-000000000004` | `workspace_type: urban` · subdomain `urban` |
| `workspaceId`     | `00000000-0000-4000-8000-000000000403` | Member binding + owner scope                |
| `ownerUserId`     | `00000000-0000-4000-8000-000000000401` | `role: owner` · `status: ACTIVE`            |
| `memberUserId`    | `00000000-0000-4000-8000-000000000402` | `role: member` · `status: ACTIVE`           |
| `publishedTourId` | `00000000-0000-4000-8000-000000000410` | Catalog + registration target               |
| `draftTourId`     | `00000000-0000-4000-8000-000000000411` | Must **not** appear on public catalog       |

**Postgres seed state (apply in `before` hook or migration seed):**

```sql
-- tenants row
INSERT INTO tenants (id, subdomain, workspace_type, theme, ...)
VALUES (
  '00000000-0000-4000-8000-000000000004',
  'urban',
  'urban',
  '{"primaryColor":"#0d9488","urban":{"catalog":{"publicEnabled":true,"slug":"catalog"},"registration":{"policy":"open","requirePhone":false}}}'::jsonb,
  ...
);

-- tours: published (visible) + draft (hidden)
-- Tour.publish_status = 'published' | 'draft'
-- Tour.canonical from packages/workspaces/urban/test/fixtures/golden/urban-tour-minimal.json
--   + publishStatus=published, publishedAt, catalogSummary for SMK-P8-01 card text
```

**Dev bearer mint (API HTTP specs — `encodeDevBearerToken` from `apps/api/src/tenant-kernel/parse-bearer.ts`):**

```typescript
// Owner — SMK-P8-03
encodeDevBearerToken({
  userId: "00000000-0000-4000-8000-000000000401",
  tenantId: "00000000-0000-4000-8000-000000000004",
  role: "owner",
  status: "ACTIVE",
  workspaceId: "00000000-0000-4000-8000-000000000403",
});

// Member — SMK-P8-04
encodeDevBearerToken({
  userId: "00000000-0000-4000-8000-000000000402",
  tenantId: "00000000-0000-4000-8000-000000000004",
  role: "member",
  status: "ACTIVE",
  workspaceId: "00000000-0000-4000-8000-000000000403",
});
```

**Theme flags required for SMK-P8-01/02:**

| Path                                        | Value                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `tenants.theme.urban.catalog.publicEnabled` | `true`                                                                                |
| `tenants.theme.urban.catalog.slug`          | `catalog` (web path `/catalog`)                                                       |
| `tenants.theme.urban.registration.policy`   | `open` (SMK-P8-02) or `waitlist` (alternate negative branch — not in smoke PASS path) |

---

## SMK-P8-01 — Public catalog browse (anonymous)

### Scenario ID & title

**SMK-P8-01** — Anonymous user opens urban tenant public catalog and sees only **published** tours.

### Target host / runtime context

| Layer                  | Context                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Web**                | `GET http://urban.localhost:3000/catalog` — host resolves `tenantId` via `resolveTenantIdFromDevHost` → `URBAN_SMOKE_TENANT_ID` (`apps/web/src/tenant/resolve-host-tenant.ts`) |
| **Web RSC**            | Server fetch → `GET ${SMOKE_API_URL}/urban/catalog?limit=20` — **no** `Authorization` header                                                                                   |
| **API**                | `apps/api/src/urban/urban.routes.ts` · `GET /urban/catalog` · `workspaceType=urban` from `resolveWorkspaceTypeForTenant`                                                       |
| **Isolation boundary** | Request must **not** leak starter/denali tours — RLS `tenant_id = URBAN_SMOKE_TENANT_ID` + `publish_status = published` filter                                                 |

### Required database fixtures & seed states

| Fixture                | State                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Tenant                 | `urban` subdomain · `workspace_type = urban` · `theme.urban.catalog.publicEnabled = true`                   |
| Tour `…0410`           | `publish_status = published` · canonical title `"Berlin city highlights"` (golden minimal + publish fields) |
| Tour `…0411`           | `publish_status = draft` — **absent** from list response                                                    |
| Auth                   | **None** — no cookies · no bearer                                                                           |
| Prerequisite subphases | **8.2** routes live · **8.1** not required for anonymous read                                               |

### Legacy path reference line

| Legacy                                                               | Trunk contract                                                                                                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `legacy/apps/web/app/(public)/catalog/page.tsx`                      | `apps/web/app/(public)/catalog/page.tsx`                                                                                                           |
| `legacy/apps/web/app/(public)/catalog/[tourId]/page.tsx`             | `apps/web/app/(public)/catalog/[tourId]/page.tsx`                                                                                                  |
| Legacy list used workspace-scoped Prisma + `formProfile=urban_event` | Trunk list uses `GET /urban/catalog` + `idx_tours_tenant_publish_catalog` — **no** Denali wizard chunk                                             |
| Phase 7 `/tours` isolation (`SMK-P7-04`)                             | Public catalog **does not** mount `/tours/new` — only `GET /tours?visibility=public` alias per [`URBAN-ROUTE-MATRIX.md`](URBAN-ROUTE-MATRIX.md) §A |

### Expected observability trace token

On **failure**, grep API logs / trace for:

```text
workspaceType=urban
path=/urban/catalog
tenantId=00000000-0000-4000-8000-000000000004
```

Rate-limit bucket (if `REDIS_URL` set):

```text
ratelimit:00000000-0000-4000-8000-000000000004:pool:GET:/urban/catalog
```

Playwright pass DOM anchor: visible text `Berlin city highlights` · **no** `[data-workspace-wizard-forbidden]`.

---

## SMK-P8-02 — Public registration intake

### Scenario ID & title

**SMK-P8-02** — Anonymous user completes **M17 phone OTP** + **tour intake** for a **published** tour; persistence round-trips plugin validation.

### Target host / runtime context

| Layer                  | Context                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Portal**             | `GET http://urban.localhost:3003/catalog/{publishedTourId}/register` → `[data-public-registration-phone]` (DEC-P11-014)      |
| **Portal OTP**         | `POST /api/public-auth/*` BFF (`apps/portal`) → `POST /public/auth/*` API · dev static OTP `1234`                          |
| **Portal intake**      | `[data-public-registration-intake]` → `POST /api/catalog/registrations` → `POST ${SMOKE_API_URL}/urban/registrations`        |
| **API**                | `POST /urban/registrations` · `Idempotency-Key: smk-p8-02-{runId}` header **required** (DEC-006)                           |
| **Plugin**             | `getUrbanWorkspacePlugin().validationHooks` on `registration.*` paths — [`URBAN-PRODUCT-SCOPE.md`](URBAN-PRODUCT-SCOPE.md) |
| **Isolation boundary** | Registration row `tenant_id` + `tour_id` scoped — duplicate email → **409**                                                |

### Required database fixtures & seed states

| Fixture      | State                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Tenant       | Same as SMK-P8-01 · `theme.urban.registration.policy = open`                                                   |
| Tour `…0410` | `publish_status = published` · `capacity >= 120`                                                               |
| Table        | `urban_registrations` migrated (`infra/sql/004_urban_product_delta.sql`)                                       |
| Form payload | Unique mobile + OTP · intake `email: smk-p8-02-{runId}@urban-smoke.local` · `fullName: Smoke Tester` · `partySize: 2` |
| Auth         | Public OTP session cookie after verify/profile; tour intake uses guest catalog headers on API                |
| Idempotency  | Fresh `Idempotency-Key` per run — replay same key → same **201** body                                          |

### Legacy path reference line

| Legacy                                                                        | Trunk contract                                                                                                 |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `legacy/apps/web/app/(public)/catalog/[tourId]/register/page.tsx`             | `apps/web/app/(public)/catalog/[tourId]/register/page.tsx`                                                     |
| Legacy `urban_event` profile registration fields                              | Trunk `registration.contact.*` + `registration.partySize` per URBAN-PRODUCT-SCOPE — **no** itinerary/transport |
| Legacy demo tenant `legacy/apps/api/src/scripts/urban-demo-tenant.fixture.ts` | Trunk fixture `apps/api/test/fixtures/urban-smoke-e2e-tenant.ts` — subdomain **`urban`** not `urban-demo`      |

### Expected observability trace token

On **success** (outbox / audit):

```text
eventType=urban.registration.created
aggregateType=TourRegistration
```

On **failure** (validation):

```text
path=/urban/registrations
status=400
```

Rate-limit bucket:

```text
ratelimit:00000000-0000-4000-8000-000000000004:pool:POST:/urban/registrations
```

Web pass: `[data-public-registration-success]` visible · API pass: **201** + registration id in JSON.

Playwright pass DOM anchors: `[data-public-registration-phone]` → `[data-public-registration-otp]` → (optional `[data-public-registration-profile]`) → `[data-public-registration-intake]` → `[data-public-registration-success]`.

---

## SMK-P8-03 — Owner settings load

### Scenario ID & title

**SMK-P8-03** — Workspace **owner** session loads urban settings panel and reads current theme config.

### Target host / runtime context

| Layer                  | Context                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web**                | `GET http://urban.localhost:3000/settings/urban` with **owner** dev session (`urban-owner-session.ts`)                                                      |
| **Web guard**          | `canLoadUrbanSettings` in `apps/web/src/urban/urban-settings-access.ts` → `isWorkspaceOwner` + `canPerformUrbanOwnerMutation` surface `urban.settings.read` |
| **API**                | `GET /urban/settings` · `assertWorkspaceOwner` **before** `runWithHttpRequestContext` · surface `urban.settings.read`                                       |
| **Isolation boundary** | Owner on **urban** tenant only — starter owner token must **not** pass urban settings (SDK-8.1-06)                                                          |

### Required database fixtures & seed states

| Fixture                | State                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| Tenant                 | `workspace_type = urban` · theme JSON includes `urban.catalog` + `urban.registration` blocks  |
| Membership             | `ownerUserId` (`…0401`) linked to tenant with `role = owner` in test auth store / dev session |
| Bearer (API spec)      | Owner `encodeDevBearerToken` (see shared fixture)                                             |
| Web session            | Playwright `storageState` from owner login fixture — must set tenant host `urban.localhost`   |
| Prerequisite subphases | **8.1** `VERIFIED_BEHAVIORAL` (auth) · **8.2** settings route + API                           |

### Legacy path reference line

| Legacy                                                                                                              | Trunk contract                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy urban workspace config scattered in theme seeds (`URBAN_DEMO_THEME_SEEDS` in `urban-demo-tenant.fixture.ts`) | Trunk unified `PATCH /urban/settings` payload keys in [`URBAN-ROUTE-MATRIX.md`](URBAN-ROUTE-MATRIX.md) §C                                                        |
| Legacy admin could mutate tenant config via shared admin surfaces                                                   | Trunk **RULE-P8-004**: `isWorkspaceOwner` only — admin receives **403** `URBAN_OWNER_REQUIRED` on `PATCH /urban/settings` (not exercised in SMK-P8-03 PASS path) |
| `/tours` route isolation                                                                                            | Settings path **`/settings/urban`** — no collision with `/tours/new` urban wizard (`SMK-P7-04`)                                                                  |

### Expected observability trace token

On **failure** (wrong actor):

```text
code=URBAN_OWNER_REQUIRED
surface=urban.settings.read
```

On **success**:

```text
path=/urban/settings
status=200
role=owner
workspaceType=urban
```

Rate-limit bucket (authenticated):

```text
ratelimit:00000000-0000-4000-8000-000000000004:pool:GET:/urban/settings
```

Playwright pass: `h1` or section containing `Catalog` / `Registration` settings labels · **no** `[data-workspace-wizard-forbidden]`.

---

## SMK-P8-04 — Member denied settings

### Scenario ID & title

**SMK-P8-04** — Workspace **member** session is denied urban settings (INV-P8-007 · REQ-P8-042).

### Target host / runtime context

| Layer                        | Context                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Web**                      | `GET http://urban.localhost:3000/settings/urban` with **member** dev session (`urban-member-session.ts`)          |
| **Web guard**                | `canLoadUrbanSettings` → **false** → render `WizardAccessDenied` (`apps/web/src/wizard/wizard-access-denied.tsx`) |
| **API** (parallel HTTP spec) | `GET /urban/settings` and `PATCH /urban/settings` with member bearer → **403**                                    |
| **Isolation boundary**       | Member may still `POST /tours` per platform policy — settings denial must **not** blank entire app shell          |

### Required database fixtures & seed states

| Fixture                                             | State                                                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Tenant                                              | Same urban tenant as SMK-P8-03                                                                                          |
| Membership                                          | `memberUserId` (`…0402`) · `role = member` · `workspaceId = …0403` **required** (fail-closed without workspace binding) |
| Bearer (API spec)                                   | Member `encodeDevBearerToken` (see shared fixture)                                                                      |
| Admin negative (optional CI matrix, not smoke PASS) | `role = admin` must also **403** on `/urban/settings` per DEC-P8-001                                                    |
| Prerequisite subphases                              | **8.1** owner auth layer · **8.4** member fixture                                                                       |

### Legacy path reference line

| Legacy                                                      | Trunk contract                                                                                                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy shared admin/settings paths allowed `isAdminOrOwner` | Trunk **forbids** `isAdminOrOwner` on urban settings — [`CASL-URBAN-OWNER-SPEC.md`](CASL-URBAN-OWNER-SPEC.md) · `rg 'isAdminOrOwner' apps/api/src/urban` → exit 1 |
| Legacy `/tours` member may edit tours                       | Trunk urban **settings/catalog admin/publish** are owner-only; member tour create is orthogonal (AH-8.4-03)                                                       |
| Phase 7 wizard deny pattern                                 | Reuse `WizardAccessDenied` — same CASL deny surface as starter wizard (`data-workspace-wizard-forbidden`)                                                         |

### Expected observability trace token

API response body (required):

```json
{
  "error": "URBAN_OWNER_REQUIRED",
  "code": "URBAN_OWNER_REQUIRED"
}
```

Structured log / interceptor:

```text
code=URBAN_OWNER_REQUIRED
surface=urban.settings.read
correlationId=<requestId>
```

Web DOM (required):

```text
[data-workspace-wizard-forbidden][data-status-code="403"]
```

Playwright grep:

```bash
pnpm --filter @apps/web run test:e2e:urban -- --grep 'SMK-P8-04'
```

---

## Forbidden smoke paths

| Forbidden                                          | Reason                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `test.skip` on all SMK-P8-\*                       | AH-8.4-01 → **FAIL**                       |
| `page.route('**/api/**')` mock without opt-in doc  | AH-8.4-02 → **FAIL**                       |
| Force login on SMK-P8-01 catalog                   | AH-8.4-04 → **FAIL**                       |
| Owner session on SMK-P8-01                         | Public catalog must stay anonymous         |
| `getWizardConfig("urban").wizardMode === "denali"` | RULE-P7-003 · SMK-P7-02 forbidden coupling |
| Assert legacy `urban-demo` subdomain               | Use `urban` smoke host only                |

---

## Cross-reference

| Doc                   | Link                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| Subphase 8.4          | [`../subphases/8.4-e2e-integrity.md`](../subphases/8.4-e2e-integrity.md)                           |
| Route matrix          | [`URBAN-ROUTE-MATRIX.md`](URBAN-ROUTE-MATRIX.md)                                                   |
| REQ proof             | [`../audits/verification-matrix.md`](../audits/verification-matrix.md) REQ-P8-040..042             |
| Phase 7 smoke pattern | [`../../phase-7/appendices/SMOKE-SCENARIO-MAP.md`](../../phase-7/appendices/SMOKE-SCENARIO-MAP.md) |
