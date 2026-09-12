# Field Exposure System Architecture

## Status

**Phase 0 complete — architecture frozen (2026-06-27).**
**Phase 1 complete — domain language documentation closure (2026-06-28).**
**Phase 2 complete — read-path adapter closure (2026-06-28).**
**Phase 3 complete — shadow resolver closure (2026-06-28).**
**Phase 4 complete — exposure profile default source closure (2026-06-28).**
**Phase 5 complete — generic exposure UI ownership closure (2026-06-28).**
**Phase 6 complete — dual-write + controlled cutover closure (2026-06-28).**
**Phase 7 complete — integration-owned selection retired (2026-06-28).**

**Phase 8 complete — enterprise exposure resolver, persisted profiles, and audit metadata (2026-06-28).**

This document is the official platform architecture for the Field Exposure System. It
defines domain language, boundaries, invariants, transitional inventory, and migration
phases.

Phase 0 authorizes **freeze and inventory** only. Phase 1 authorizes **domain language
in documentation** only. Phase 2 authorizes the **read-path adapter**
(`IntegrationDeliveryIntent` → `ExposureIntent` view) only. Phase 3 authorizes
**shadow exposure metadata** on dispatch jobs — log-only parity; workers remain on legacy
integration delivery fields until cutover. Phase 4 authorizes **registry-seeded
`ExposureProfile` defaults** — catalog and default field ids cross the exposure module read
boundary; `deliverable` remains a migration seed only. Phase 5 authorizes the **generic
exposure UI** — a reusable, integration-agnostic field-selection component and its pure
selection logic; integrations may only embed it through props. Save persistence stays
integration-owned until Phase 7; Phase 6 mirrors admin saves into native `ExposureIntent`
rows. Phase 6 authorizes **dual-write + controlled cutover** (historical; superseded by Phase 7).
Phase 7 retires `IntegrationDeliveryIntent`, dual-write bridges, and integration-owned save
paths — native `ExposureIntent` is the single field-selection store and
`PATCH /integrations/:id/exposure-intents/:eventType` is the admin save API.
Phase 8 hardens the native exposure system for enterprise operation: catalog access moved to
exposure-owned APIs, resolver/profile/audit contracts are explicit, and shadow diagnostics are
opt-in instead of part of the authoritative runtime path.

Verification:

- Phase 0: `pnpm run guard:field-exposure-phase-0`
- Phase 1: `pnpm run guard:field-exposure-phase-1`
- Phase 2: `pnpm run guard:field-exposure-phase-2`
- Phase 3: `pnpm run guard:field-exposure-phase-3`
- Phase 4: `pnpm run guard:field-exposure-phase-4`
- Phase 5: `pnpm run guard:field-exposure-phase-5`
- Phase 6: `pnpm run guard:field-exposure-phase-6`
- Phase 7: `pnpm run guard:field-exposure-phase-7`
- Phase 8: `pnpm run guard:field-exposure-phase-8`
- Phase 9 (enterprise runtime safety — M2): `pnpm run guard:field-exposure-phase-9`
- Phase 10 (Denali product + enterprise ops — M3/M4): `pnpm run guard:field-exposure-phase-10`
- Phase 11 (platform exposure plugin — M5): `pnpm run guard:field-exposure-phase-11`
- Contracts: `apps/api/test/field-exposure-phase-0-freeze.contract.spec.ts`,
  `apps/api/test/field-exposure-phase-1-language.contract.spec.ts`,
  `apps/api/test/field-exposure-phase-2-adapter.contract.spec.ts`,
  `apps/api/test/field-exposure-phase-3-shadow.contract.spec.ts`,
  `apps/api/test/field-exposure-phase-4-profile.contract.spec.ts`,
  `apps/api/test/field-exposure-phase-4-denali-profile-parity.spec.ts`,
  `apps/web/test/exposure-field-selection.spec.ts`,
  `apps/web/test/exposure-field-checklist.spec.tsx`,
  `apps/web/test/field-exposure-phase-5-ui.contract.spec.ts`,
  `apps/api/test/field-exposure-phase-6-cutover.contract.spec.ts`,
  `apps/api/test/field-exposure-phase-7-retirement.contract.spec.ts`,
  `apps/api/test/field-exposure-phase-8-enterprise-hardening.contract.spec.ts`

**Related:** [Field Policy System](./field-policy-system.md) (entity/workspace state PDP),
[Workspace Integration Plugin System](../dev/workspace-integration-plugin-system.mdoc)
(current integration transport; transitional field-selection path).

---

## Enterprise Closure — Milestone M1 (Phase 9.0 Operator Safe)

Phase 9.0 (enterprise closure track, distinct from Unified Control Plane Phase 9 preview)
hardens the **operator settings path** so Denali admins can navigate, save, and reload
exposure intents without known P0 defects.

### M1 exit criteria (Phase 9.0)

- Settings cross-links use `/settings/...` paths only (`localePrefix: never` in web routing).
- Simulation console field toggles use the same selection helpers as the delivery policy panel.
- Exposure settings cards use exposure-scoped `data-testid` values (not integrations page ids).
- `PATCH /integrations/:id/exposure-intents/:eventType` persists `selectedFieldIds` and
  `fieldDecorations`; covered by `apps/api/test/4-integration/field-exposure-intent-patch.spec.ts`.
- Unresolvable exposure profile for a connection/event returns **400** `invalid_body` with code
  `EXPOSURE_PROFILE_NOT_RESOLVED` (no silent no-op).

### Admin PATCH body semantics (`enabled` field)

The HTTP body field `enabled` on exposure-intent PATCH means **customize field selection**
(`customizeFields` in the web UI), not whether the domain event is delivered.

| Control | API | Effect |
| ------- | --- | ------ |
| Event on/off toggle | `PATCH .../event-policies/:eventType` | Dispatcher policy `enabled` |
| Customize fields checkbox | `PATCH .../exposure-intents/:eventType` body `enabled` | `true` → `override_fields`; `false` → `inherit_profile` |
| `disabled` intent mode | Not written by current admin UI | Reserved for explicit zero-field delivery while event is on |

Verification:

- Web: `apps/web/test/exposure-field-selection.spec.ts`
- API integration: `pnpm --filter @apps/api run test:exposure:integration` (requires `DATABASE_URL`)

### Phase 9.0b — Operator catalog resilience

Hardens the exposure settings path when the native catalog cannot be loaded or is
sourced from registry seed metadata instead of a published wizard template.

**Exit criteria (9.0b):**

- `settings/exposure` SSR-fetches the native catalog; client refresh retries on failure.
- Operator-visible **catalog error banner** with retry when SSR or client catalog fetch fails
  (no silent empty checklist).
- **Integration detail load errors** on `/settings/exposure`: `fetchIntegrationDetail` failures
  surface a destructive banner with retry (same coded-error pattern as integrations settings).
- **Catalog source banner** when `source` is `registry_deliverable_migration_seed` vs
  `published_wizard_template`.
- `settings/integrations` SSR-fetches and client-refreshes the same native catalog with an
  operator-visible **catalog error banner** (not silent `null` catalog).
- Shared SSR proxy helper: `readSessionProxyContext` in
  `apps/web/src/admin/read-session-proxy-context.server.ts` (used by exposure + integrations
  server fetch modules — avoids drift).

Web test ids:

- `SETTINGS_HUB_TEST_IDS.exposurePage` — page root
- `SETTINGS_HUB_TEST_IDS.exposureTelegramPanel` — Telegram field policy card

### Phase 9.6 — Integration validation pack (M1)

PATCH exposure-intent body validation is covered by integration specs (requires `DATABASE_URL`):

| Case | HTTP | Code |
| ---- | ---- | ---- |
| Unknown `selectedFieldIds` entry | 400 | `INTEGRATION_EVENT_POLICY_FIELD_NOT_ALLOWED` |
| Undeclared `eventType` in URL | 400 | `INTEGRATION_DELIVERY_INTENT_EVENT_NOT_ALLOWED` |
| Template references field outside selection | 400 | `INTEGRATION_EVENT_POLICY_TEMPLATE_FIELD_NOT_ALLOWED` |

Spec: `apps/api/test/4-integration/field-exposure-intent-validation.spec.ts`  
Script: `pnpm --filter @apps/api run test:exposure:integration`

### Phase 9.7 — Playwright exposure settings (M1 optional)

Operator E2E for `/settings/exposure` on Denali smoke tenant:

| ID | Scenario |
| -- | -------- |
| SMK-EXP-01 | Owner session → exposure page root visible |
| SMK-EXP-02 | Denali workspace surfaces panel loads |
| SMK-EXP-03 | Settings links use `/settings/...` (no locale prefix) |

Spec: `apps/web/tests/e2e/denali-exposure-settings.spec.ts`  
Run: `pnpm --filter @apps/web run test:e2e:exposure` (requires smoke servers / `PW_EXTERNAL_SERVERS=1`)

**Memory-driver smoke (PLP/PDP field visibility):** `ExposureIntent` persistence uses
`createExposureIntentRepository()` — Prisma when `STORAGE_DRIVER=prisma`, otherwise
`InMemoryExposureIntentRepository` (`apps/api/src/exposure/create-exposure-intent-repository.ts`).
This unblocks operator exposure saves and marketing catalog redaction in memory smokes without
Postgres. End-to-end proof: `apps/web/tests/e2e/plp-pdp-field-visibility.spec.ts` via
`playwright.plp-pdp-field-visibility.config.ts`.

**PDP destination label enrichment:** `readDenaliCatalogDetailEgress` resolves
`destinationLabel` from tour `destinationId` via `destinationNameById`. Catalog services
collect ids with `collectItinerarySegmentDestinationIds`, which includes both itinerary
segment `destinationId` values **and** the tour root `destinationId` (smoke tours often
only set the root ref). Without the root id, PLP `category` can render while PDP
`data-marketing-catalog-detail-destination` stays empty.

Root alias: `pnpm run test:exposure:integration` → all Postgres exposure integration specs.

---

### Phase 9.2 — Prisma generate SOP

`apps/api/scripts/db-migrate-deploy.mjs` runs `prisma generate` after every successful
`migrate deploy`. Dev/prod checklist: migrate deploy → generate (automatic) → API restart.

Documented in `docs/phase-5/appendices/migrate-deploy-only.md` and
`docs/dev/system-consistency-guard.mdoc`.

### Phase 9.4 — Exposure settings RBAC

Module gate: `assertWorkspaceExposureModuleAccess` (`settings-exposure-module-access.ts`),
pattern = `settings-branding-module-access.ts`, module id `exposure`.

| Verb | Rule |
| ---- | ---- |
| read | Denali workspace + module in tenant manifest |
| mutate | owner or admin (`SettingsMutationForbiddenError` → 403) |

Wired on:

- `patchConnectionExposureIntentForIntegration`
- `patchWorkspaceSurfaceExposureIntent`
- `getWorkspaceExposureCatalog` / `getWorkspaceExposureSurfaces` (read)

**Not** gated: simulation/diff/control-plane preview (read-only compute; session + workspace only).

Route mappers: `mapIntegrationRouteError` and `mapExposureRouteError` map
`SettingsMutationForbiddenError`, `SettingsModuleNotSupportedError`, and
`SettingsWorkspaceForbiddenError`.

Integration: `apps/api/test/4-integration/field-exposure-rbac.spec.ts`.

### Phase 9.5a — Orphan exposure intent cleanup

`ExposureIntent` rows are scoped by JSON (`scope.connectionId`) — there is no FK to
`integration_connections`. When an operator deletes a connection, native intents for
that connection must be removed in the same `withTenantRls` transaction.

Implementation: `deleteConnectionExposureIntentsInTransaction` in
`connection-exposure-intent-scope.ts`, called from `deleteIntegration` before
`integrationConnection.delete`. Matches both route-scoped
(`{ connectionId, eventType }`) and legacy (`{ connectionId }`) scope shapes via
`scope.path connectionId` filter.

Integration: `apps/api/test/4-integration/field-exposure-lifecycle.spec.ts`.

### Phase 9.5b — Legacy scope merge

Backfill migration `20260705100000_exposure_intent_legacy_scope_merge` rewrites connection-only
scopes (`{"connectionId"}`) to route scopes (`{"connectionId","eventType"}`) using the row
`trigger` as `eventType`. Rows that already have a route-scoped twin are deleted (route wins).

After migration, runtime code uses **route-scoped lookup only** —
`findConnectionExposureIntentForEvent` (legacy `findConnectionExposureIntentWithLegacyScopeFallback`
removed).

Contract: `apps/api/test/field-exposure-legacy-scope.contract.spec.ts`

### Phase 9.3 — RLS reminder + connection-scope index

`exposure_intents` already has tenant RLS from migration `20260629100000`. Phase 9.3 closes
two runtime gaps:

| Item | Action |
| ---- | ------ |
| `denali_exposure_reminder_activations` | ENABLE + FORCE RLS + tenant policy (was missing) |
| `listForConnectionScope` hot path | Expression index `idx_exposure_intents_tenant_connection_scope` on `(tenant_id, (scope->>'connectionId'))` + Prisma JSON filter (no full-tenant scan) |
| Reminder repository | `withTenantRls` on read/write (was direct `prisma`) |

Migrations:

- `20260704100000_exposure_intent_connection_scope_index`
- `20260704110000_denali_exposure_reminder_activations_rls`

Contract: `apps/api/test/field-exposure-phase-9-3-rls.contract.spec.ts`  
Integration (RLS negative): `apps/api/test/4-integration/field-exposure-rls-isolation.spec.ts`

### Phase 9.10 — Fail-closed dispatch (M2 blocker)

When the forward engine **selector** cannot produce `engineSelectedFieldIds`
(`engineSelectorMissing=true`), dispatch must not enqueue a delivery job with an empty field
payload (silent empty Telegram send).

| Failure | Behavior |
| ------- | -------- |
| `resolveForwardEngineDecisionMap` throw | `engineSelectorMissing=true` |
| `FIELD_EXPOSURE_ENGINE_FAIL_CLOSED=true` | `recordFieldExposureEngineSelectorFailure` + **skip enqueue** (`continue`) |
| Flag false (default) | Record metric + **observe** — enqueue continues (staging rollout) |
| `runForwardFieldExposureDecisionEngineShadow` throw | Log only — **enqueue continues** (unchanged) |

Env: `FIELD_EXPOSURE_ENGINE_FAIL_CLOSED=true` (staging → production after metric review).

Contract: `apps/api/test/field-exposure-dispatch-fail-closed.spec.ts`  
Unit: `apps/api/src/integrations/application/dispatch-integration-domain-event.spec.ts`

### Phase 9.1 — Exposure table consistency gate (M2)

Exposure subsystem tables are checked at API boot alongside integration tables.

| Table | Purpose |
| ----- | ------- |
| `exposure_intents` | Native exposure intent storage |
| `exposure_profiles` | Persisted exposure profiles |
| `denali_exposure_reminder_activations` | Denali reminder ledger |

| Stage | Env | Behavior |
| ----- | --- | -------- |
| **9.1a** (default) | `FIELD_EXPOSURE_CONSISTENCY_GATE_FATAL` unset/false | Log `CONSISTENCY_MISSING_EXPOSURE_TABLES` (warn) — integration gate **stays armed** |
| **9.1b** | `FIELD_EXPOSURE_CONSISTENCY_GATE_FATAL=true` | Missing exposure tables → `report.ok=false` — blocks integration **mutations** (same as integration tables) |

Reads (`GET /integrations`, detail, catalog) remain available during drift.

Implementation: `apps/api/src/health/migration-consistency-check.ts`  
Unit: `apps/api/src/health/migration-consistency-check.spec.ts`

### Phase 10.2 — Degraded integration detail read (M2)

`loadConnectionPoliciesAndIntents` keeps try/catch (per `system-consistency-guard.mdoc`) but:

- Logs `integration.policies_load_degraded` / `integration.exposure_intents_load_degraded` on failure
- Returns `loadWarnings` on the connection DTO: `POLICIES_UNAVAILABLE`, `EXPOSURE_INTENTS_UNAVAILABLE`

Web: operator banner on `/settings/exposure` and `/settings/integrations` detail — **not** HTTP 503 on GET.

### Phase 10.1 — Exposure observability (M2)

- All tenant-scoped exposure counters registered in `TENANT_SCOPED_METRIC_NAMES`
- Denali reminder scheduler stopped on graceful shutdown (`warmPostListen` path)

### Denali catalog redaction (Phase 10.3)

Public catalog HTTP (`GET /denali/catalog`, `GET /denali/catalog/:tourId`) applies
`applyDenaliCatalogCardExposure` using field ids from `DenaliExposureResolverPort`.

Contract: `apps/api/test/field-exposure-denali-catalog-redaction.contract.spec.ts`
Integration: `apps/api/test/4-integration/field-exposure-denali-catalog-redaction.spec.ts`
Integration (reminder feed): `apps/api/test/4-integration/field-exposure-denali-reminder-feed.spec.ts`
Unit (workspace): `packages/workspaces/denali/test/denali-catalog-exposure.spec.ts`

**DB-less smoke fallback:** `resolveDenaliSurfaceVisibleFieldIds` (`resolve-denali-surface-exposure.ts`) wraps Prisma-backed `resolvePersistedExposureProfileForContext` and `createExposureIntentRepository().findForContext` in try/catch — same pattern as Urban. When `DATABASE_URL` is unset (operator Playwright smoke, unit tests), resolver falls back to registry-seeded profile defaults instead of surfacing 503 on catalog detail (portal register path SMK-MKT-03).

### Urban catalog redaction (Phase 10.3 extension)

Public catalog HTTP (`GET /urban/catalog`, `GET /urban/catalog/:tourId`) applies
`applyUrbanCatalogCardExposure` using registry field ids (`tour.title`, `tour.city`, …) from
`UrbanExposureResolverPort` (`resolveUrbanSurfaceVisibleFieldIds` in `apps/api`).

Surfaces: `public_list` (list cards) and `public_details` (detail). Both map to FieldPolicy
surface `public_website` via `mapUrbanExposureSurfaceToFieldPolicySurface`.

Contract: `apps/api/test/field-exposure-urban-catalog-redaction.contract.spec.ts`
Unit (workspace): `packages/workspaces/urban/test/urban-catalog-exposure.spec.ts`

**DB-less smoke fallback:** `resolveUrbanSurfaceVisibleFieldIds` (`exposure/resolve-urban-surface-exposure.ts`; folded through configure-2/3b from the former configure-urban-surface-exposure module) wraps Prisma-backed profile/intent lookups in try/catch — falls back to registry-seeded defaults when `DATABASE_URL` is unset (SMK-MKT-05 · unit tests).

Host wiring: `configure-product-http-hosts.ts` → `buildUrbanExposureResolverPort`.
Workspace HTTP: `packages/workspaces/urban/src/http/catalog.service.ts` → `applyCatalogExposure`.
Production ingress: `apps/api/src/urban/urban.routes.ts` delegates to workspace catalog service.

### Phase 11.0 — Exposure settings audit trail (M4)

Mutations emit `operator_settings_audit_events` via `emitSettingsResourceAudit`:

| Mutation | Action | Resource id |
| -------- | ------ | ------------- |
| `patchConnectionExposureIntentForIntegration` | `settings.exposure.patch` | `{connectionId}:{eventType}` |
| `patchWorkspaceSurfaceExposureIntent` | `settings.exposure.patch` | `{workspaceId}:{surface}:{trigger}` |

Integration: `apps/api/test/4-integration/field-exposure-audit.spec.ts`

### Phase 10.4 — Catalog exposure bindings audit (M3)

`DENALI_CATALOG_CARD_EXPOSURE_BINDINGS` maps **registry field ids → `PublicCatalogCard` redaction steps** only.
Fields that never appear on the catalog card must **not** be listed (no no-op bindings).

| Field id | Consumer | Binding / behavior |
| -------- | -------- | ------------------ |
| `title`, `denali.destination`, `denali.datetime`, `denali.datetime-end`, `denali.pricing-participants`, `denali.photos`, `capacityMax`, `meetingPoint`, `startPointLocationText` | Catalog / dashboard / reminder (via shared card mapper) | Explicit `applyHidden` in `denali-catalog-exposure-bindings.ts` |
| `capacityMin`, `denali.pricing-payment` | `user_dashboard` surface defaults only | **Intentionally absent** — not on `PublicCatalogCard`; future dashboard DTO extension |
| `denali.location-zones` | Integration delivery enrich only | `enrich-canonical-delivery-payload.ts` — never HTTP catalog |
| `denali.approximate-return-time` | Delivery + wizard; not on catalog card | **Removed from catalog bindings** — exposure enforced on delivery path / future dashboard fields |

Unit: `packages/workspaces/denali/test/denali-catalog-exposure.spec.ts` (binding inventory)

### Phase 10.5 — Denali settings required-module ownership (M3) / Phase 3c thin-shell

Required settings module ids are exported from
`packages/workspaces/denali/src/settings/denali-settings.manifest.ts` as
`DENALI_BACKEND_REQUIRED_MODULE_IDS` (derived from `DENALI_SETTINGS_MODULES`) and
re-exported from `settings/fallback-modules`. The shell settings-hub binder loads them
via dynamic import with fallback modules — **no** `apps/web` generated product constant file.

`pnpm run generate:denali-settings-modules --check` verifies package ownership + absence of
the former shell emit path. Consumed at runtime by `settings-module-consistency-guard.ts`
through `ensureSettingsHubFallbackPolicy(pluginId).requiredModuleIds`.

### Phase 10.6 — OpenAPI inventory (M3)

`apps/api/src/openapi/dispatch-routes.ts` includes:

- `GET /denali/dashboard/tours/{tourId}` — registered-user dashboard card
- `GET /denali/reminders/feed` — reminder feed with exposure redaction

Regenerate: `pnpm --filter @apps/api run openapi:generate`

### Phase 11.1 — Operator runbooks (M4)

| Runbook | Path |
| ------- | ---- |
| Empty delivery / engine selector failure | `docs/dev/runbooks/exposure-empty-delivery.mdoc` |
| Integration gate blocked (consistency) | `docs/dev/runbooks/integration-gate-blocked.mdoc` |
| Exposure env flags | `docs/dev/runbooks/exposure-flags.mdoc` |

## Enterprise Closure — Milestone M5 (Platform Scale)

Generalizes Denali-specific exposure wiring into a workspace plugin port so new workspaces can
declare surface defaults without API hardcoding.

### M5 exit criteria

| Criterion | Verification |
| --------- | ------------ |
| Plugin contract doc | `docs/dev/workspace-exposure-plugin-contract.mdoc` |
| SDK `WorkspacePlugin.exposureSurface` | `packages/workspace-sdk/src/exposure/workspace-exposure-surface.ts` |
| Denali plugin manifest | `denali-exposure.surface.ts` on `createDenaliWorkspacePlugin()` |
| Starter reference surfaces | `packages/workspaces/starter/src/exposure/` |
| API plugin resolution | `resolve-workspace-exposure-surfaces.ts` (no Denali import in surfaces service) |

Governance: `pnpm run guard:field-exposure-phase-11`

Contract: `apps/api/test/field-exposure-phase-11-platform.contract.spec.ts`

## Roadmap v3.1 closure checklist

| Milestone | Code/doc | Verification |
| --------- | -------- | ------------ |
| M1 | Operator settings, RBAC, validation, Playwright 9.7 | `guard:phase-9` + `test:e2e:exposure` (optional) |
| M2 | Fail-closed, consistency, lifecycle, 8+ integration specs | `pnpm run test:exposure:integration` (Postgres) |
| M3 | Catalog + reminder HTTP redaction, codegen, OpenAPI | `guard:phase-10` |
| M4 | Audit, runbooks, runtime mode doc | `guard:phase-10` |
| M5 | SDK `exposureSurface`, starter + denali manifests | `guard:phase-11` |

Staging rollout (ops): `FIELD_EXPOSURE_CONSISTENCY_GATE_FATAL=true`, `FIELD_EXPOSURE_ENGINE_FAIL_CLOSED=true` — see `docs/dev/runbooks/exposure-flags.mdoc`.

## Enterprise Closure — Milestone M2 (Runtime Safe)

Production Denali requires M1 **plus** runtime guarantees: no silent empty delivery, tenant isolation,
degraded reads with operator visibility, and consistency checks for exposure tables.

### M2 exit criteria

| Criterion | Verification |
| --------- | ------------ |
| Exposure table consistency gate (9.1) | `migration-consistency-check.ts`, `FIELD_EXPOSURE_CONSISTENCY_GATE_FATAL` |
| RLS + connection-scope index (9.3) | `field-exposure-phase-9-3-rls.contract.spec.ts` |
| Connection delete cleans intents (9.5a) | `field-exposure-lifecycle.spec.ts` |
| Legacy scope merge (9.5b) | `field-exposure-legacy-scope.contract.spec.ts` |
| Fail-closed dispatch (9.10) | `field-exposure-dispatch-fail-closed.spec.ts` |
| Degraded read + UI banner (10.2) | `loadWarnings` on integration DTO + web banners |
| Observability + scheduler shutdown (10.1) | `TENANT_SCOPED_METRIC_NAMES`, `main.ts` |
| ≥6 integration specs | `pnpm --filter @apps/api run test:exposure:integration` |

Governance: `pnpm run guard:field-exposure-phase-9`

## Enterprise Closure — Milestone M3 (Denali Product)

All five Denali exposure surfaces must have documented HTTP redaction paths and automated settings
manifest sync.

### M3 exit criteria

| Criterion | Verification |
| --------- | ------------ |
| Catalog HTTP redaction integration | `4-integration/field-exposure-denali-catalog-redaction.spec.ts` |
| Reminder feed HTTP redaction integration | `4-integration/field-exposure-denali-reminder-feed.spec.ts` |
| Catalog bindings audit (10.4) | `denali-catalog-exposure.spec.ts` |
| Location-zones delivery enrich | `enrich-canonical-delivery-payload.spec.ts` |
| Settings module codegen (10.5) | `pnpm run generate:denali-settings-modules --check` |
| OpenAPI dashboard + reminder (10.6) | `dispatch-routes.ts` + `openapi:generate` |

Governance: `pnpm run guard:field-exposure-phase-10` (M3 section)

## Enterprise Closure — Milestone M4 (Enterprise Ops)

### M4 exit criteria

| Criterion | Verification |
| --------- | ------------ |
| Exposure settings audit trail (11.0) | `4-integration/field-exposure-audit.spec.ts` |
| Operator runbooks (11.1) | `docs/dev/runbooks/exposure-*.mdoc` |
| Doc ↔ code aligned (runtime mode) | See **Phase 8 vs runtime authority** below |

Governance: `pnpm run guard:field-exposure-phase-10` (M4 section)

### Phase 8 vs runtime authority (M4 doc alignment)

**Phase 8 complete** means the native exposure resolver, persisted profiles, and audit metadata
contracts are implemented. It does **not** mean every enterprise hardening milestone (M1–M4) is done.

| Flag / concept | Phase 8 / historical | Enterprise M2+ authority |
| -------------- | -------------------- | ------------------------ |
| `FIELD_EXPOSURE_RUNTIME_MODE` | Phase 6 shadow/cutover metadata | **Demoted** — diagnostic only; does not select delivered field ids (Phase 7+) |
| `FIELD_EXPOSURE_SHADOW_DIAGNOSTICS` | Optional shadow attach | Opt-in diagnostics only |
| `FIELD_EXPOSURE_ENGINE_FAIL_CLOSED` | N/A (M2) | Controls enqueue skip on selector failure |
| Forward field selection | `resolveExposureDecision` / engine | Authoritative at dispatch |

## Phase 9 — Runtime safety governance (M2)

Guard: `scripts/guards/field-exposure-phase-9-guard.mjs`  
Contract: `apps/api/test/field-exposure-phase-9-enterprise.contract.spec.ts`

Enforces M2 file inventory, fail-closed wiring, RBAC module gate, integration test pack, and
`test:exposure:integration` script registration.

## Phase 10 — Denali product + enterprise ops governance (M3/M4)

Guard: `scripts/guards/field-exposure-phase-10-guard.mjs`  
Contract: `apps/api/test/field-exposure-phase-10-denali-product.contract.spec.ts`

Enforces Denali HTTP redaction integration specs, catalog binding audit, settings codegen freshness,
OpenAPI inventory, audit integration spec, and operator runbooks.

## Phase 11 — Platform exposure plugin governance (M5)

Guard: `scripts/guards/field-exposure-phase-11-guard.mjs`  
Contract: `apps/api/test/field-exposure-phase-11-platform.contract.spec.ts`  
Plugin contract: `docs/dev/workspace-exposure-plugin-contract.mdoc`

Enforces SDK `WorkspacePlugin.exposureSurface`, Denali + starter manifests, and API surfaces
service resolution without Denali hardcoding.

---

## Purpose

The platform must answer one generic question:

> Given a field, an entity, a publication destination, an audience, and an activation
> context, may this field be exposed, and in what form?

It must **not** answer:

> Which fields should be sent to Telegram / email?

Telegram, Email, Instagram, PDF, Public Website, User Dashboard, Wizard, Review Page,
and Admin Panel are **equal consumers** of a generic **Field Exposure Engine**.
Integrations own transport only.

---

## Boundary Contract

```text
Field Registry
  Owns: field identity, canonical path, kind, presentation metadata
  Does not own: visibility, timing, audience, publication, integration

Field Policy (PDP)
  Owns: entity/workspace state (hidden, visible, required, readonly, redacted)
  Does not own: publication, surface targeting, integration selection, scheduling

Field Exposure Policy
  Owns: may this field appear for surface + audience + trigger?
  Does not own: scheduling, sending, formatting, provider credentials

Exposure Profile
  Owns: reusable default exposure shape per stable product context
  Does not own: provider credentials or transport

Exposure Intent
  Owns: admin override (narrowing, template, mode)
  Does not own: provider credentials; must not be integration-owned long-term

Integration Layer
  Owns: credentials, provider API, retries, delivery logs, formatter adapter
  Does not own: field exposure decisions or field catalogs
```

Field Policy and Field Exposure Policy are **separate**. FieldPolicy is the hard lower
bound on entity state. ExposurePolicy may only further restrict or transform
(`redacted`, `summary_only`, `blocked`); it cannot resurrect a field hidden by
FieldPolicy.

---

## Domain Model (ADR)

### ExposureSurface — where content appears

Valid values (extensible per workspace, not per trigger):

```text
wizard
review_page
public_list
public_details
admin_panel
user_dashboard
telegram
email
instagram
pdf
mobile_app
```

**Invalid as surfaces** (these are triggers, not destinations):

```text
before_tour_24h
payment_completed
registration_completed
```

Timing must never be encoded into `ExposureSurface`.

### Audience — who the field is for

Independent from surface. Every `ExposureContext` must include explicit `audience`.
Surfaces may suggest defaults; defaults must be overridable.

```text
public
registered_user
operator
admin
external_channel
system
```

### ActivationTrigger — when/why evaluation happens

Timing belongs here, not in surface names.

```text
always
tour_created
tour_published
payment_completed
registration_completed
relative_to_tour_start(offset=-24h)
relative_to_tour_start(offset=-48h)
manual
```

Trigger is **evaluation context only**. Job scheduling and event emission belong to
orchestration outside ExposurePolicy.

### FieldExposurePolicy — pure decision layer

Answers: given `surface`, `audience`, `trigger`, and `entityState`, may this field
be exposed?

Decision states:

```text
visible | hidden | redacted | summary_only | blocked
```

Does not send data, schedule jobs, execute integrations, or render templates.

### ExposureProfile — reusable defaults

Named, versioned default shape for a stable product context. Examples:

```text
telegram_tour_created
public_tour_card
public_tour_details
registered_user_24h_reminder
operator_review_panel
```

Profiles define `defaultFieldIds` and optional `defaultTemplateId`. They do not store
provider credentials.

`defaultTemplateId` on a seeded profile mirrors the workspace integration-surface header
seed (for example `Tour published: {{title}}`). It is **not** dispatched as
`integrationDeliveryMessageTemplate`. Only `ExposureIntent.templateOverrideId` becomes a
custom delivery override at runtime. When no override exists, `formatIntegrationDeliveryMessage`
uses the surface header plus automatic field lines from eligible values.

### ExposureIntent — admin override

Replaces `IntegrationDeliveryIntent` as the long-term domain primitive. Scoped by
profile and optional connection/tenant scope.

```text
ExposureIntent
  profileId
  scope                    // optional connectionId, tenantId, etc.
  mode: inherit_profile | override_fields | disabled
  selectedFieldIds?        // when mode = override_fields
  templateOverrideId?
  version
  updatedBy
```

Avoid overloading `enabled + selectedFieldIds: []` with multiple meanings. Use explicit
`mode`.

### ExposureContext — runtime evaluation input

```text
ExposureContext
  workspaceType
  tenantId
  entityType
  entityId
  surface
  audience
  trigger
  actor?
  time
  entityState
```

### ExposureDecision — resolver output per field

```text
ExposureDecision
  fieldId
  state: visible | hidden | redacted | summary_only | blocked
  reasonCode
  source: field_policy | exposure_policy | profile | intent
```

### Naming: Exposure vs Publication

- **Exposure** — generic core (`ExposurePolicy`, `ExposureProfile`, `ExposureIntent`,
  `ExposureResolver`). Wizard, review, admin, and dashboard are exposure surfaces.
- **Publication** — specialization for outward rendered/sent artifacts
  (`PublicationProfile` = outbound exposure profile).

---

## Glossary

Official vocabulary for Phase 1 documentation closure. Terms are **normative**; new docs
and APIs must use these names. See [Forbidden and Transitional Vocabulary](#forbidden-and-transitional-vocabulary).

| Term | Definition |
| --- | --- |
| `ExposureSurface` | Where content may appear (`wizard`, `telegram`, `public_details`, …). Never encodes timing. |
| `Audience` | Who the field is for (`public`, `registered_user`, `external_channel`, …). Independent from surface. |
| `ActivationTrigger` | When/why evaluation runs (`tour_created`, `relative_to_tour_start(-24h)`, …). Context only — not a scheduler. |
| `FieldExposurePolicy` | Pure decision layer: given surface + audience + trigger + entity state, may this field be exposed and in what form? |
| `ExposureProfile` | Named, versioned default exposure shape for a stable product context (`telegram_tour_created`, …). |
| `ExposureIntent` | Admin override scoped by profile + optional connection/tenant scope (`inherit_profile`, `override_fields`, `disabled`). |
| `ExposureContext` | Runtime input bundle: workspace, entity, surface, audience, trigger, actor, time, entity state. |
| `ExposureDecision` | Per-field resolver output: state + `reasonCode` + `source` layer. |
| `ExposureResolver` | Composes registry → FieldPolicy → ExposurePolicy → Profile → Intent into final approved field set. |

---

## Architecture Decision Records (Phase 1)

### ADR-FE-001 — Exposure is the core name; Publication is outbound specialization

**Decision:** Use **Field Exposure System** as the platform core. **Publication** names
outward rendered/sent artifacts only (`PublicationProfile` ⊆ exposure profile for outbound).

**Rationale:** Wizard and admin panel are exposure surfaces, not publications. One engine;
multiple consumer classes.

### ADR-FE-002 — Surface, audience, and trigger are orthogonal

**Decision:** `ExposureSurface`, `Audience`, and `ActivationTrigger` are separate
dimensions. Never encode timing into surface names (`before_tour_24h` is a trigger, not a surface).

**Rationale:** Prevents Telegram-specific surface explosion and enables multi-surface reuse.

### ADR-FE-003 — FieldPolicy is lower bound; ExposurePolicy only restricts further

**Decision:** FieldPolicy resolves entity/workspace state. ExposurePolicy may hide, redact,
or summarize further — never resurrect a field hidden by FieldPolicy.

**Rationale:** Deterministic precedence; no policy conflict resolution at runtime.

### ADR-FE-004 — ExposureIntent replaces IntegrationDeliveryIntent long-term

**Decision:** `IntegrationDeliveryIntent` is transitional. Long-term admin override is
`ExposureIntent` keyed by profile + surface + audience + trigger + scope — not
`connectionId + eventType` alone.

**Rationale:** Integrations supply transport context; they do not own field intent.

### ADR-FE-005 — `surface: "delivery"` in FieldPolicy is not an ExposureSurface

**Decision:** FieldPolicy `delivery` surface is a **legacy eligibility filter** on already
chosen candidates. Target exposure evaluation uses explicit surfaces (`telegram`, `email`, …).

**Rationale:** `delivery` is ambiguous and integration-centric; see
[field-policy-system.md](./field-policy-system.md).

---

## Legacy → Exposure Vocabulary Mapping

Normative mapping from transitional integration vocabulary to exposure domain language.
Phase 2+ adapters must follow this table.

| Legacy (transitional) | Exposure (target) | Notes |
| --- | --- | --- |
| `IntegrationDeliveryIntent` | `ExposureIntent` | `connectionId` → `scope.connectionId`; explicit `mode` replaces `enabled` overload |
| `eventType` (e.g. `TourCreated`) | `ActivationTrigger` (e.g. `tour_created`) | Snake-case trigger ids in exposure layer |
| Provider `telegram` | `ExposureSurface = telegram` + `Audience = external_channel` | Provider is not the policy owner |
| `enabled=false` | `mode = inherit_profile` | Registry/profile defaults apply |
| `enabled=true` + `selectedFieldIds` | `mode = override_fields` + `selectedFieldIds` | `[]` = explicit empty override |
| `templateId` | `templateOverrideId` | Trim/empty normalization preserved |
| `deliveryCandidateFields` | `ExposureProfile.defaultFieldIds` + exposure catalog API | Catalog must not stay on integration meta |
| `exposureCandidateFields` | Same as above | Transitional rename only until Phase 7g |
| Registry tag `deliverable` | `ExposureProfile.defaultFieldIds` (seed) | Tag is migration seed, not policy |
| `buildDeliveryFieldCatalog` | Exposure module catalog builder | Must move out of `integrations/platform` |
| FieldPolicy `surface: "delivery"` | FieldPolicy lower bound + `ExposureSurface`-specific ExposurePolicy | `delivery` ≠ destination |
| Integration `messageTemplates` | Surface header seed on `ExposureProfile.defaultTemplateId`; custom body on `ExposureIntent.templateOverrideId` | Profile seed is not a delivery override; intent template is authoritative when set |
| `IntegrationEventPolicy.enabled` | Routing/activation only | No field selection on event policy |
| `legacy-telegram:` connection prefix | Normal exposure context + connection scope | Remove migration shortcut |

---

## Forbidden and Transitional Vocabulary

### Forbidden in new platform docs and APIs (after Phase 7)

| Term / pattern | Why forbidden | Use instead |
| --- | --- | --- |
| `IntegrationDeliveryIntent` as domain truth | Integration-owned intent | `ExposureIntent` |
| `selectedFieldIds` owned by integrations | Wrong ownership layer | `ExposureIntent.selectedFieldIds` |
| `deliveryCandidateFields` on integration meta | Integration-owned catalog | `exposureCandidateFields` → exposure catalog API |
| `deliverable` tag as runtime policy | Registry tag ≠ policy | `ExposureProfile.defaultFieldIds` |
| `surface: "delivery"` as final surface | Ambiguous destination | `ExposureSurface` (`telegram`, …) |
| Integration-driven field catalogs | Wrong layer | Exposure catalog from profile/registry seed |
| Telegram/email-specific field selection ownership | Provider ≠ policy owner | Exposure context dimensions |

### Transitional (allowed only in allowlist paths until removal phase)

| Term | Allowed until | Removal |
| --- | --- | --- |
| `IntegrationDeliveryIntent` | Phase 7 | Native `ExposureIntent` cutover |
| `deliveryCandidateFields` | Phase 7g | Exposure catalog API |
| `exposureCandidateFields` (integration-seeded) | Phase 7g+ | Native profile persistence |
| FieldPolicy `surface: "delivery"` | Phase 7 | Explicit exposure surfaces |
| Registry `deliverable` tag | Phase 4–7 | `ExposureProfile` persistence |
| `legacy-telegram:` branch | Phase 7 | Normal exposure context |

New features must not introduce additional transitional vocabulary. Enforced by
`guard:field-exposure-phase-0` (allowlist) and `guard:field-exposure-phase-1` (doc language).

---

## Evaluation Pipeline

```text
Field Registry
  -> Field Policy
  -> Field Exposure Policy
  -> Exposure Profile
  -> Exposure Intent
  -> Exposure Resolver
  -> Canonical Enrichment
  -> Template Rendering
  -> Surface Consumer / Integration Provider
```

Integrations supply **context only**, then receive an approved payload:

```text
surface  = telegram
audience = external_channel
trigger  = tour_created
scope    = connectionId
```

Field selection must never start at the integration layer.

### Decision precedence

```text
Field Registry     -> field exists
Field Policy       -> base state; hidden/redacted is hard lower bound
Exposure Policy    -> context-specific decision; may restrict further
Exposure Profile   -> default shape for stable product context
Exposure Intent    -> admin override within policy limits
Resolver output    -> final approved fields + exposure form + template metadata
```

If any layer returns `blocked` or hard `hidden`, downstream layers cannot re-enable
the field.

---

## Enterprise Invariants

1. Field Registry never decides exposure.
2. FieldPolicy never sends, schedules, formats, or owns provider behavior.
3. ExposurePolicy never schedules jobs or calls integrations.
4. ExposureIntent never stores provider credentials.
5. Integration never owns field selection (long-term).
6. Renderer never decides whether a field is allowed; it only renders approved decisions.
7. A hidden FieldPolicy result cannot be made visible by ExposurePolicy or Intent.
8. Every exposure evaluation has explicit `surface`, `audience`, and `trigger`.
9. Timing belongs to `ActivationTrigger`, not `ExposureSurface`.
10. Migration adapters may read legacy integration state; new domain language must not
    be integration-owned.

### Enterprise risks (design guardrails)

| Risk | Guardrail |
|---|---|
| FieldPolicy vs ExposurePolicy conflict | FieldPolicy is lower bound; ExposurePolicy only restricts further |
| Profile explosion | Profiles are stable product surfaces; variants use Intent, not new profiles |
| Audience derived from surface | `audience` explicit in every context |
| Trigger confused with scheduler | Trigger = evaluation context; orchestration emits events |
| `deliverable` tag as policy | Tags seed migration only; defaults live in ExposureProfile |
| Template references disallowed fields | Resolver approves field set before rendering |
| PII leakage via enrichment | Enrichment runs only on approved field ids |
| Cross-workspace drift | Core contracts workspace-neutral; workspaces own profiles/policies |
| Replay/version drift | Profiles and intents versioned; jobs record version used |

---

## Transitional Concepts Inventory

The following exist in the repository today. They are **compatibility adapters**, not
final domain truth. New features must not depend on them as platform primitives.

| Concept | Owner files | Problem | Target | Removal phase |
|---|---|---|---|---|
| `IntegrationDeliveryIntent` | **Removed (Phase 7i).** Table dropped; domain/repo/adapter deleted | Was integration-owned field intent | `ExposureIntent` | **Done (7i)** |
| `selectedFieldIds` (integration-owned) | **Removed (Phase 7i).** Save path is `patchConnectionExposureIntent` → `exposure_intents` | Was valid override, wrong ownership | `ExposureIntent.selectedFieldIds` | **Done (7i)** |
| `deliveryCandidateFields` | **Removed (Phase 7g).** Web parser keeps read-only legacy fallback in `apps/web/src/integrations/integrations-types.ts` | Was integration-meta catalog alias | `exposureCandidateFields` | **Done (7g)** |
| `exposureCandidateFields` (exposure-seeded) | `apps/api/src/integrations/platform/integration-surface-meta.ts`, `apps/web/src/integrations/integrations-types.ts` | Compatibility field for integration screens; settings consumers prefer native catalog API | Native exposure catalog API | **Done (8c/8h)** |
| `buildDeliveryFieldCatalog` | `apps/api/src/exposure/exposure-field-catalog.ts` (owner); `apps/api/src/integrations/platform/build-delivery-field-catalog.ts` (compat re-export) | Integration re-export only | Exposure module catalog | **Permanent compat re-export (8h)** |
| `surface: "delivery"` | **Removed from Denali manifest (Phase 7i).** Starter reference manifest may retain transitional rules | Ambiguous; not a real destination | Explicit `ExposureSurface` (e.g. `telegram`) | Denali **Done (7i)** |
| `deliverable` registry tag | `packages/workspaces/denali/src/field-registry/denaliFieldRegistryData.ts`, `apps/api/src/exposure/exposure-field-catalog.ts` | Migration seed read only inside exposure module; persisted profile rows are created on first use | Native workspace profiles | **Seed-only compatibility (8b)** |
| Integration templates | `packages/workspaces/denali/src/integrations/denali-integration.surface.ts`, `apps/api/src/integrations/platform/format-integration-delivery-message.ts` | Templates scoped to integration surface | Exposure Profile / Intent | Phase 4–7 |
| `integration_event_policies` field columns | **Removed (Phase 7e).** `apps/api/prisma/migrations/20260629120000_remove_integration_event_policy_delivery_columns/` | Was pre-intent residual | Routing-only `enabled` | **Done (7e)** |
| Integration delivery policy UI | `apps/web/app/(app)/settings/integrations/integration-event-delivery-policy-panel.tsx` | Embeds exposure component; save via native `patchExposureIntent` | Standalone exposure settings page | Panel retained; **standalone page Done (7h)** |
| `legacy-telegram:` routing branch | `resolve-legacy-telegram-connection.ts` (`syntheticLegacyConnection` flag) | Migration-era synthetic connection | Normal exposure context | Synthetic flag only; no `legacy-telegram:` string branch in engine |
| Exposure migration adapters | **Removed (Phase 7i):** `integration-delivery-intent-adapter.ts`, `integration-delivery-intent-write-bridge.ts` | Bridge legacy → native | Real `ExposureResolver` | **Done (8d)** |
| `exposure_intents` dual storage | `apps/api/prisma/schema.prisma` (`exposure_intents`) | **Single authoritative store (Phase 7i)** | Single `ExposureIntent` truth | **Done (7i)** |
| `ExposureProfile` seed wrapper | `apps/api/src/exposure/exposure-profile.ts`, `apps/api/src/exposure/resolve-persisted-exposure-profile.ts` | Seed object becomes persisted `exposure_profiles` row on first use | Persisted `ExposureProfile` | **Done (8b)** |
| `FIELD_EXPOSURE_RUNTIME_MODE` | `apps/api/src/exposure/exposure-runtime-mode.ts`, `apps/api/src/integrations/application/dispatch-integration-domain-event.ts` | Historical Phase 6 metadata flag; dispatch selection no longer branches on legacy fallback | Native resolver authoritative (no fallback) | **Demoted (8e)** |
| `ExposureFieldChecklist` (embedded) | `apps/web/src/exposure/ExposureFieldChecklist.tsx`, `apps/web/app/(app)/settings/exposure/` | Generic props-only UI; native save via `patchExposureIntent` | Exposure settings page | **Done (7h)** |
| `deliveryCandidateFieldIds` manifest drift | `packages/workspace-sdk/src/registry/guard-legacy-delivery-candidate-field-ids.ts` | Legacy manifest field-id list | Registry tags + `ExposureProfile` | Phase 7 |

### Transitional code allowlist

During migration Phases 2–7, integration-owned field selection may only appear under these
repo paths. `guard:field-exposure-phase-0` enforces this list for **new** staged files.

```text
apps/api/src/integrations/
apps/api/src/exposure/
apps/web/app/(app)/settings/integrations/
apps/web/app/(app)/settings/exposure/
apps/web/app/api/integrations/
apps/web/src/integrations/
apps/web/src/exposure/
packages/workspaces/denali/src/integrations/
packages/workspaces/denali/src/field-registry/
packages/platform-core/src/field-policy/
docs/
scripts/guards/
```

---

## Phase 0 — Freeze and Inventory

Phase 0 goal: freeze domain language and inventory transitional concepts. **No runtime
behavior change.**

### Completion checklist

- [x] Official architecture document (`docs/architecture/field-exposure-system.md`)
- [x] Domain language frozen (`ExposureSurface`, `Audience`, `ActivationTrigger`,
  `FieldExposurePolicy`, `ExposureProfile`, `ExposureIntent`, `ExposureContext`,
  `ExposureDecision`)
- [x] Boundary contract documented (Registry, FieldPolicy, ExposurePolicy, Profile,
  Intent, Integration)
- [x] Enterprise invariants and risk guardrails documented
- [x] Transitional concepts inventory with removal phase per concept
- [x] Denali/Telegram compatibility criteria documented
- [x] Migration phases 0–8 table and per-phase rules
- [x] Forbidden core concepts (final state) and success criteria
- [x] FieldPolicy vs ExposurePolicy boundaries in
  [field-policy-system.md](./field-policy-system.md)
- [x] Integration plugin freeze notice in
  [workspace-integration-plugin-system.mdoc](../dev/workspace-integration-plugin-system.mdoc)
- [x] Phase 0 governance guard (`pnpm run guard:field-exposure-phase-0`)
- [x] Transitional inventory owner paths verified on disk by guard
- [x] Transitional code allowlist documented and enforced by guard
- [x] Guard wired into `pre-commit:fast`
- [x] Architecture index (`docs/architecture/README.md`)

### Phase 0 exit criteria

- Architecture terms frozen in this document.
- Transitional concepts listed with removal phase **and** resolvable owner file paths.
- FieldPolicy vs ExposurePolicy boundaries explicit in
  [field-policy-system.md](./field-policy-system.md).
- **Governance:** new features must not introduce integration-owned field selection
  outside the transitional allowlist enforced by `guard:field-exposure-phase-0`.

### Phase 1 exit criteria (documentation only)

- Exposure domain vocabulary cross-linked from Field Policy and Integration plugin docs.
- Phase 1 is documentation closure only; later migration phases (2+) are tracked in the
  table below and do not block Phase 0 freeze artifacts.

---

## Phase 1 — Domain Language Closure

Phase 1 goal: freeze **exposure domain language in documentation**. **No runtime behavior
change.** Phase 1 may touch only `docs/`, `scripts/guards/`, and exposure contract tests.

**Staged-scope ratchet (retired):** After Phase 1 documentation closure, `guard:field-exposure-phase-1`
no longer rejects staged runtime `.ts`/`.tsx` outside docs/guards/contracts. That check caused
false failures on ordinary product PRs that stage `apps/web` while API exposure contract tests
still invoke the guard. The live Phase 1 contract is glossary + ADR + sibling-doc mirrors only.

### Completion checklist

- [x] Official glossary (`ExposureSurface`, `Audience`, `ActivationTrigger`, …)
- [x] Architecture Decision Records (ADR-FE-001 … ADR-FE-005)
- [x] Legacy → exposure vocabulary mapping table
- [x] Forbidden and transitional vocabulary rules
- [x] FieldPolicy vs ExposurePolicy terminology aligned in
  [field-policy-system.md](./field-policy-system.md)
- [x] Integration plugin vocabulary mirror in
  [workspace-integration-plugin-system.mdoc](../dev/workspace-integration-plugin-system.mdoc)
- [x] Phase 1 governance guard (`pnpm run guard:field-exposure-phase-1`)
- [x] Phase 1 contract test (`field-exposure-phase-1-language.contract.spec.ts`)
- [x] Architecture index updated for Phase 1 closure

### Phase 1 exit criteria (testable)

- Glossary section exists with all nine core terms defined.
- At least five ADR decisions recorded (ADR-FE-001 … ADR-FE-005).
- Legacy mapping table covers all transitional concepts in inventory.
- Forbidden vocabulary table exists with normative replacements.
- `guard:field-exposure-phase-1` passes.
- Sibling docs reference Phase 1 guard and mirror forbidden vocabulary rules.

Verification: `pnpm run guard:field-exposure-phase-1`

---

## Phase 2 — Read-Path Adapter Closure

Phase 2 goal: expose legacy `IntegrationDeliveryIntent` rows as an `ExposureIntent`
**read-path view** beside dispatch. **No dispatch behavior change** in default shadow mode.

### Adapter contract (normative)

| Legacy | Exposure view |
| --- | --- |
| `connectionId` | `scope.connectionId` + profile context |
| `eventType` | `trigger` (domain event id; e.g. `TourCreated` until snake-case migration) |
| provider (`telegram`) | `surface = telegram`, `audience = external_channel` |
| `enabled=false` | `mode = inherit_profile`; selected ids not interpreted as override |
| `enabled=true` + `selectedFieldIds` | `mode = override_fields`; preserves `[]` |
| `templateId` | `templateOverrideId` (trim/empty normalization) |
| row metadata | `source = integration_delivery_intent_adapter` |

Shared mapper: `apps/api/src/exposure/legacy-delivery-exposure-mapper.ts` (read + write paths).

### Completion checklist

- [x] `adaptIntegrationDeliveryIntentToExposureIntent` with full exposure dimensions
- [x] Provider passed from policy engine into adapter
- [x] Shared legacy → exposure profile mapper (read + write bridge)
- [x] `exposureIntent` attached on `IntegrationPolicyDecision` (read path only)
- [x] Dispatch shadow mode keeps `deliveryIntent` authoritative for field/template selection
- [x] Unit tests for adapter mapping edge cases
- [x] Phase 2 governance guard (`pnpm run guard:field-exposure-phase-2`)
- [x] Phase 2 contract test (`field-exposure-phase-2-adapter.contract.spec.ts`)
- [x] Dispatch shadow-mode invariant test (legacy intent authoritative over adapted `exposureIntent`)
- [x] Guard verifies dispatch does not route field selection through `exposureIntent`

### Phase 2 exit criteria (testable)

- Adapter populates `profileId`, `surface`, `audience`, `trigger`, `entityType`, `scope`, `mode`, `source`.
- Policy engine exposes `exposureIntent` without replacing `deliveryIntent`.
- Default dispatch path does not use `exposureIntent` for candidate/eligible field ids (tested in `dispatch-integration-domain-event.spec.ts`).
- `guard:field-exposure-phase-2` passes.

Verification: `pnpm run guard:field-exposure-phase-2`

**Note:** The Phase 7b write bridge, 7c native read, and 7d cutover were subsequently
delivered (see Phase 6 dual-write/cutover and the Phase 7 subphase status table); they did
not block Phase 2 adapter closure.

---

## Phase 3 — Shadow Resolver Closure

Phase 3 goal: attach **log-only** exposure shadow metadata beside legacy dispatch output.
**No worker/provider behavior change.** Authoritative fields remain
`integrationDelivery*` on the job payload.

### Shadow parity dimensions

| Dimension | Shadow field | Rule |
| --- | --- | --- |
| Candidate field ids | `candidateFieldIds` | Mirror `deliveryPolicy.candidateFieldIds` |
| Eligible field ids | `exposedFieldIds` | Mirror `deliveryPolicy.eligibleFieldIds` |
| Enriched values | `fieldValues` | Mirror `deliveryPolicy.eligibleFieldIds` enrichment |
| Delivery field parity | `deliveryParity` | Shadow fields must match authoritative `integrationDelivery*` inputs |
| Rendered template | `renderedMessage` | `formatIntegrationDeliveryMessage` on mirrored delivery payload |
| Rendered parity | `renderedParity` | Shadow render must match authoritative delivery render |
| Aggregate parity | `parity` | `deliveryParity` ∧ `renderedParity` ∧ optional `intentParity` |
| Native intent (7c) | `intentParity` | Optional audit metadata only |

### Completion checklist

- [x] `resolveShadowExposureFromDelivery` mirrors delivery policy + enrichment
- [x] `fieldExposureShadow` attached on dispatch job payload (metadata only)
- [x] `renderedMessage` + `renderedParity` on shadow decision
- [x] `deliveryParity` compares shadow fields to authoritative delivery inputs
- [x] `parity` aggregate gates mismatch observability
- [x] Mismatch metric `field_exposure_shadow_parity_mismatch_total` on dispatch
- [x] Dispatch test records mismatch metric when aggregate parity fails
- [x] Workers/providers/formatters read `integrationDelivery*` only (not shadow)
- [x] Formatter test proves `fieldExposureShadow` is ignored at render time
- [x] Dispatch test proves shadow mirrors delivery fields
- [x] Dispatch test proves shadow `renderedMessage` matches worker formatter path
- [x] Phase 3 governance guard (`pnpm run guard:field-exposure-phase-3`)
- [x] Phase 3 contract test (`field-exposure-phase-3-shadow.contract.spec.ts`)

### Phase 3 exit criteria (testable)

- Shadow metadata derived from the same delivery policy and enrichment as authoritative fields.
- `deliveryParity` and `renderedParity` recorded on every shadow decision; `parity` aggregates mismatches.
- `renderedMessage` recorded using the same formatter the worker invokes.
- Dispatch records `field_exposure_shadow_parity_mismatch_total` when aggregate parity fails.
- `fieldExposureShadow` is not consumed by worker/provider formatters.
- `guard:field-exposure-phase-3` passes.

Verification: `pnpm run guard:field-exposure-phase-3`

**Note:** A full independent `ExposureResolver` dual-path compare is Phase 3+ / Phase 8
hardening — this phase closes **legacy-mirror shadow** with rendered output parity.

---

## Phase 4 — Exposure Profile Default Source Closure

Phase 4 goal: route **default field ids** and **selectable catalog** through the exposure
module and an `ExposureProfile` view. Registry `deliverable` tags remain the migration seed;
they must not be read directly by dispatch, integration meta, or policy callers.

### Read boundary

```text
WorkspaceFieldRegistry (deliverable tag)
  -> apps/api/src/exposure/exposure-field-catalog.ts
  -> resolveRegistrySeededExposureProfile(...)
  -> defaultFieldIds on ExposureProfile
  -> dispatch / policy / integration meta (compat re-exports only)
```

Integration `build-delivery-field-catalog.ts` is a **compatibility re-export** only. New
callers must import from `apps/api/src/exposure/`.

### Completion checklist

- [x] `exposure-field-catalog.ts` owns registry catalog + deliverable filter
- [x] `resolveRegistrySeededExposureProfile` seeds defaults through `ExposureProfile`
- [x] `defaultTemplateId` optional on seeded profile (integration surface template seed)
- [x] Denali `denali.telegram.TourCreated` defaults match legacy deliverable ids
- [x] `getDefaultDeliveryFields` / integration meta delegate to exposure module
- [x] `delivery-field-definitions.ts` exposes definitions-only adapters (`resolveDeliveryFieldDefinitions`,
  `buildDeliveryFieldPolicyEntityState`); the historical `resolveDeliveryFieldPolicy()` selector and
  `resolve-delivery-field-policy.ts` module name are retired.
- [x] Delivery pipeline passes `eventType` into profile context (surface `telegram`)
- [x] `legacy-delivery-exposure-mapper` seeds full `defaultFieldIds` on profile view
- [x] `integration-policy-engine` resolves seeded profile via exposure resolver + delivery context
- [x] `integrations.service` validates admin field ids against exposure selectable catalog
- [x] Guard blocks direct `deliverable` reads outside `apps/api/src/exposure/`
- [x] Denali `telegram_tour_created` profile parity test (`field-exposure-phase-4-denali-profile-parity.spec.ts`)
- [x] `deliverable` not removed (migration seed only)
- [x] Phase 4 governance guard (`pnpm run guard:field-exposure-phase-4`)
- [x] Phase 4 contract test (`field-exposure-phase-4-profile.contract.spec.ts`)

### Phase 4 exit criteria (testable)

- Default field ids resolve via `ExposureProfile`, not direct `deliverable` reads outside
  `apps/api/src/exposure/`.
- `delivery-field-definitions.ts` exposes definitions-only adapters for enrichment; runtime dispatch no longer
  calls `resolveDeliveryFieldPolicy()` as selector authority.
- `legacy-delivery-exposure-mapper` and `integration-policy-engine` resolve profiles through
  `resolveRegistrySeededExposureProfile` (not raw deliverable lists).
- Integration surface meta `exposureCandidateFields` sourced from exposure catalog builder.
- Seeded profile annotated `registry_deliverable_migration_seed`.
- `guard:field-exposure-phase-4` passes.

Verification: `pnpm run guard:field-exposure-phase-4`

Targeted tests (phase 4 slice):

```bash
cd apps/api && node --import tsx --test \
  test/field-exposure-phase-4-profile.contract.spec.ts \
  test/field-exposure-phase-4-denali-profile-parity.spec.ts \
  src/exposure/exposure-field-catalog.spec.ts \
  src/exposure/exposure-profile.spec.ts \
  src/exposure/resolve-registry-seeded-exposure-profile.spec.ts \
  src/exposure/legacy-delivery-exposure-mapper.spec.ts \
  src/integrations/application/delivery-field-definitions.spec.ts \
  src/integrations/platform/build-delivery-field-catalog.spec.ts
```

**Note:** Persisted `exposure_profiles` table and workspace-owned native profiles are Phase 8
hardening — Phase 4 closes the **read boundary** and in-memory seed profile view.

---

## Phase 5 — Generic Exposure UI

Phase 5 goal: make field selection a **reusable exposure capability**, not an integration
feature. The checklist component and its selection logic must be integration-agnostic;
integration settings may only **embed** it through props. **No persistence-shape change** —
saving remains integration-owned (`patchIntegrationDeliveryIntent`); Phase 6 mirrors writes
into native `exposure_intents` without changing the admin API shape.

### Ownership boundary (normative)

```text
apps/web/src/exposure/exposure-field-selection.ts   (pure selection logic — no React, no API)
apps/web/src/exposure/ExposureFieldChecklist.tsx     (generic component — props only)
  -> embedded by
apps/web/app/(app)/settings/integrations/integration-event-delivery-policy-panel.tsx
     (passes surface=<provider>, audience=external_channel, trigger=<eventType>,
      fields + selectedFieldIds + onToggle through props; owns save only)
```

### Exposure context derivation

- `surface` is derived from the connection **provider** (e.g. `telegram`), never hardcoded in
  the generic component.
- `audience` defaults to `external_channel` for outbound channel delivery.
- `trigger` is the domain event type for the row.
- The reusable component must not import `@/integrations`, call integration APIs, read
  provider credentials, or decide persistence shape.

### Inherit vs override

- Default mode is **inherit** — the effective selection is the full exposure catalog
  (profile-seeded defaults), and no override is stored.
- The panel exposes an explicit **customize** toggle (`customizeFieldsLabel`). Turning it off
  returns to inherit (no stored `selectedFieldIds`); turning it on seeds the override from the
  current effective selection.
- Toggling any field implies override mode.

### Completion checklist

- [x] Reusable `ExposureFieldChecklist` lives in `apps/web/src/exposure/` (props-only)
- [x] Generic component does not import `@/integrations` or call `patchIntegration*`
- [x] Pure selection logic extracted to `apps/web/src/exposure/exposure-field-selection.ts`
- [x] `surface` derived from connection provider (not hardcoded `"telegram"`)
- [x] `audience` / `trigger` resolved via `resolveExposureChecklistContext`
- [x] Explicit inherit/override (`customize`) toggle wired with `customizeFieldsLabel`
- [x] Panel routes selection through pure logic (`toggleExposureFieldSelection`, …)
- [x] Panel maps catalog through `toExposureChecklistFields` (`ExposureCatalogField` boundary)
- [x] Persisted intent hydration via `resolveExposureFieldSelectionFromPersisted`
- [x] Catalog sourced from `exposureCandidateFields` (not `deliveryCandidateFields`)
- [x] Behavioral DOM test for the checklist (`exposure-field-checklist.spec.tsx`)
- [x] Pure logic unit tests (`exposure-field-selection.spec.ts`)
- [x] Phase 5 governance guard (`pnpm run guard:field-exposure-phase-5`)
- [x] Phase 5 contract test (`field-exposure-phase-5-ui.contract.spec.ts`)
- [x] Guard wired into `pre-commit:fast` and architecture index

### Phase 5 exit criteria (testable)

- The generic component imports no integration module and no patch client.
- The panel derives `surface` from the provider and embeds the component through props only.
- Inherit returns the full catalog; override stores an explicit subset; round-trips proven by
  `exposure-field-selection.spec.ts`.
- `guard:field-exposure-phase-5` passes.

Verification: `pnpm run guard:field-exposure-phase-5`

Targeted tests (phase 5 slice):

```bash
cd apps/web && pnpm exec node --import tsx --import ./test/register-dom.mjs --test \
  test/field-exposure-phase-5-ui.contract.spec.ts \
  test/exposure-field-selection.spec.ts \
  test/exposure-field-checklist.spec.tsx
```

**Note:** A standalone exposure settings page and exposure-native save API are Phase 5–7h /
Phase 7; Phase 5 moves **UI ownership** of selection only. Integration-owned save persistence
remains a documented exception until cutover.

---

## Phase 6 — Dual-Write + Controlled Cutover

Phase 6 goal: introduce **native `ExposureIntent` dual-write** on admin saves and a
**feature-flagged controlled cutover** where native intents may drive field/template
selection. Routing, provider selection, credentials, retries, and event enablement remain
integration-owned. Worker/provider formatting is unchanged.

### Runtime mode contract (historical Phase 6; superseded by Phases 7-12)

```text
FIELD_EXPOSURE_RUNTIME_MODE=shadow  (default)
  -> historical metadata label only; selector authority is engine-owned in all modes

FIELD_EXPOSURE_RUNTIME_MODE=cutover
  -> historical metadata label only; native intent/profile defaults still drive engine decisions
  -> missing native row uses profile defaults and records nativeIntentMissing=true
```

### Dual-write contract

- Admin saves through `PATCH /integrations/:id/delivery-intents/:eventType` continue to write
  `integration_delivery_intents` (authoritative) and additionally mirror into native
  `exposure_intents` through `mapIntegrationDeliveryIntentWriteToExposureIntent`.
- The mirror is one-way (legacy → native); it must not add provider credentials, formatting,
  or template rendering to the exposure layer.

### Decision-source audit (normative)

Every emitted job payload records `fieldExposureRuntime`:

| Field | Meaning |
| --- | --- |
| `mode` | `shadow` or `cutover` (resolved `FIELD_EXPOSURE_RUNTIME_MODE`) |
| `source` | `exposure_resolver` |
| `selectionSource` | `native_exposure_intent` or `exposure_profile_defaults` |
| `nativeIntentMissing` | `true` when no native row was active and profile defaults drove the decision |

### Operational gate

- `cutover` may only be enabled in an environment after shadow parity is green for the
  relevant surfaces (see `field_exposure_shadow_parity_mismatch_total`). Parity remains
  observable on every job via `fieldExposureShadow.parity`.

### Completion checklist

- [x] `FIELD_EXPOSURE_RUNTIME_MODE` resolver defaults to `shadow`
- [x] Admin save dual-writes native `exposure_intents` (legacy authoritative)
- [x] Cutover mode selects native intent fields/template when a native row exists
- [x] Missing native row in cutover uses profile defaults (historically described as fallback)
- [x] Fallback is recorded (`nativeIntentMissing=true`), never silent
- [x] Every job records `selectionSource` (legacy vs native) for audit
- [x] Shadow mode records diagnostic runtime metadata only; Phase 7 makes engine selection authoritative
- [x] Workers/providers/formatters read `integrationDelivery*` only (unchanged)
- [x] Runtime metadata unit tests (`exposure-runtime-mode.spec.ts`)
- [x] Dispatch cutover + fallback behavioral tests (`dispatch-integration-domain-event.spec.ts`)
- [x] Phase 6 governance guard (`pnpm run guard:field-exposure-phase-6`)
- [x] Phase 6 contract test (`field-exposure-phase-6-cutover.contract.spec.ts`)
- [x] Guard wired into `pre-commit:fast` and architecture index
- [x] Runtime selection observability (`field_exposure_runtime_selection_total`) with cutover
  compatibility metric (`field_exposure_cutover_selection_total`)
- [x] Workers/formatters ignore `fieldExposureRuntime` (Phase 3 boundary preserved)
- [x] Jobs with `deliveryPolicy === null` still record `fieldExposureRuntime`

### Phase 6 exit criteria (testable)

- Shadow mode: dispatch records profile-default selection metadata when no native row exists.
- Cutover mode with a native row: dispatch uses native selection; `selectionSource` is
  `native_exposure_intent`.
- Cutover mode without a native row: dispatch uses profile defaults and records
  `nativeIntentMissing=true` (Phase 12 extends this to all modes).
- Every job with an exposure decision increments `field_exposure_runtime_selection_total`;
  cutover jobs also increment `field_exposure_cutover_selection_total` for compatibility.
- `guard:field-exposure-phase-6` passes.

Verification: `pnpm run guard:field-exposure-phase-6`

Targeted tests (phase 6 slice):

```bash
cd apps/api && node --import tsx --test \
  test/field-exposure-phase-6-cutover.contract.spec.ts \
  src/exposure/exposure-runtime-mode.spec.ts \
  src/integrations/application/dispatch-integration-domain-event.spec.ts
```

**Note:** Deleting `IntegrationDeliveryIntent`, `deliveryCandidateFields`, and
`surface: "delivery"` is Phase 7; native-resolver-authoritative cutover (no legacy fallback)
and audit/versioning hardening are Phase 7d+/Phase 8.

---

## Phase 7 — Remove Integration-Owned Selection

Phase 7 goal: **retire integration-owned field selection** so the platform asks exposure
questions only. Phase 7 is split into subphases; several infrastructure subphases were
delivered early (in Phase 6 dual-write/cutover and in storage migrations), so this section
records the **authoritative status of each subphase** and separates *closed* work from
*destructive retirement* that must run behind a database migration + Full Integrity gate.

### Subphase status (authoritative)

| Sub | Scope | Status | Evidence |
| --- | --- | --- | --- |
| 7a | Native `exposure_intents` storage + RLS + repo | **Done** | `prisma/migrations/20260629100000_field_exposure_intents`, `prisma-exposure-intent.repository.ts` |
| 7b | One-way write bridge legacy → native | **Done** | `integration-delivery-intent-write-bridge.ts`, `integrations.service.ts` upsert |
| 7c | Backfill + native-read shadow parity | **Done** | `prisma/migrations/20260629110000_backfill_exposure_intents_from_integration_delivery`, policy-engine native read |
| 7d | Controlled native-intent cutover (with legacy fallback) | **Done** | `FIELD_EXPOSURE_RUNTIME_MODE=cutover`, `selectionSource`, `nativeIntentMissing` (Phase 6) |
| 7e | `integration_event_policies` routing-only | **Done (closed here)** | `20260629120000_remove_integration_event_policy_delivery_columns`, `integration-policy-routing-only.spec.ts` |
| 7f | Exposure-owned catalog source | **Done (closed here)** | `integration-surface-meta.ts` serves `exposureCandidateFields` from exposure module |
| 7g | Drop `deliveryCandidateFields` response alias | **Done (closed here)** | alias removed from API response + web meta type |
| 7h | Standalone exposure settings page + native save API | **Done** | `settings/exposure`, `PATCH .../exposure-intents/:eventType` |
| 7i | Delete `integration_delivery_intents`; single `ExposureIntent` truth; remove adapter + `surface:"delivery"` (Denali) | **Done** | migration `20260630100000`, native-only policy engine + dispatch |

### Closed in Phase 7 (7h + 7i — destructive retirement)

- `integration_delivery_intents` table dropped; `IntegrationDeliveryIntent` domain/repo/adapter
  deleted.
- Native `ExposureIntent` is the **single** field-selection source in policy engine and dispatch.
- Admin save path is `PATCH /integrations/:id/exposure-intents/:eventType` (writes
  `exposure_intents` via `patchConnectionExposureIntent`).
- Connection DTO exposes `exposureIntents` (web parser keeps read-only `deliveryIntents` fallback).
- Standalone `settings/exposure` page embeds the exposure checklist with native save.
- Denali FieldPolicy rules use `surface: "telegram"` (not `"delivery"`).
- Shadow resolver no longer compares legacy vs native intent parity.

### Completion checklist (Phase 7 full closure)

- [x] `IntegrationEventPolicy` Prisma model carries no field/template columns (7e)
- [x] Surface-meta catalog sourced from exposure module (7f)
- [x] `deliveryCandidateFields` removed from API response + web type (7g)
- [x] Standalone `settings/exposure` page with native `patchExposureIntent` save (7h)
- [x] `integration_delivery_intents` dropped; native-only selection path (7i)
- [x] `integration-delivery-intent-adapter` and write-bridge deleted (7i)
- [x] `PATCH .../exposure-intents/:eventType` wired API + web proxy (7h)
- [x] Phase 7 governance guard (`pnpm run guard:field-exposure-phase-7`)
- [x] Phase 7 retirement contract test (`field-exposure-phase-7-retirement.contract.spec.ts`)
- [x] Guard wired into `pre-commit:fast` and architecture index

### Phase 7 exit criteria (testable)

- Event policy is routing-only; integration surface-meta is exposure-owned.
- No `integration_delivery_intents` table; no delivery-intents HTTP route.
- Native exposure intent drives field selection; `selectionSource` is
  `native_exposure_intent` or `exposure_profile_defaults`.
- Standalone exposure settings page exists at `/settings/exposure`.
- `guard:field-exposure-phase-7` passes.

Verification: `pnpm run guard:field-exposure-phase-7`

```bash
cd apps/api && node --import tsx --test \
  test/field-exposure-phase-7-retirement.contract.spec.ts \
  src/integrations/infrastructure/integration-policy-routing-only.spec.ts \
  src/integrations/platform/integration-surface-meta.spec.ts
```

---

## Denali and Telegram Compatibility Criteria

Under default **shadow** mode (and during **controlled cutover** when parity is monitored),
the following must hold when adapters or shadow resolver run:

### Settings and API

- Saved field exposure settings are readable and writable through
  `PATCH /integrations/:id/exposure-intents/:eventType` and event-policy routing endpoints.
- Connection DTO exposes `exposureIntents`; web parser accepts legacy `deliveryIntents` key
  as a read-only fallback for older API payloads.
- Unknown field ids rejected at save time against current selectable catalog.

### Runtime output (Telegram)

- For `TourCreated` on Denali with default intent (`enabled=false`): eligible field set
  matches current registry `deliverable` defaults filtered by FieldPolicy `delivery` surface.
- For explicit admin override (`enabled=true` + `selectedFieldIds`): dispatch uses
  override ids intersected with eligibility (same as today).
- **`selectedFieldIds` array order is the delivery order** when no custom template is set.
  The Telegram exposure panel uses a single message-template textarea as the operator
  canvas: ticking a field appends or removes `label: {{field:<id>}}` lines. Reorder fields
  by moving lines in the textarea. Legacy `fieldDecorations` prefixes migrate into inline
  template text on load; new saves clear stored decorations.
- When no admin `templateOverrideId` / `integrationDeliveryMessageTemplate` is set, runtime
  builds the automatic multi-line body from ordered eligible field values. Profile
  `defaultTemplateId` does **not** count as an override — it only seeds profile metadata;
  the worker header comes from the workspace integration surface template. Custom intent
  templates remain authoritative — placeholder order in the template wins over
  `selectedFieldIds` order.
- **Catalog reference enrichment** — reference ids in the frozen `deliverySnapshot` (for
  example `destinationId`) resolve to tenant catalog display names at dispatch time when
  companion paths are absent. Datetime fields (`kind: date`) format to operator-readable
  `fa-IR` strings (Asia/Tehran) instead of raw ISO.
- **Telegram field decorations** (`fieldDecorations` on native `ExposureIntent`) are
  legacy-only. The web canvas migrates prefixes into the template on load and always PATCHes
  `fieldDecorations: null` on save. Runtime still honors stored decorations for automatic lists
  until rows are re-saved.

### Denali location-zones delivery field (composite, not split)

The Denali wizard stores trip locations (`startPoint`, `summitPoint`, `campPoint`, `endPoint`)
as a single **composite** widget anchored on `startPoint` (registry id `denali.location-zones`).
`summitPoint`/`campPoint`/`endPoint` are composite *dependents* / ghost paths and are **not**
standalone registry fields, so they cannot be exposed individually without restructuring the
wizard. To make the location data deliverable without that high-risk surgery:

- `denali.location-zones` (canonicalPath `startPoint`) carries the `deliverable` tag so it is
  **selectable** in the Telegram delivery picker, and a `delivery`-surface `visible` rule so the
  exposure engine does not hide it when selected. It is **not** added to the default deliverable
  set, so it stays opt-in per intent.
- Delivery enrichment renders `locationData` objects (`{ label, address, latitude, longitude }`)
  to text using `label`, falling back to `address`. For `denali.location-zones`, enrichment
  aggregates the available zone labels (start → summit → camp → end) into one comma-joined value,
  so the single selectable field surfaces every populated zone. Empty zones are skipped.
- This is rendering metadata only; it does not change wizard storage, the rule model, or the
  per-surface eligibility of any other field.
- `formatIntegrationDeliveryMessage` custom-template output unchanged (placeholder redaction
  behavior preserved).
- Empty explicit `selectedFieldIds` continues to mean "deliver no fields" for that event.

### Adapter mapping (Phase 2 target)

```text
IntegrationDeliveryIntent.connectionId -> ExposureIntent.scope.connectionId
eventType                              -> trigger (domain event id; e.g. TourCreated)
provider telegram                      -> surface = telegram, audience = external_channel
enabled=false                          -> mode = inherit_profile
enabled=true + selectedFieldIds        -> mode = override_fields
templateId                             -> templateOverrideId
```

Phase 2 is a **read-path adapter only**. It may expose an `ExposureIntent` view beside
the current `IntegrationDeliveryIntent`, but dispatch must keep using the existing
`deliveryIntent` until the Phase 3 shadow resolver proves output equivalence.

Adapter contract:

- `IntegrationDeliveryIntent === null` maps to `null` (no persisted override).
- `enabled === false` maps to `mode = inherit_profile`; selected field ids are not
  interpreted as an override.
- `enabled === true` maps to `mode = override_fields` and preserves `selectedFieldIds`
  exactly, including `[]` as an explicit empty override.
- `templateId` maps to `templateOverrideId` after the same trim/empty normalization used
  by current delivery intent helpers.
- `connectionId`, `workspaceType`, and `eventType` are preserved in `scope` so Denali and
  Telegram compatibility remains provable.
- The adapter must annotate its source as `integration_delivery_intent_adapter` so later
  shadow runs can distinguish legacy-backed decisions from native ExposureIntent rows.

### Shadow resolver (Phase 3)

Compare without changing outbound behavior:

- candidate field ids
- eligible field ids
- enriched field values
- rendered template output

Mismatch must be documented or fixed before cutover.

Phase 3 implementation rule:

- Current dispatch fields remain authoritative:
  `integrationDeliveryCandidateFieldIds`, `integrationDeliveryFieldIds`,
  `integrationDeliveryFieldValues`, and `integrationDeliveryMessageTemplate`.
- Shadow exposure data may be attached as metadata only (for example
  `fieldExposureShadow`) and must not be consumed by workers/providers during Phase 3.
- The shadow metadata must be derived from the same resolved delivery policy and enrichment
  result so tests can prove parity before a real resolver owns the path.
- Provider formatters must continue to read the existing integration delivery fields until
  the Phase 6 feature-flagged cutover.

---

## Migration Phases

| Phase | Goal | Doc deliverables | Behavior change |
|---|---|---|---|
| 0 | Freeze and inventory | Architecture doc, transitional inventory, allowlist, Phase 0 guard | None |
| 1 | Exposure domain language in docs | Glossary, ADRs, legacy mapping, forbidden vocabulary, Phase 1 guard | None |
| 2 | Adapter: IntegrationDeliveryIntent → ExposureIntent | Adapter contract in this doc | Read-path adapter only |
| 3 | Shadow Exposure Resolver | Shadow parity rules in this doc | Log-only comparison |
| 4 | Exposure Profiles as default source | Profile seed rules in this doc | Defaults from profiles |
| 5 | Generic Exposure UI | UI ownership rules in this doc | UI ownership moves |
| 6 | Dual write / controlled cutover | Cutover flag contract in this doc | Feature-flagged |
| 7 | Remove integration-owned selection | Forbidden concepts retirement | Retire transitional models |
| 8 | Enterprise hardening | Audit/versioning requirements | Audit, versioning, observability |

## Phase 8 — Enterprise Hardening

Phase 8 converts the Phase 7 native exposure store into an enterprise-grade exposure
decision system. It is deliberately split into testable subphases so the system does not
replace one transitional path with another opaque path.

### Subphase status (authoritative)

| Sub | Scope | Status | Evidence |
| --- | --- | --- | --- |
| 8a | Governance, stale-doc cleanup, Phase 8 guard/contract | **Complete** | `guard:field-exposure-phase-8`, contract spec |
| 8b | Persisted `exposure_profiles` + profile version snapshots | **Complete** | `PrismaExposureProfileRepository`, `resolvePersistedExposureProfileForContext` |
| 8c | Native exposure catalog API outside integration meta | **Complete** | `/workspaces/:workspaceId/exposure/catalog`, integrations UI catalog fetch |
| 8d | Authoritative `ExposureResolver` output contract | **Complete** | `resolveExposureDecision`, dispatch consumes `fieldExposureDecision` |
| 8e | Runtime mode/shadow retirement | **Complete** | authoritative `fieldExposureRuntime.source`; shadow gated by `FIELD_EXPOSURE_SHADOW_DIAGNOSTICS` |
| 8f | Minimal `FieldExposurePolicy` layer | **Complete** | `restrictFieldExposureCandidates` in `field-exposure-policy.ts` |
| 8g | Audit/versioning observability | **Complete** | job payload `fieldExposureDecision` + `field_exposure_decision_audited_total` |
| 8h | Final transitional cleanup | **Complete** | integrations catalog fetch; `buildDeliveryFieldCatalog` permanent compat re-export; starter keeps FieldPolicy `delivery` surface by provider-agnostic rule |

### Native catalog API contract (8c)

- Exposure field catalog reads must use exposure-owned endpoints:
  `GET /workspaces/:workspaceId/exposure/catalog`.
- Integration surface metadata may continue to expose provider configuration and event-policy
  defaults, but must not be the source of truth for standalone exposure settings.
- The catalog response is a workspace-scoped exposure payload:

```ts
type WorkspaceExposureCatalogResponse = {
  workspaceType: string | null;
  fields: readonly ExposureFieldCatalogEntry[];
  source:
    | "published_wizard_template"
    | "registry_deliverable_migration_seed";
};
```

### Tenant-scoped selectable catalog (8c+)

Admin field pickers (Denali workspace surfaces, Telegram delivery intents) must expose
**every field the operator can configure in the published create-tour wizard**, not only
registry rows tagged `deliverable`.

**Formula:**

```text
Selectable fields = WorkspaceFieldRegistry ∩ PublishedWizardTemplate
  (enabled steps, non-hidden template fields, matched by canonicalPath)

Fallback when template is unpublished or yields zero registry matches:
  buildExposureSelectableFieldCatalog(workspaceType)  // deliverable seed
```

**Read path:**

```text
tenant_config (configKey = wizard_template)
  -> resolveWizardTemplateAllowedCanonicalPaths(payload)
  -> buildWizardTemplateExposureCatalog({ workspaceType, wizardTemplatePayload })
  -> GET /workspaces/:workspaceId/exposure/catalog
  -> ExposureFieldChecklist (web)
```

**Response `source` semantics:**

| `source` | Meaning |
| --- | --- |
| `published_wizard_template` | Catalog intersected with tenant published wizard template |
| `registry_deliverable_migration_seed` | Legacy deliverable-tag seed (unpublished/empty template) |

**Validation:** PATCH handlers for exposure intents and workspace surface intents reject
`selectedFieldIds` outside the tenant-scoped catalog returned by the same resolver.

**Deferred:** per-surface eligibility metadata (`public_list` vs `user_dashboard` hard blocks)
and PII sensitivity warnings — all template fields remain selectable on every Denali surface
until a later phase adds surface-scoped eligibility.

Implementation: `apps/api/src/exposure/resolve-wizard-template-exposure-catalog.ts`,
`resolveTenantExposureSelectableCatalog()` in `exposure-catalog.service.ts`.

### Authoritative exposure resolver contract (8d)

Dispatch calls `resolveExposureDecision()` after loading a persisted or seeded `ExposureProfile`.
The resolver applies layers in order:

1. **Profile** — `resolvePersistedExposureProfileForContext` ensures tenant-scoped `exposure_profiles` rows exist (registry seed on first use).
2. **Intent** — native `ExposureIntent` overrides profile defaults when present.
3. **FieldExposurePolicy** — `restrictFieldExposureCandidates()` narrows candidates to the exposure catalog.
4. **FieldPolicy** — loaded into engine input; `resolveDeliveryFieldDefinitions()` remains the
   compatibility definitions adapter for enrichment.

```ts
type FieldExposureDecision = {
  profileId: string;
  profileVersion: string;
  intentId?: string;
  intentVersion?: string;
  resolverVersion: string;
  selectionSource: "native_exposure_intent" | "exposure_profile_defaults";
  candidateFieldIds: readonly string[];
  eligibleFieldIds: readonly string[];
};
```

Job payloads include `fieldExposureDecision` for audit. Legacy `integrationDelivery*` keys remain for provider formatting compatibility.

### Shadow diagnostics demotion (8e)

`FIELD_EXPOSURE_RUNTIME_MODE` remains documented for Phase 6 historical contract only; authoritative dispatch no longer branches on shadow vs cutover. `fieldExposureShadow` attaches only when `FIELD_EXPOSURE_SHADOW_DIAGNOSTICS=true`.

### Phase 8 exit criteria (full closure)

| Criterion | Status |
| --- | --- |
| `exposure_profiles` persisted with tenant scope, RLS, versioning, and Denali seed migration | Complete |
| Standalone exposure settings and integration field checklists read catalog from exposure APIs | Complete |
| `ExposureResolver` produces a versioned decision object consumed by dispatch | Complete |
| Job payload records `profileId`, `profileVersion`, `intentId`, `intentVersion`, and `resolverVersion` | Complete |
| `fieldExposureShadow` demoted to `FIELD_EXPOSURE_SHADOW_DIAGNOSTICS`; runtime metadata uses `exposure_resolver` | Complete |
| `FieldExposurePolicy` exists as a distinct layer above FieldPolicy and below Profile | Complete |
| Starter uses FieldPolicy `delivery` surface (provider-agnostic); exposure profiles use `telegram`; `buildDeliveryFieldCatalog` kept as guarded permanent compat re-export | Complete |
| `guard:field-exposure-phase-8` and `field-exposure-phase-8-enterprise-hardening.contract.spec.ts` pass | Complete |

Verification: `pnpm run guard:field-exposure-phase-8`

Phase 4 transitional rule:

- Default field ids may still be **seeded** from registry `deliverable` metadata for
  compatibility, but runtime code should read them through an `ExposureProfile` view.
- The profile source must be annotated as a migration seed, not native exposure policy.
- Denali `telegram_tour_created` defaults must match the current selectable/default field
  ids exactly until a workspace-owned native profile replaces the seed.
- This phase does not remove `deliverable`; it moves the read boundary so later phases can
  replace the seed without changing dispatch callers.

Phase 5 UI rule:

- Field selection UI must be reusable as an Exposure component, not owned by integrations.
- Integration settings may embed the component with `surface=telegram`,
  `audience=external_channel`, and the current event as trigger, but it must pass field data
  and selected ids through props.
- The generic component must not call integration APIs, know provider credentials, or decide
  persistence shape.
- Integration-specific save behavior may remain in `IntegrationEventDeliveryPolicyPanel`
  until Phase 7 standalone exposure settings; the checklist ownership moved in Phase 5 and
  native mirror on save landed in Phase 6.

Phase 6 dual-write + controlled cutover (historical; superseded by Phase 7):

- Phase 6 introduced the `FIELD_EXPOSURE_RUNTIME_MODE` flag and selection-source audit.
- Phase 7 removed the legacy delivery-intent store; native `ExposureIntent` now drives
  field/template selection when present, and profile defaults are the only fallback.
- Every job payload records `fieldExposureDecision` for permanent audit; runtime metadata remains
  historical compatibility, while `fieldExposureShadow` is opt-in diagnostics only.
- Routing, provider selection, credentials, retries, and event enablement stay integration-owned;
  worker/provider formatting is unchanged.

Phase 7a native persistence foundation (**closed**):

- Native `exposure_intents` storage and repository exist.
- `integration_delivery_intents` was deleted in Phase 7i.
- `exposure_intents` must be tenant-scoped, RLS-protected, versioned through timestamps, and
  independent from provider credentials.
- Scope may include `connectionId` for compatibility, but the table key must be profile/surface
  oriented rather than integration-connection oriented.

Phase 7b compatibility bridge (**retired**):

- Legacy write bridge was deleted in Phase 7i.
- Native saves use real exposure dimensions: provider surface, `external_channel` audience,
  event trigger, and connection-scoped overrides.

Phase 7c backfill and native-read shadow (**closed**):

- Backfill existing `integration_delivery_intents` into `exposure_intents` using the same
  provider surface, `external_channel` audience, event trigger, and connection scope as the
  Phase 7b bridge.
- Runtime dispatch is now native/profile-default authoritative.

Phase 7d controlled native-intent cutover (**closed by Phase 7i**):

- Native `ExposureIntent` drives field candidates and template override when present.
- Missing native rows fall back to exposure profile defaults, not legacy delivery intents.
- Routing, provider selection, credentials, retries, and event policy enablement still belong to
  the integration layer in this phase.

Phase 7e event policy cleanup:

- `integration_event_policies` must become routing/activation only: `event_type` + `enabled`.
- Before dropping residual `selected_field_ids` and `message_template` columns, migration
  preserved remaining values into `exposure_intents`.
- After this phase, integration event policy repositories and DTOs must not expose field
  selection or template ownership.

Phase 7f exposure-owned catalog compatibility:

- Integration metadata no longer emits `deliveryCandidateFields`.
- Phase 8 moved standalone exposure settings and integration field checklists from
  integration-meta `exposureCandidateFields` to native exposure catalog APIs.
- The exposure-owned catalog may still be seeded from registry `deliverable` tags, but persisted
  `ExposureProfile.defaultFieldIds` rows are created before dispatch decisions.

---

## Forbidden Core Concepts (final state)

These must not remain as platform primitives after Phase 7:

- `IntegrationDeliveryIntent` as domain truth
- `selectedFieldIds` owned by integrations
- `deliveryCandidateFields` on integration meta
- `deliverable` tags as policy
- `surface: "delivery"` as final surface name
- Telegram/email-specific field selection ownership
- Integration-driven field catalogs

---

## Success Criteria (end-state)

- Platform asks exposure questions, not integration delivery questions.
- Telegram, Email, PDF, Web, Dashboard, Wizard, and Admin are equal consumers.
- FieldPolicy and ExposurePolicy remain separate with deterministic precedence.
- Surface, audience, and trigger are never conflated.
- Exposure decisions are explainable, auditable, and versioned.
- New surfaces onboard without modifying integration delivery code.

---

## Shadow decision engine instrumentation (complete — Phases A–E)

A forward shadow path runs the pure `FieldExposureDecisionEngine` in parallel with the
legacy integration delivery resolver. It is gated by `FIELD_EXPOSURE_DECISION_ENGINE_SHADOW=true`
(default off) and hooks into `dispatch-integration-domain-event.ts` after authoritative
delivery fields are computed and before job enqueue.

Shadow behavior:

- Builds per-field inputs from existing registry/policy snapshots and normalized triggers.
- Invokes `resolveFieldExposureDecision()` in `packages/platform-core/src/exposure/`.
- Logs per-field decisions only — never mutates integration job payloads.
- Fails open: shadow errors must not block dispatch.

Phase A freeze (migration): forward shadow is default-off, injectable for tests, and covered by
dispatch specs proving payload stability and fail-open enqueue behavior. Platform-core facade
tests assert exposure engine exports. Integration delivery FieldPolicy eligibility continues
to use the transitional `delivery` surface until engine cutover — not the integration provider id.

Phase A exit criteria:

- `FIELD_EXPOSURE_DECISION_ENGINE_SHADOW` defaults off (`isFieldExposureDecisionEngineShadowEnabled`).
- Forward shadow is fail-open (`try/catch` around shadow runner; enqueue proceeds on shadow failure).
- Shadow on/off does not change integration delivery payload keys or values.
- Contract: `apps/api/test/field-exposure-phase-a-migration.contract.spec.ts`

Initial engine release is a skeleton (`visible` placeholder) with staged reason-chain markers
for registry, field policy, exposure policy, and intent override. Policy logic and parity
comparison land in follow-up work after observability baseline is stable.

Phase C introduces the first real engine decisions while preserving shadow-only rollout. The
engine consumes explicit snapshots passed by the caller instead of importing workspace plugins:
registry field presence, FieldPolicy definitions/rules, and optional ExposureIntent mode. It may
only enforce hard lower bounds at this stage:

- missing registry field -> `hidden`
- FieldPolicy `hidden` or no resolved field state -> `hidden`
- ExposureIntent `disabled` -> `blocked`

FieldPolicy states `visible`, `required`, and `readonly` all map to an exposure `visible` state
for this phase because they only prove that the field may be exposed; they do not encode
publication redaction or summary behavior.

ExposurePolicy in Phase C is a profile-backed restriction snapshot (not a native rule engine
yet). The API adapter passes `exposurePolicy.allowedFieldIds` derived from `ExposureProfile`
defaults or native `override_fields` intent selection. The engine may only restrict further:

- field outside `allowedFieldIds` -> `hidden` (`exposure_policy_check:not_allowed`)
- field inside `allowedFieldIds` -> continue (`exposure_policy_check:allowed`)
- missing snapshot -> `exposure_policy_check:pending` (skeleton-compatible)

ExposureIntent is applied after ExposurePolicy:

- `disabled` -> `blocked` (connection/event delivery suppressed at engine layer)
- `inherit_profile` -> ExposurePolicy uses profile `defaultFieldIds`; no additional intent narrowing
- `override_fields` -> ExposurePolicy uses `selectedFieldIds`; fields outside -> `hidden`

This Phase C note was superseded by Phases 7-9: intent/profile state now flows through engine
selection in every runtime mode, and dispatch no longer routes active `integrationDeliveryFieldIds`
through `deliveryPolicy.eligibleFieldIds`.

Phase C centralizes engine snapshot construction in
`apps/api/src/exposure/build-field-exposure-engine-input.ts`. Dispatch and the forward shadow
runner call this adapter instead of inlining registry/FieldPolicy/trigger assembly. The adapter
maps API `ExposureIntent` into the platform-core engine input shape and keeps `audience` at
`external_channel` with the opaque integration `surface` unchanged.

Phase C exit criteria:

- Registry existence, FieldPolicy lower bounds, ExposurePolicy profile snapshots, and
  ExposureIntent constraints are enforced in `resolveFieldExposureDecision()` with unit tests.
- `build-field-exposure-engine-input.ts` is the single snapshot builder for forward engine runs.
- Forward shadow and cutover engine decision maps pass the same exposure intent snapshot.
- Phase C remains shadow-only for production delivery: no change to enqueue payloads unless
  `FIELD_EXPOSURE_RUNTIME_MODE=cutover` (Phase D/E scope).
- Contract: `apps/api/test/field-exposure-phase-c-engine.contract.spec.ts`

Phase C5 records `engineSelectedFieldIds` on `fieldExposureDecision` audit metadata whenever
engine decisions are available, while shadow mode keeps the legacy delivery selector active.

Phase D begins removing the delivery-field selector dependency. D1 adds an audit-only
`engineSelectedFieldIds` projection derived from per-field engine decisions:

- `visible` is included.
- `redacted` is included only after a placeholder-safe renderer exists; until then it is excluded.
- `summary_only` is excluded until a summary renderer contract exists.
- `hidden` and `blocked` are excluded.

The projection is optional until dispatch passes engine decisions into the resolver. D1 does not
change enrichment, formatter payload keys, or provider behavior; `integrationDeliveryFieldIds`
continues to come from the existing delivery policy until the D2/D3 selector switch.

D2/D3 introduces the runtime selector switch without changing default behavior:

```text
FIELD_EXPOSURE_RUNTIME_MODE=shadow  -> active field selector = engineSelectedFieldIds
FIELD_EXPOSURE_RUNTIME_MODE=cutover -> active field selector = engineSelectedFieldIds
```

If cutover mode has no computed `engineSelectedFieldIds`, dispatch emits an empty active selection
and records `fieldExposureRuntime.engineSelectorMissing=true`. Enrichment and the compatibility
payload key `integrationDeliveryFieldIds` both read from the active selector, while
`integrationDeliveryCandidateFieldIds` remains the candidate audit surface. Provider workers and
formatters continue to consume the same payload keys.

D5 originally constrained the first engine-selector cutover to a Denali Telegram tuple. That
accepted-scope gate is now retired: all runtime modes use engine-selected ids. Intentional shadow
parity deltas, if any, are documented by exact workspace/event/surface/field in
`apps/api/src/exposure/shadow-parity-intentional-mismatch.ts`; they never authorize selector
fallback.

Phase D exit criteria:

- `engineSelectedFieldIds` is projected from per-field engine decisions (`visible` only until
  redaction/summary renderers exist) and appears on `fieldExposureDecision` audit metadata in both
  shadow and cutover modes.
- `FIELD_EXPOSURE_RUNTIME_MODE=shadow` and `cutover` both expose engine-selected ids.
- Enrichment reads the active selector ids in all modes (`enrichCanonicalDeliveryPayload` input).
- Payload compatibility keys (`integrationDeliveryFieldIds`, `integrationDeliveryCandidateFieldIds`,
  `integrationDeliveryFieldValues`) remain stable for formatters and provider workers.
- Historical accepted scope metadata is removed from selector and parity logs.
- Contract: `apps/api/test/field-exposure-phase-d-selector.contract.spec.ts`

Phase E retired legacy field selection from the active cutover path. Later phases extended this to
all runtime modes: active exposed field ids now read only
`fieldExposureDecision.engineSelectedFieldIds`.

If an engine selection is unavailable, dispatch emits an empty active field selection
and records `fieldExposureRuntime.engineSelectorMissing=true`; it does not fall back to
`eligibleFieldIds`. `FIELD_EXPOSURE_RUNTIME_MODE` remains metadata/diagnostic context, not selector
authority.

Phase E also retires temporary shadow observability from cutover runtime. The forward
`FIELD_EXPOSURE_DECISION_ENGINE_SHADOW` drift/hypothesis/model log stack may still run in shadow
mode for rollback analysis, but cutover mode skips it so production cutover jobs do not emit
temporary reverse-engineering artifacts. Stable audit metadata remains on `fieldExposureDecision`
and `fieldExposureRuntime`.

Engine runtime must not depend on the registry `deliverable` tag to decide whether a field is
visible or hidden. The dispatch decision map is built from the full exposure catalog; persisted
profiles and intents define candidate shape, while the engine decides field exposure from registry
presence, FieldPolicy, ExposurePolicy, and Intent state.

Phase E closure criteria:

- Cutover active selection is sourced from `engineSelectedFieldIds` only.
- Missing engine selection in cutover emits an empty active field set and
  `engineSelectorMissing=true`; it never silently reuses legacy `eligibleFieldIds`.
- In cutover, compatibility payload keys (`integrationDeliveryFieldIds`,
  `integrationDeliveryCandidateFieldIds`) are sourced from engine projections; legacy
  `deliveryPolicy.candidateFieldIds` / `eligibleFieldIds` are not used as runtime selectors.
- Cutover uses `resolveDeliveryFieldDefinitions()` for enrichment definitions — it adapts FieldPolicy definitions from
  the full exposure catalog and never computes legacy `eligibleFieldIds` / `candidateFieldIds`.
- The historical selector helper `resolveDeliveryFieldPolicy()` is retired; runtime and resolver paths must not
  import or call it. Definitions live in `delivery-field-definitions.ts` (not the legacy
  `resolve-delivery-field-policy.ts` filename). Compatibility `{ candidateFieldIds, eligibleFieldIds, definitions }`
  objects are assembled in `resolveExposureDecision()` from engine projections plus
  `resolveDeliveryFieldDefinitions()`.
- Legacy mirror shadow (`fieldExposureShadow`, drift/hypothesis/model forward logs) is skipped in
  cutover; forward `FIELD_EXPOSURE_DECISION_ENGINE_SHADOW` remains shadow-only.
- When engine decisions are available, candidate projection uses the full exposure catalog keys —
  not the registry `deliverable` tag filter (`exposureSelectableFieldIds`).
- Rollback is explicit: switch runtime mode back to `shadow`, rather than mixing legacy and engine
  selectors inside one cutover job.
- Historical `engineSelectorFallback` metadata is retired; cutover emits only
  `engineSelectorMissing` when engine ids are absent.
- Contract: `apps/api/test/field-exposure-phase-e-cleanup.contract.spec.ts`

Shadow parity instrumentation compares per-field engine output against legacy integration
`candidateFieldIds` / `eligibleFieldIds` via `compare-shadow-vs-legacy.ts` and logs
`field_exposure.shadow_parity` events when `FIELD_EXPOSURE_DECISION_ENGINE_SHADOW=true`.

Phase B parity gate activation adds one aggregate event per shadow run:
`field_exposure.shadow_parity_summary`. The summary records `matches`, `mismatchCount`, and
`fieldCount` so operators can gate later engine work without scanning per-field logs. When
`mismatchCount > 0`, dispatch records `field_exposure_engine_shadow_mismatch_total` with bounded
`tenant_id`, `event_type`, and `surface` labels. This metric belongs to the forward
`FieldExposureDecisionEngine` shadow path and does not replace the legacy mirror diagnostic
metric used by `fieldExposureShadow`.

Phase B exit criteria:

- Phase B is observational only: it measures parity and does not change production delivery
  selection, enrichment, formatter output, or provider behavior.
- Forward shadow remains default-off and fail-open.
- Every enabled forward shadow run emits exactly one `field_exposure.shadow_parity_summary` log.
- Mismatches increment `field_exposure_engine_shadow_mismatch_total` with bounded labels
  (`tenant_id`, `event_type`, `surface`) without mutating job payloads.
- Per-field logs remain explanatory only; aggregate summary and metric are the operational gate.
- Operational cutover gate: for the accepted scope (`denali` / `TourCreated` / `telegram`), forward
  shadow mismatch rate must be triaged to zero unexplained diffs before enabling engine selector
  cutover. Intentional mismatches must be documented before scope expansion.
- Contract: `apps/api/test/field-exposure-phase-b-parity-gate.contract.spec.ts`

Phase 3 drift classification (`classify-shadow-drift.ts`) annotates mismatches with
read-only hypotheses (`REGISTRY_DRIVEN`, `FIELD_POLICY_DRIVEN`, etc.) for observability
only — it does not alter parity outcomes or production behavior.

Phase 4 policy hypothesis inference (`infer-exposure-policy-hypothesis.ts`) reverse-engineers
non-authoritative `ExposurePolicyHypothesis` artifacts from drift signals for logging only.
Hypotheses are explanations, not runtime decisions.

Phase 5 observed model extraction (`extract-observed-exposure-model.ts`) aggregates shadow
artifacts into a structural `ObservedExposureModel` summary for logging only — reverse
engineering of reality, not platform redesign.

## Field Exposure Decision Engine migration — DONE definition

Engineering closure (Phases A–E) is verified by phase contracts and the aggregator
`apps/api/test/field-exposure-engine-migration-done.contract.spec.ts`.

| Phase | Contract |
| ----- | -------- |
| A — Freeze | `field-exposure-phase-a-migration.contract.spec.ts` |
| B — Parity gate | `field-exposure-phase-b-parity-gate.contract.spec.ts` |
| C — Engine logic | `field-exposure-phase-c-engine.contract.spec.ts` |
| D — Selector switch | `field-exposure-phase-d-selector.contract.spec.ts` |
| E — Cleanup | `field-exposure-phase-e-cleanup.contract.spec.ts` |
| Closure | `field-exposure-engine-migration-closure.contract.spec.ts` |
| Phase 9 — Preview dependency closure | `field-exposure-phase-9-preview.contract.spec.ts` |
| Phase 10 — Control-plane selector cleanup | `field-exposure-phase-10-control-plane.contract.spec.ts` |
| Phase 11 — Runtime metadata decoupling | `field-exposure-phase-11-runtime-metadata.contract.spec.ts` |
| Phase 12 — Native intent metadata semantics | `field-exposure-phase-12-native-intent-metadata.contract.spec.ts` |
| Phase 13 — Runtime selection metric cleanup | `field-exposure-phase-13-runtime-selection.contract.spec.ts` |
| UI Phase B — Stored vs effective coordinates | `field-exposure-phase-b-ui.contract.spec.ts` |
| UI Phase C — Preview-primary editor client | `field-exposure-phase-c-ui.contract.spec.ts` |
| UI Phase D0 — Simulation/diff client foundation | `field-exposure-phase-d0-simulation-client.contract.spec.ts` |
| UI Phase D — Simulation console | `field-exposure-phase-d-ui.contract.spec.ts` |

Production cutover closure:

- `FIELD_EXPOSURE_RUNTIME_MODE=cutover` — active field ids come from `engineSelectedFieldIds` only.
- Compatibility payload keys in cutover are engine-projected; legacy `deliveryPolicy` ids are not
  selectors.
- `FIELD_EXPOSURE_RUNTIME_MODE=shadow` is now diagnostic metadata, not a legacy selector rollback.
  Rollback after engine-authoritative selection requires code/config rollback outside the selector
  branch.

Intentional forward-shadow parity deltas are registered in
`FIELD_EXPOSURE_INTENTIONAL_SHADOW_PARITY_MISMATCHES`
(`shadow-parity-intentional-mismatch.ts`) and subtracted from operational mismatch counts before
parity-gate metrics. The registry is diagnostics-only and keyed by exact coordinate + field id.

## Admin control plane (read-only)

Denali Settings exposes a read-only control plane at `settings/exposure/control-plane` so operators
can inspect **runtime truth** without mutating persistence.

`GET /workspaces/{workspaceId}/exposure/control-plane` aggregates:

- `FIELD_EXPOSURE_RUNTIME_MODE` (`shadow` | `cutover`) and whether forward engine shadow
  (`FIELD_EXPOSURE_DECISION_ENGINE_SHADOW`) is enabled
- active `ExposureIntent` rows per enabled `integration_connection` (from `exposure_intents`)
- persisted `ExposureProfile` rows (from `exposure_profiles`, via `resolvePersistedExposureProfileForContext`)
- effective `surface` / `audience` / `trigger` resolved the same way dispatch does
- read-only engine preview per connection/event using `buildFieldExposureEngineDecisionMap` with a
  representative sample payload (no writes, no enqueue)

The control plane does not change dispatch, engine rules, or persistence. It only surfaces what the
runtime would compute given current stored intent/profile state.

### Integration delivery panel — full `ExposureIntent` write shape

`IntegrationEventDeliveryPolicyPanel` exposes admin controls for the full exposure context:

| Control | Source | Persisted field |
| ------- | ------ | --------------- |
| Surface | Workspace integration provider list | `ExposureIntent.surface` |
| Audience | Enum (`external_channel` today) | `ExposureIntent.audience` |
| Trigger | Integration event policy list | `ExposureIntent.trigger` |
| Field checklist | Exposure catalog | `ExposureIntent.selectedFieldIds` + `mode` |

`PATCH /integrations/{id}/exposure-intents/{eventType}` accepts optional `surface`, `audience`,
and `trigger` in the JSON body alongside existing `enabled`, `selectedFieldIds`, and `templateId`.
When omitted, the API preserves legacy behavior (provider surface, `external_channel` audience, URL
`eventType` as trigger). The URL `{eventType}` remains the panel anchor for backward-compatible
routing; body `trigger` overrides storage when provided.

`ExposureIntent.scope.eventType` stores the route anchor and must not be confused with
`ExposureIntent.trigger`. This lets future runtime-effective coordinate cutover recover the intent
for a connection/event even when the stored trigger differs from the integration event type. New
integration-owned writes include both `scope.connectionId` and `scope.eventType`; read paths may
fallback to legacy `scope.connectionId` rows created before this migration.
Integration public DTOs expose `eventType` from `scope.eventType` and `trigger` from the stored
exposure coordinate so the web editor hydrates the correct row without losing custom triggers.
When multiple native rows exist for the same `connectionId + eventType` because an operator changed
stored coordinates over time, the repository returns newest rows first and the route resolver treats
the newest route-scoped row as authoritative. Older rows remain historical persistence artifacts until
versioned artifact storage replaces timestamp-based rows.
Integration public DTOs expose only the newest row per `connectionId + eventType` route anchor so the
web editor does not hydrate stale historical coordinate rows.

## Deterministic engine preview API (read-only)

`GET /exposure/engine-preview?connectionId={id}&eventType={type}` is a dedicated **pure preview**
layer for the platform-core `resolveFieldExposureDecision` engine. It is separate from dispatch,
forward-shadow runners, and shadow parity logging.

### Inputs (loaded, never written)

| Source | Loader |
| ------ | ------ |
| `ExposureIntent` | `ExposureIntentRepository.findForContext` scoped to `connectionId` |
| `ExposureProfile` | `resolvePersistedExposureProfileForContext` (DB row or registry seed) |
| Exposure catalog | `buildExposureFieldCatalog` (full registry projection) |
| Entity state + field policy | `buildFieldExposureEngineInputSnapshot` with a **fixed** per-event sample payload |

### Engine execution

For every catalog field id, the handler builds a `FieldExposureDecisionInput` and calls
`resolveFieldExposureDecision` from `@app-tour/platform-core` directly. No enqueue, no metrics, no
shadow log events.

The preview route is engine-only. It does not call `resolveDeliveryFieldPolicy()` and does not attach
`legacyComparison`; selector parity remains available through dispatch shadow/parity diagnostics, not
through the read-only preview API.

### Response shape

```json
{
  "fields": {
    "tour.title": {
      "state": "visible",
      "reasonChain": ["..."],
      "appliedPolicies": ["..."]
    }
  },
  "summary": {
    "visibleCount": 1,
    "hiddenCount": 0,
    "blockedCount": 0
  }
}
```

Field map keys are sorted lexicographically for deterministic JSON. Summary counts only aggregate
`visible`, `hidden`, and `blocked` states.

## Unified Control Plane Migration — Phase 1 (runtime truth visibility)

Phase 1 of the unified field-exposure control-plane migration is **observability only**. It
exposes the *runtime truth* of each dispatched integration delivery — which selector actually
chose the delivered field ids, and the effective exposure coordinate — **without changing field
selection, enrichment, enqueue payload shape, routing, or provider behavior**.

### Goal and guarantees

- No delivered field changes: `resolveActiveDeliveryFieldIds`
  (`apps/api/src/integrations/application/dispatch-integration-domain-event.ts`) is untouched.
- No enqueue payload shape change: `integrationDelivery*` keys and `fieldExposureRuntime` metadata
  are unchanged; no new payload key is added.
- No routing change: `IntegrationPolicyEngine.evaluate` is untouched.
- Additive structured log only; fail-open — visibility logging must never block dispatch.

### Runtime truth source

`resolveFieldExposureRuntimeTruthSource` (`apps/api/src/exposure/resolve-runtime-truth-source.ts`)
derives the authoritative selector for the emitted job purely from the resolved runtime mode and
the `engineSelectorMissing` flag already computed by `resolveActiveDeliveryFieldIds`. It performs
no new selection logic; it only labels what dispatch already decided:

| `runtimeMode` | `engineSelectorMissing` | `truthSource` | Meaning |
| --- | --- | --- | --- |
| any | `false` | `engine` | active ids = `fieldExposureDecision.engineSelectedFieldIds` |
| any | `true` | `engine_missing` | engine ids absent → empty active selection |

Phase 7 updates this branch: runtime mode no longer chooses selector authority. The active selector
uses engine-selected ids whenever they exist. Accepted cutover scope metadata has been retired, and
missing engine ids still produce an empty set with `engineSelectorMissing=true`.

### Effective exposure coordinate

`resolveFieldExposureRuntimeCoordinate` reports the engine-normalized visibility coordinate that was
introduced in Phase 1; it reuses the existing trigger normalization rather than introducing a
divergent derivation:

- `surface` = routing decision provider (`decision.provider`).
- `audience` = `external_channel` during the initial visibility phase; later phases carry the
  decision-local coordinate into engine input.
- `trigger` = `normalizeIntegrationEventType(eventType)` reduced to its normalized name (the event
  `name` when `kind === "event"`, otherwise the `kind`) — the same reduction used by the forward
  shadow runner.

These dimensions were **runtime-derived, not intent-controlled** in Phase 1. Later phases introduced
`IntegrationPolicyDecision.exposureCoordinate` and passed its `audience` / `trigger` into engine input.

Phase 2 supersedes the dispatch log's coordinate source with
`IntegrationPolicyDecision.exposureCoordinate`, which preserves the current profile/intent trigger
key (for example `TourCreated`) so persisted profile and intent lookup behavior stays unchanged.

### Observability event

`dispatchIntegrationDomainEvent` emits one structured log per routing decision, after the active
selector and runtime metadata are resolved:

```text
event   = field_exposure.runtime_truth
fields  = tenantId, eventType, provider, connectionId, runtimeMode,
          truthSource, coordinate { surface, audience, trigger },
          selectionSource, activeFieldIdCount, engineSelectorMissing
```

`truthSource` and the coordinate are advisory observability only — they describe what the runtime
already did and never feed back into selection. The log is emitted for every routing decision,
including decisions whose `fieldExposureDecision` is absent (the truth source is then
`engine_missing`). After Phase 2, the `coordinate` field is the decision-carried profile/intent
coordinate, not the engine-normalized helper coordinate.

### Phase 1 exit criteria (testable)

- `resolveFieldExposureRuntimeTruthSource` returns `engine` when engine-selected ids exist and
  `engine_missing` when they do not (unit-tested in `resolve-runtime-truth-source.spec.ts`).
- `resolveFieldExposureRuntimeCoordinate` returns provider surface, `external_channel` audience, and
  the normalized trigger name without mutating dispatch behavior.
- Dispatch emits exactly one `field_exposure.runtime_truth` log per routing decision and changes no
  enqueue payload key or value.

## Unified Control Plane Migration — Phase 2 (decision-carried coordinate)

Phase 2 introduces an explicit `exposureCoordinate` on `IntegrationPolicyDecision` so routing,
intent lookup, profile lookup, engine selection, and runtime-truth logging can reference one
decision-local coordinate object instead of re-deriving provider/event defaults at every call site.

This phase is still **behavior-preserving**:

- `surface` remains the integration routing provider (`telegram`, `email`, ...).
- `audience` remains `external_channel`.
- `trigger` remains the current profile/intent trigger key derived by
  `resolveDeliveryExposureProfileContext(eventType)` (for example `TourCreated`). It is not replaced
  with the normalized engine trigger yet because persisted profile and intent ids are currently keyed
  by the raw event trigger.
- `buildFieldExposureEngineInputSnapshot` continues to normalize `eventType` internally for the
  platform-core engine. Phase 2 does not make stored `ExposureIntent.trigger` engine-authoritative.

### Phase 2 coordinate flow

```text
IntegrationPolicyEngine.evaluate(...)
  -> resolve route/default exposureCoordinate once per connection/event
  -> find route-scoped ExposureIntent with scope.connectionId + scope.eventType
  -> use stored intent coordinates when a route-scoped native row exists
  -> emit IntegrationPolicyDecision.exposureCoordinate
  -> dispatchIntegrationDomainEvent uses decision.exposureCoordinate for:
       persisted ExposureProfile lookup
       engine-decision surface input
       exposure resolver surface input
       runtime truth log coordinate
```

The legacy `provider` field remains on `IntegrationPolicyDecision` for transport routing and
payload compatibility. The coordinate is a control-plane/runtime-truth value; provider credentials
and transport capability selection remain integration-owned.

### Phase 2 exit criteria (testable)

- Policy decisions include `exposureCoordinate` matching the exact values used for
  `ExposureIntentRepository.findForContext`.
- Synthetic legacy connections also carry the same effective coordinate even when no native intent is
  loaded.
- Dispatch no longer re-derives `surface` for profile lookup, engine input, exposure resolution, or
  runtime truth logging; it reads `decision.exposureCoordinate.surface`.
- Enqueue payloads and active field ids remain unchanged.

## Unified Control Plane Migration — Phase 3 (effective engine input dimensions)

Phase 3 makes `buildFieldExposureEngineInputSnapshot`,
`buildFieldExposureEngineDecisionInput`, and `buildFieldExposureEngineDecisionMap` accept the
effective `audience` and `trigger` that come from the decision-carried coordinate. This removes the
engine-input hardcode as a call-site constraint while preserving current runtime output.

Behavior-preserving defaults remain:

- Omitted `audience` defaults to `external_channel`.
- Omitted `trigger` defaults to `eventType`.
- The engine still receives a normalized platform-core trigger object. When a caller passes an
  effective trigger, the builder normalizes that trigger; otherwise it normalizes the raw event type.
- Dispatch passes `decision.exposureCoordinate.audience` and `decision.exposureCoordinate.trigger`.
  Because Phase 2 still sets those to `external_channel` and the current raw profile/intent trigger,
  active field ids and enqueue payloads do not change.

This phase is the mechanical prerequisite for making stored or UI-edited `audience` / `trigger`
runtime-effective later. It does **not** by itself allow arbitrary UI coordinates to alter dispatch;
`IntegrationPolicyEngine` still owns the effective coordinate derivation.

### Phase 3 exit criteria (testable)

- Engine input builder tests prove a caller-supplied trigger is normalized into the engine input
  instead of always reading raw `eventType`.
- Engine decision input tests prove caller-supplied `audience` reaches `FieldExposureDecisionInput`.
- Dispatch passes the decision-carried audience/trigger into forward engine maps while preserving
  the existing delivery payload tests.

## Unified Control Plane Migration — Phase 4 (selector parity reporting)

Phase 4 historically added selector-level parity reporting between the two field-id selectors that
existed in dispatch at that point:

```text
legacy selector = deliveryPolicy.eligibleFieldIds
engine selector = fieldExposureDecision.engineSelectedFieldIds
```

This is deliberately separate from the forward-shadow per-field parity logs. The shadow path compares
engine decisions to legacy eligibility only when `FIELD_EXPOSURE_DECISION_ENGINE_SHADOW=true`; selector
parity reports compare the already-computed dispatch selectors whenever engine-selected ids are
available. It is **observability only**:

- It does not change `resolveActiveDeliveryFieldIds`.
- It does not block dispatch.
- It does not change enqueue payload keys or values.
- It did not replace the accepted-scope cutover gate at the time; Phases 6, 7, and 11 supersede
  that historical gate and remove accepted-scope data from active selector metadata.

`resolveExposureSelectorParity` (`apps/api/src/exposure/resolve-exposure-selector-parity.ts`) compares
the sorted unique sets and reports:

| Field | Meaning |
| --- | --- |
| `matches` | both selectors contain the same field ids |
| `legacyOnlyFieldIds` | fields legacy would deliver but engine would not |
| `engineOnlyFieldIds` | fields engine would deliver but legacy would not |
| `legacyFieldCount` | unique legacy eligible count |
| `engineFieldCount` | unique engine selected count |

Dispatch emits one `field_exposure.selector_parity` structured log per routing decision when
`engineSelectedFieldIds` exists on `fieldExposureDecision`. The event includes the effective
coordinate, runtime mode, and mismatch counts. Earlier revisions also attached accepted-scope status;
Phase 11 removes that field because the accepted-scope allowlist is no longer selector metadata.

### Phase 4 exit criteria (testable)

- Selector parity helper sorts and deduplicates ids deterministically.
- Dispatch emits selector parity logs when engine-selected ids are present.
- Existing payload tests continue to prove active delivery fields are unchanged in shadow and cutover.

## Unified Control Plane Migration — Phase 5 (active selector extraction)

Phase 5 historically moved the active field-id selector branch out of
`dispatch-integration-domain-event.ts` and into
`apps/api/src/exposure/resolve-active-delivery-field-ids.ts`. This is a structural prerequisite for
the later removal of legacy selector authority; at the time, it intentionally preserved behavior:

```text
shadow mode
  -> active ids = legacy deliveryPolicy.eligibleFieldIds

cutover mode with engineSelectedFieldIds
  -> active ids = engineSelectedFieldIds

cutover mode missing engineSelectedFieldIds
  -> active ids = []
  -> engineSelectorMissing = true
```

The original helper also reported `acceptedCutoverScope`; that metadata is now retired because
engine-selected ids are authoritative in every runtime mode.

This phase did **not** collapse the legacy selector. It only centralized the final branch and gave it
unit-level coverage before later phases changed the branch semantics; Phases 7-10 supersede this
historical behavior.

### Phase 5 exit criteria (testable)

- `resolveActiveDeliveryFieldIds` has direct unit tests for engine selection and
  missing-engine-selector behavior.
- Dispatch imports the helper and no longer owns the selector branch locally.
- Existing dispatch payload tests remain green, proving no active field-id behavior changed.

## Unified Control Plane Migration — Phase 6 (cutover selector authority)

Phase 6 removed the historical accepted-scope runtime selector gate. Later phases generalized the
same rule to every runtime mode: active field ids come from
`fieldExposureDecision.engineSelectedFieldIds` whenever that projection exists.

The remaining selector rules are:

```text
shadow mode
  -> active ids = engineSelectedFieldIds

cutover mode with engineSelectedFieldIds
  -> active ids = engineSelectedFieldIds

cutover mode without engineSelectedFieldIds
  -> active ids = []
  -> engineSelectorMissing = true
```

`acceptedCutoverScope` is no longer emitted. Rollback requires code/config rollback outside the
selector branch; `FIELD_EXPOSURE_RUNTIME_MODE` is diagnostic metadata.

This phase still preserves payload compatibility: workers and providers continue to read the same
`integrationDeliveryFieldIds`, `integrationDeliveryCandidateFieldIds`, and
`integrationDeliveryFieldValues` keys.

### Phase 6 exit criteria (testable)

- Cutover uses engine-selected ids when they are present without accepted-scope metadata.
- Cutover without `engineSelectedFieldIds` still emits an empty active field set and
  `engineSelectorMissing=true`.
- Shadow mode remains a diagnostic/runtime label, not a selector authority switch.
- Dispatch payload compatibility tests remain green.

## Unified Control Plane Migration — Phase 7 (engine authority in all modes)

Phase 7 removes `FIELD_EXPOSURE_RUNTIME_MODE` as a field-selection authority switch. The runtime mode
may still control migration diagnostics, forward-shadow logging, and rollback metadata, but it no
longer chooses active delivered field ids.

The active selector is now:

```text
fieldExposureDecision.engineSelectedFieldIds exists
  -> active ids = engineSelectedFieldIds

fieldExposureDecision.engineSelectedFieldIds missing
  -> active ids = []
  -> engineSelectorMissing = true
```

Legacy `deliveryPolicy.eligibleFieldIds` remains available for definitions, parity reporting, and
compatibility audit, but it is no longer the active field selector in `shadow` mode. `shadow` is now a
diagnostic mode name only; the runtime truth source is `engine` or `engine_missing`.

Provider payload compatibility remains: the selected ids are still written to the existing
`integrationDeliveryFieldIds` key and enriched through the existing canonical enrichment path.

### Phase 7 exit criteria (testable)

- `resolveActiveDeliveryFieldIds` uses engine-selected ids in both `shadow` and `cutover`.
- Missing `engineSelectedFieldIds` returns an empty active field set and `engineSelectorMissing=true`
  in all modes.
- `resolveFieldExposureRuntimeTruthSource` no longer reports `legacy`.
- Dispatch tests prove `shadow` jobs now deliver engine-selected ids while keeping the same payload
  keys.

## Unified Control Plane Migration — Phase 8 (definitions-only resolver path)

Phase 8 removes `resolveDeliveryFieldPolicy().eligibleFieldIds` from the runtime resolver path when
engine decisions are available. Dispatch always builds engine decisions before resolving exposure, so
runtime dispatch now uses:

```text
candidateFieldIds = sorted engine decision map keys
eligibleFieldIds  = engineSelectedFieldIds
definitions       = resolveDeliveryFieldDefinitions(...)
deliveryPolicy    = compatibility object { candidateFieldIds, eligibleFieldIds, definitions }
```

`resolveDeliveryFieldPolicy()` is no longer a fallback inside `resolveExposureDecision`. If engine
decisions are missing, the resolver emits no engine-selected ids and the active selector reports
`engineSelectorMissing=true`; it does not silently rebuild legacy eligibility. The historical
`resolveDeliveryFieldPolicy()` export is retired; only `resolveDeliveryFieldDefinitions()` and
`buildDeliveryFieldPolicyEntityState()` remain for enrichment compatibility.

### Phase 8 exit criteria (testable)

- `resolveExposureDecision` uses engine catalog/definitions automatically whenever `engineDecisions`
  are present, even if `useEngineCatalogForCandidates` is omitted.
- In the engine path, `eligibleFieldIds` mirrors `engineSelectedFieldIds`.
- Dispatch and `resolveExposureDecision` do not accept an injected `resolveDeliveryFieldPolicy`
  selector dependency.
- Existing payload keys remain stable.

## Unified Control Plane Migration — Phase 9 (preview and dependency closure)

Phase 9 closes the read-only preview and dependency surface around the engine-only resolver path.
After Phase 8, runtime dispatch no longer needs `resolveDeliveryFieldPolicy()` as a selector. Phase 9
extends the same rule to preview/control-plane reads:

```text
engine preview
  -> builds deterministic engine inputs
  -> calls platform-core `resolveFieldExposureDecision`
  -> returns engine state / reasonChain / appliedPolicies only
  -> never returns `legacyComparison`
```

This phase is deliberately narrower than the future simulation console. The existing
`GET /exposure/engine-preview` endpoint remains read-only and deterministic, using a representative
sample payload; it does not simulate arbitrary drafts, mutate persistence, enqueue delivery jobs, or
produce replay artifacts.

### Phase 9 exit criteria (testable)

- `exposure-engine-preview.service.ts` does not import or call `resolveDeliveryFieldPolicy()`.
- Engine preview responses do not expose `legacyComparison`.
- Control-plane previews use engine-selected ids and deterministic sample payloads only.
- The migration DONE contract lists Phase 9 explicitly so audit traceability does not skip from
  Phase 8 to Phase 10.
- Contract: `apps/api/test/field-exposure-phase-9-preview.contract.spec.ts`.

## Unified Control Plane Migration — Phase 10 (control-plane selector cleanup)

Phase 10 aligns the read-only control plane with engine-authoritative runtime behavior. The control
plane no longer exposes `legacy_eligible_field_ids` as an active selector option. It always reports:

```text
runtime.activeDeliverySelector = engine_selected_field_ids
```

`parityInstrumentation` still distinguishes optional diagnostics:

- `forward_engine_shadow` when the forward shadow flag is enabled;
- `legacy_mirror_shadow` only when `FIELD_EXPOSURE_SHADOW_DIAGNOSTICS=true`;
- `none` otherwise.

These diagnostics do not imply selector authority. UI copy and client types must treat the active
selector as engine-only and use parity fields only for comparison/diagnostics.

### Phase 10 exit criteria (testable)

- API control-plane response type only allows `engine_selected_field_ids`.
- Web control-plane client parser normalizes any stale/unknown selector to `engine_selected_field_ids`.
- `parityInstrumentation` is diagnostics-only: `legacy_mirror_shadow` is emitted only when
  `FIELD_EXPOSURE_SHADOW_DIAGNOSTICS=true`, not from `FIELD_EXPOSURE_RUNTIME_MODE=shadow` alone.
- Phase D/E/closure contract tests inspect `resolve-active-delivery-field-ids.ts`, not the old inline
  dispatch helper, and assert no legacy selector branch remains.
- Contract: `apps/api/test/field-exposure-phase-10-control-plane.contract.spec.ts`.

## Unified Control Plane Migration — Phase 11 (runtime metadata decoupling)

Phase 11 removes the remaining migration metadata from the active selector path without deleting
diagnostic controls that still gate shadow/parity logging.

Runtime dispatch keeps `FIELD_EXPOSURE_RUNTIME_MODE` as payload/debug metadata for now, but it no
longer changes any delivered field-id or candidate-field-id compatibility key:

```text
integrationDeliveryFieldIds          = engineSelectedFieldIds
integrationDeliveryCandidateFieldIds = fieldExposureDecision.candidateFieldIds
```

Historical accepted cutover scopes are no longer a runtime concept. Shadow parity mismatch triage is
kept as a generic diagnostics-only registry; the active selector helper no longer imports or returns
accepted-scope state, and selector parity logs no longer attach `acceptedCutoverScope`.

### Phase 11 exit criteria (testable)

- `resolve-active-delivery-field-ids.ts` has no dependency on accepted cutover scope metadata.
- `deliveryFieldPolicyPayload()` uses engine candidate ids in every runtime mode.
- Selector parity logging reports field-id parity without accepted-scope selector metadata.
- Existing runtime-mode tests remain green because mode still controls diagnostics/payload labels, not
  selector authority.
- Contract: `apps/api/test/field-exposure-phase-11-runtime-metadata.contract.spec.ts`.

## Unified Control Plane Migration — Phase 12 (native intent metadata semantics)

Phase 12 updates `fieldExposureRuntime.nativeIntentMissing` to match the engine-authoritative model.
The flag no longer means "cutover fell back"; it means:

```text
nativeIntentMissing = true
  when no native ExposureIntent row was active
  and the engine decision selected ExposureProfile defaults
```

This makes the metadata independent from `FIELD_EXPOSURE_RUNTIME_MODE`. `mode` still records the
diagnostic runtime label for compatibility, but `nativeIntentMissing` describes the actual decision
source in every mode.

### Phase 12 exit criteria (testable)

- Shadow/profile-default dispatch records `nativeIntentMissing=true`.
- Native intent dispatch records `nativeIntentMissing=false`.
- `FieldExposureRuntimeMetadata` comments no longer describe cutover-only fallback semantics.
- Contract: `apps/api/test/field-exposure-phase-12-native-intent-metadata.contract.spec.ts`.

## Unified Control Plane Migration — Phase 13 (runtime selection metric cleanup)

Phase 13 makes runtime selection observability match the engine-authoritative model. Since Phase 7,
`FIELD_EXPOSURE_RUNTIME_MODE` no longer chooses delivered field ids, and since Phase 12
`nativeIntentMissing` is mode-independent. Therefore selection metrics must be emitted for every
dispatched exposure decision, not only for `cutover`.

```text
field_exposure_runtime_selection_total
  labels = tenant_id, event_type, provider, runtime_mode,
           selection_source, native_intent_missing
```

The historical `field_exposure_cutover_selection_total` may remain during the compatibility window,
but only as a cutover-mode compatibility metric. New dashboards should use
`field_exposure_runtime_selection_total`.

### Phase 13 exit criteria (testable)

- Shadow/profile-default dispatch increments `field_exposure_runtime_selection_total`.
- Cutover dispatch increments both the runtime-selection metric and the historical cutover metric.
- Selection metrics include `runtime_mode`, `selection_source`, and `native_intent_missing` so
  dashboards can separate diagnostic mode from selection authority.
- Dispatch behavioral coverage lives in
  `apps/api/src/integrations/application/dispatch-integration-domain-event.spec.ts`; metric label
  coverage lives in `apps/api/src/observability/metrics.spec.ts`.
- Contract: `apps/api/test/field-exposure-phase-13-runtime-selection.contract.spec.ts`.

## Control Plane UI — Phase B (stored vs effective coordinates)

Phase B makes the UI honest about what is **stored** versus what is **runtime-effective**. Admin
controls may persist `ExposureIntent.surface`, `audience`, and `trigger`, but dispatch and policy
lookup still derive the effective coordinate from the integration provider and routed event type via
`resolveIntegrationPolicyExposureCoordinate`. The control-plane read model and preview route must
call the same resolver as `IntegrationPolicyEngine`; duplicating `external_channel + eventType`
logic is not allowed because future trigger/audience normalization must appear consistently in
dispatch, preview, and operator UI.

The control plane and integration editor must therefore show both values:

```text
storedContext    = values persisted on ExposureIntent (or panel draft before save)
effectiveContext = coordinate used by IntegrationPolicyEngine / dispatch today
storedDiffersFromEffective = boolean diff across all three dimensions
coordinateControlsRuntimeEffective = true when a route-scoped native intent exists
```

After the `scope.eventType` migration, route-scoped native intents can be recovered even when their
stored trigger differs from the routed event type. The runtime coordinate therefore resolves in this
order:

```text
1. Native ExposureIntent with scope.connectionId + scope.eventType
   -> effectiveContext = intent.surface/audience/trigger
   -> coordinateControlsRuntimeEffective = true
2. Legacy native row with scope.connectionId only and default route coordinate
   -> effectiveContext = provider + event defaults
   -> coordinateControlsRuntimeEffective = false
3. No native row
   -> effectiveContext = provider + event defaults
   -> coordinateControlsRuntimeEffective = false
```

Public integration DTOs expose `routeScoped: boolean` on each `ExposureIntent` row so the web editor
can distinguish route-scoped rows from legacy connection-only rows without inferring from
`eventType === trigger`. The integration delivery panel must derive stored/effective honesty through
`resolveStoredVsEffectiveExposureContext` in `apps/web/src/exposure/exposure-field-selection.ts`,
using persisted `routeScoped` for runtime authority and draft form state for the stored column. Field
selection, template overrides, and stored coordinates are runtime-effective only when a route-scoped
native intent exists. Dispatch, preview, and control-plane reads all use the same API resolver; the
web must not hardcode `coordinateControlsRuntimeEffective: true`.

### Phase B exit criteria (testable)

- Control-plane API returns `storedContext`, `effectiveContext`, `storedDiffersFromEffective`, and
  `coordinateControlsRuntimeEffective`.
- Control-plane API, dispatch, and `GET /exposure/engine-preview` derive effective coordinates
  through the route-scoped intent resolver, falling back to `resolveIntegrationPolicyExposureCoordinate`.
- Control-plane UI renders stored and effective coordinates side by side with an explicit inactive
  label when stored values differ from effective values.
- Integration delivery panel shows the same stored/effective honesty banner, derives
  `coordinateControlsRuntimeEffective` from persisted `routeScoped`, and states that unsaved
  coordinate edits become runtime-effective only after save creates or updates a route-scoped row.
- Public exposure intent DTOs include `routeScoped` derived from `scope.eventType`.
- Pure helpers live in `apps/web/src/exposure/exposure-field-selection.ts`.
- Contract: `apps/web/test/field-exposure-phase-b-ui.contract.spec.ts`.

## Control Plane UI — Phase C (preview-primary editor client)

Phase C adds a dedicated web client for `GET /exposure/engine-preview?connectionId=&eventType=`.
Preview remains read-only: no enqueue, no persistence, no draft-mutation API.

The operator-facing `IntegrationEventDeliveryPolicyPanel` on `settings/exposure` shows only the
Telegram message preview (sample copy) and field-selection controls. Engine preview
(`samplePayload`, decision chain, applied policies) is confined to the engineering control-plane
surface (`settings/exposure/control-plane`) so admins are not exposed to internal engine diagnostics.

The control plane loads preview for the active connection/event row using the same deterministic
sample payload path as the API. The preview response includes `samplePayload` so engineering review
uses the exact fixture for the read-only engine decision.

### Phase C exit criteria (testable)

- Web BFF proxies `GET /api/exposure/engine-preview` to the API read-only preview route.
- `apps/web/src/exposure/exposure-engine-preview-client.ts` parses the API preview response,
  including `samplePayload`.
- `IntegrationEventDeliveryPolicyPanel` does **not** embed engine preview; control-plane page does.
- Parser unit coverage lives in `apps/web/test/exposure-engine-preview-client.spec.ts`.
- Contract: `apps/web/test/field-exposure-phase-c-ui.contract.spec.ts`.

### Deterministic sample payloads

| Event type | Sample payload |
| ---------- | -------------- |
| `TourCreated` | `{ "status": "published", "title": "Engine preview" }` |
| `TourPublished` | `{ "status": "published", "title": "Engine preview" }` |
| *(other)* | `{ "status": "published" }` |

These payloads are defined in `deterministic-exposure-preview-payload.ts` and shared with the control
plane read model.

## Control Plane UI — Phase D0 (simulation/diff backend foundation)

Phase D cannot start in the web UI until backend simulation and diff APIs exist. Phase D0 adds the
minimum read-only backend foundation:

```text
POST /exposure/simulate
POST /exposure/diff
POST /api/exposure/simulate  (web BFF proxy)
POST /api/exposure/diff      (web BFF proxy)
```

Both endpoints are operator-only, deterministic, and non-mutating. They resolve the same effective
coordinate as dispatch and engine preview via `resolveConnectionExposureIntentForRoute`, falling back
to `resolveIntegrationPolicyExposureCoordinate` when no route-scoped native intent exists. They use
the same deterministic sample payload as engine preview and evaluate the current field exposure
engine. D0 supports a draft `ExposureIntent` overlay (`mode`, `selectedFieldIds`, `templateOverrideId`)
applied on top of the persisted route-scoped intent (or a synthetic draft row when none exists) for
simulation only; it does not persist artifacts, promote policy sets, enqueue jobs, or claim
graph-kernel completeness.

`/exposure/diff` compares the current preview with the simulated draft preview and reports
field-level state changes plus selected-field changes. It is a backend dependency for a future Phase
D UI, not the UI phase itself.

The web layer may add BFF routes and a pure parser/fetch client for these responses, but must not add
a simulation console, publish button, or graph-policy editor until the full Phase D dependency set is
available.

### Phase D0 exit criteria (testable)

- `exposure-simulation.service.ts` builds simulation results through the same deterministic engine
  preview path, resolves route-scoped effective coordinates through
  `resolveConnectionExposureIntentForRoute`, and returns `samplePayload`.
- `POST /exposure/simulate` and `POST /exposure/diff` are registered in `exposure.routes.ts` and
  `app.ts`.
- Web BFF routes proxy `POST /api/exposure/simulate` and `POST /api/exposure/diff` without adding UI
  affordances.
- Diff output is field keyed and deterministic; no persistence repository upsert is called.
- Contracts: `apps/api/test/field-exposure-phase-d0-simulation.contract.spec.ts`,
  `apps/web/test/field-exposure-phase-d0-simulation-client.contract.spec.ts`.

## Control Plane UI — Phase D (simulation console)

Phase D adds the operator-facing **simulation console** on top of the Phase D0 backend foundation and
Phase C preview client. Operators draft field-selection changes against the persisted route, run a
deterministic diff against current runtime, and inspect field-level state changes **without**
persisting an `ExposureIntent`, enqueueing delivery, or exposing a publish button.

```text
settings/exposure/simulate
  -> draft ExposureFieldChecklist (local state only)
  -> POST /api/exposure/diff { connectionId, eventType, draftIntent }
  -> render fieldChanges + selectedFieldIdsAdded/Removed
```

The console reuses the same draft overlay semantics as `exposure-simulation.service.ts`:
`mode: inherit_profile | override_fields`, `selectedFieldIds`, optional `templateOverrideId`.
Template override remains out of scope in the first console slice; field checklist + mode mirror the
integration delivery panel.

Navigation:

- `settings/exposure` links to the simulation console alongside the read-only control plane.
- The console links back to field exposure settings; it does not replace the integration editor save
  path.

### Phase D exit criteria (testable)

- `apps/web/app/(app)/settings/exposure/simulate/page.tsx` renders the simulation console for
  operator sessions with workspace context.
- `apps/web/src/exposure/ExposureSimulationConsole.tsx` loads connection/event context, builds a
  local draft intent, and calls `fetchExposureSimulationDiff` from `exposure-simulation-client.ts`.
- Diff output renders changed field states and selected-field deltas; no `patchExposureIntent` or
  other persistence client is invoked from the console.
- Exposure settings expose a navigation affordance to the simulation console.
- Contract: `apps/web/test/field-exposure-phase-d-ui.contract.spec.ts`.

---

## Denali multi-surface exposure — completion contract

Denali is the first workspace to consume the Field Exposure Engine on **product surfaces**
beyond integration delivery. Exposure coordinates use workspace-owned surface names; FieldPolicy
rules map through `mapDenaliExposureSurfaceToFieldPolicySurface()`:

| Exposure surface | Audience | Trigger | FieldPolicy surface | Consumer |
| ---------------- | -------- | ------- | ------------------- | -------- |
| `telegram` | `external_channel` | `TourCreated` (event) | `delivery` | Integration dispatch |
| `public_list` | `public` | `always` | `public_website` | `GET /denali/catalog` |
| `public_details` | `public` | `always` | `public_website` | `GET /denali/catalog/:tourId` |
| `user_dashboard` | `registered_user` | `tour_dashboard_view` (event) | `profile` | `GET /denali/dashboard/tours/:tourId` |
| `reminder_feed` | `registered_user` | `relative_time(startDateTime, -48h\|-24h)` | `profile` | `GET /denali/reminders/feed` |

### Boundary rules

- `@app-tour/workspace-denali` declares surfaces, default field ids, catalog redaction bindings,
  and HTTP consumers. It depends on host-injected ports only:
  - `DenaliExposureResolverPort` — resolved in `apps/api` via `resolveDenaliSurfaceVisibleFieldIds`
  - `DenaliReminderFeedPort` — reads `denali_exposure_reminder_activations`
- Denali must **not** import `apps/api` internals. Host wiring lives in
  `configure-product-http-hosts.ts`.
- `@app-tour/workspace-urban` declares `public_list` / `public_details` surfaces, catalog redaction
  bindings (`applyUrbanCatalogCardExposure`), and HTTP consumers via `UrbanExposureResolverPort`
  (`resolveUrbanSurfaceVisibleFieldIds` in `apps/api`). Host wiring:
  `configure-product-http-hosts.ts` → `buildUrbanExposureResolverPort`.

### Relative-time reminder scheduler

- Background worker: `startDenaliExposureReminderSchedulerIfEnabled()` (opt-in via
  `DENALI_EXPOSURE_REMINDER_SCHEDULER_ENABLED=true`).
- Scans published Denali tours by canonical `startDateTime`; creates idempotent rows in
  `denali_exposure_reminder_activations` for `-48h` and `-24h` offsets.
- Reminder feed consumer resolves exposure with normalized trigger
  `{ kind: "relative_time", anchor: "startDateTime", offset }`.

### Admin UI

- `settings/exposure` renders `DenaliWorkspaceSurfacesPanel` when `workspaceType === "denali"`.
- Non-Telegram surfaces persist via `PATCH /workspaces/:id/exposure/surfaces/:surface` into native
  `ExposureIntent` rows scoped with `{ tourSurface: surface }`.

### Denali completion exit criteria (testable)

- Surface definitions exported from `@app-tour/workspace-denali/exposure` match the table above.
- FieldPolicy manifest seeds `delivery`, `public_website`, and `profile` visible rules.
- Public catalog/detail routes apply `applyDenaliCatalogCardExposure` after resolver lookup.
- Dashboard and reminder feed routes require registered auth and apply independent coordinates.
- Reminder scheduler creates idempotent activation rows; feed lists exposure-filtered cards.
- Workspace surface PATCH + admin panel round-trip without integration connection scope.
- Contracts:
  - `apps/api/test/field-exposure-denali-multi-surface.contract.spec.ts`
  - `packages/workspaces/denali/test/denali-exposure-surfaces.spec.ts`
  - `packages/workspaces/denali/test/denali-catalog-exposure.spec.ts`
  - `apps/web/test/field-exposure-denali-surfaces-ui.contract.spec.ts`
