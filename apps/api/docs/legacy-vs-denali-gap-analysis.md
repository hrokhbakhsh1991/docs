---
title: Legacy Tour Ops vs Denali (apps/api) — Gap Analysis
audit_date: 2026-06-05
delta_audit_date: 2026-06-05
---

# Legacy vs Denali gap analysis

**Audit date:** 2026-06-05  
**Delta-Audit synthesis:** 2026-06-05  
**Scope:** `legacy/` (frozen Tour Ops monorepo) compared with `apps/api/` (Denali platform API).  
**Method:** Evidence from source and phase audits only — no inferred features.

## Delta-Audit — Executive Synthesis

Cross-domain rollup after schema, API, observability, config, resilience, and scalability audits. **Migration posture** = recommended sequencing, not a ship/no-ship verdict.

| Domain                   |                                     Gap count | Highest severity                            | Migration posture                                                                              |
| ------------------------ | --------------------------------------------: | ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Schema / data**        |         36 absent tables + 4 partial overlaps | **P0** (Critical)                           | Phase 6+ per domain (identity → settings → bookings → finance); no lift-and-shift              |
| **Security / auth**      |                            14 capability gaps | **P0**                                      | Phase 6+ identity service or port `legacy/.../auth/`; ingress verify-only is intentional today |
| **Tours (HTTP API)**     |                          9 route/surface gaps | **P1**                                      | Incremental on Denali kernel: list → lifecycle → media → registrations when schema lands       |
| **Observability**        |                        8 trace/audit/log gaps | **P0** (prod forensics)                     | Close Phase 2 Must-Fix before prod; DEC-007 limits audit scope by design                       |
| **Config sync**          |                           7 client/admin gaps | **P1**                                      | Unify resolver + extend theme contract (Phase 4.4); `enabled_modules` with identity phase      |
| **Error handling**       |                               2 residual gaps | **P2**                                      | Mostly parity or improvement (opaque 500/503); internal-route bypass minor                     |
| **Rate / capacity**      |                            6 scalability gaps | **P1**                                      | Phase 3 debt + Redis in prod; auth-route limits when login returns                             |
| **Bulk / batch**         |                             3 import/job gaps | **P1**                                      | Job API + victim SLO specs; no legacy HTTP `/bulk-import` to port verbatim                     |
| **Proxy / integrations** | 10 missing integrations + 2 latent proxy gaps | **P0** (PSP/webhooks) / **P1** (proxy hang) | Port `egress-url` + finance webhooks; harden `TenantHttpProxy` before map routes               |
| **UX regression (web)**  |                           5 shell/wizard gaps | **P1**                                      | Denali web theme-only fetch; full `TenantConfigProvider` after API contract                    |

**Net assessment:** Denali is a **Phase 5 tour kernel** with stronger isolation, opaque errors, and canonical SoT. Legacy is a **full SaaS surface**. Gaps cluster into (a) **deferred product domains** (finance, registrations, identity), (b) **kernel hardening** (trace, audit driver, rate-limit DoS), and (c) **incremental tour API** completion. Do not treat schema absence as accidental regression without checking [Intentionally-Removed](#intentionally-removed).

---

## Table of contents

| Section                                                                                   | Topic                                 |
| ----------------------------------------------------------------------------------------- | ------------------------------------- |
| [Delta-Audit — Executive Synthesis](#delta-audit--executive-synthesis)                    | Cross-domain rollup                   |
| [Completeness checklist](#completeness-checklist)                                         | Domain coverage gate                  |
| [Schema gap (data model)](#schema-gap-data-model)                                         | Prisma vs TypeORM inventory           |
| [Security / Auth gap](#security--auth-gap)                                                | Login, JWT, membership                |
| [Tours gap (HTTP API)](#tours-gap-http-api)                                               | Routes, clone, media, registrations   |
| [Tour Business Logic Gap](#tour-business-logic-gap)                                       | Rules, lifecycle, validation ordering |
| [Observability gap](#observability-gap)                                                   | Trace, audit, metrics, logs           |
| [Config sync gap](#config-sync-gap)                                                       | Tenant config, flags, hot reload      |
| [Error handling gap](#error-handling-gap)                                                 | Tenant-facing responses               |
| [Rate / capacity gap](#rate--capacity-gap)                                                | Limiters, pool, noisy neighbor        |
| [Bulk Import / Export & Batch Processing Gap](#bulk-import--export--batch-processing-gap) | Import storms, export, outbox batches |
| [Proxy & Third-Party Integration Gap](#proxy--third-party-integration-gap)                | Outbound HTTP, PSP, webhooks, BFF     |
| [UX regression gap](#ux-regression-gap)                                                   | Web shell vs legacy BFF               |
| [Need-to-Port](#need-to-port)                                                             | Prioritized migration tickets         |
| [Intentionally-Removed](#intentionally-removed)                                           | Deliberate drops / replacements       |
| [Open Questions / Verify with Product](#open-questions--verify-with-product)              | Ambiguous items                       |
| [Denali-only additions](#denali-only-additions-inverse-gap)                               | Additive kernel features              |
| [Migration & product implications](#migration--product-implications)                      | Cutover notes                         |
| [Methodology](#methodology)                                                               | Inventory rules                       |
| [Legacy entity index](#legacy-entity-index-full-absent-list)                              | Full absent list                      |
| [Document history](#document-history)                                                     | Changelog                             |

---

## Completeness checklist

All mandated domains reviewed with evidence anchors in this document or cited phase audits.

| Domain               | Covered? | Primary section                                                                   | Evidence anchor                                     |
| -------------------- | -------- | --------------------------------------------------------------------------------- | --------------------------------------------------- |
| Schema / data        | Yes      | [Schema gap](#schema-gap-data-model)                                              | `schema.prisma`; 42 legacy entities                 |
| Security / auth      | Yes      | [Security / Auth](#security--auth-gap)                                            | `legacy/.../auth.controller.ts`; `tenant-kernel.ts` |
| Tours                | Yes      | [Tours gap](#tours-gap-http-api), [Tour Business Logic](#tour-business-logic-gap) | `tours.controller.ts`; `canonical-tour.service.ts`  |
| Observability        | Yes      | [Observability](#observability-gap)                                               | `phase2-paranoid-audit.md`; DEC-007                 |
| Config sync          | Yes      | [Config sync](#config-sync-gap)                                                   | `tenant-config.routes.ts`; legacy `TenantConfig`    |
| Error handling       | Yes      | [Error handling](#error-handling-gap)                                             | `error-interceptor.ts`; phase0 E-01                 |
| Rate / capacity      | Yes      | [Rate / capacity](#rate--capacity-gap)                                            | `tenant-rate-limiter.ts`; phase3 NN/RL              |
| Bulk / batch         | Yes      | [Bulk / batch](#bulk--batch-gap)                                                  | `bulk-import-consistency.spec.ts`                   |
| Proxy / integrations | Yes      | [Proxy & Third-Party Integration Gap](#proxy--third-party-integration-gap)        | `egress-url`, `tenant-http-proxy.ts`; phase4 PI-01  |

---

## Schema gap (data model)

Denali Prisma (`apps/api/prisma/schema.prisma`) defines platform tour storage only. Legacy identity, bookings, finance, and workspace settings persistence are absent.

| Metric                        | Legacy (Tour Ops)                              | Denali (`apps/api`)                                 | Gap severity                                          |
| ----------------------------- | ---------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| Persisted models / tables     | **42**                                         | **6**                                               | **Critical** — 36 tables entirely absent              |
| Overlapping table names       | 4 (`tenants`, `tours`, `outbox_events`, audit) | 4                                                   | **High** — shared names, materially different columns |
| Identity / auth tables        | 7                                              | 0                                                   | **Critical**                                          |
| Booking / registration tables | 3                                              | 0                                                   | **Critical**                                          |
| Finance / payments tables     | 10                                             | 0                                                   | **Critical**                                          |
| Workspace settings tables     | 7                                              | 0                                                   | **High**                                              |
| Denali-only models            | 0                                              | 2 (`HttpIdempotencyRecord`, `ProcessedDomainEvent`) | Additive                                              |

### Data gap by domain (legacy → Denali)

**Absent** = no Denali model. **Partial** = table exists but columns, relations, or constraints differ.

#### Tenants & routing

| Legacy model               | Table                   | Denali status | Notes                                |
| -------------------------- | ----------------------- | ------------- | ------------------------------------ |
| `TenantEntity`             | `tenants`               | **Partial**   | See [Tenant fields](#tenant-tenants) |
| `TenantCustomDomainEntity` | `tenant_custom_domains` | **Absent**    | White-label FQDN mapping             |
| `TenantPlanLimitsEntity`   | `tenant_plan_limits`    | **Absent**    | Plan tier caps                       |
| `TenantUsageDailyEntity`   | `tenant_usage_daily`    | **Absent**    | Daily metering                       |

#### Identity, membership & auth

| Legacy model                   | Table                       | Denali status |
| ------------------------------ | --------------------------- | ------------- |
| `UserEntity`                   | `users`                     | **Absent**    |
| `UserTenantEntity`             | `user_tenants`              | **Absent**    |
| `WorkspaceInviteEntity`        | `workspace_invites`         | **Absent**    |
| `EmailVerificationTokenEntity` | `email_verification_tokens` | **Absent**    |
| `UserRoleAuditEntity`          | `user_role_audit`           | **Absent**    |
| `MobileOtpChallengeEntity`     | `mobile_otp_challenges`     | **Absent**    |

#### Tours & catalog

| Legacy model                   | Table                       | Denali status | Notes                                           |
| ------------------------------ | --------------------------- | ------------- | ----------------------------------------------- |
| `TourEntity`                   | `tours`                     | **Partial**   | Canonical JSON SoT — [Tour fields](#tour-tours) |
| `TourDetails`                  | `tour_details`              | **Absent**    | Normalized itinerary / trip_details             |
| `TourProductEntity`            | `tour_products`             | **Absent**    | Product vs departure split                      |
| `TourDepartureEntity`          | `tour_departures`           | **Absent**    | Bookable inventory + capacity                   |
| `TourPriceEntity`              | `tour_prices`               | **Absent**    | Typed price tiers                               |
| `PendingStorageDeletionEntity` | `pending_storage_deletions` | **Absent**    | Clone saga / storage cleanup                    |

#### Workspace settings, registrations, payments, draft, safety

All legacy tables in these domains are **Absent** in Denali (7 settings, 3 registration, 10 finance/payment, 2 draft, 2 safety/PII). See [Legacy entity index](#legacy-entity-index-full-absent-list).

#### Events, audit & idempotency

| Legacy model             | Table                 | Denali status   | Notes                                               |
| ------------------------ | --------------------- | --------------- | --------------------------------------------------- |
| `OutboxEventEntity`      | `outbox_events`       | **Partial**     | Status enum vs string; missing retry fields         |
| `TenantAuditEventEntity` | `tenant_audit_events` | **Partial**     | Renamed/simplified `audit_events`                   |
| `IdempotencyKeyEntity`   | `idempotency_keys`    | **Partial**     | Denali `HttpIdempotencyRecord` — POST `/tours` only |
| —                        | —                     | **Denali-only** | `ProcessedDomainEvent`                              |

### Per-model field comparison (overlapping tables)

#### Tenant (`tenants`)

| Legacy field                                                                                    | In Denali?      | Notes                              |
| ----------------------------------------------------------------------------------------------- | --------------- | ---------------------------------- |
| `id`, `subdomain`, `created_at`                                                                 | Yes             |                                    |
| `name`, `description`, `enabled_modules`, `operating_currency_code`, `updated_at`, `deleted_at` | **No**          |                                    |
| —                                                                                               | **Denali-only** | `workspaceType`, `status`, `theme` |

#### Tour (`tours`)

Legacy uses normalized columns + `tour_details` child. Denali uses `canonical_data` JSON + `row_version`.

| Legacy field                                                                                                  | In Denali?      | Notes                                             |
| ------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------- |
| `id`, `tenant_id`, `title`, `created_at`                                                                      | Yes             |                                                   |
| `lifecycle_status`, capacity counters, `destination_id`, pricing denorm, `form_profile_snapshot`, soft delete | **No**          | May exist only inside `canonical_data`            |
| —                                                                                                             | **Denali-only** | `canonical_data`, `schema_version`, `row_version` |

#### Audit (`tenant_audit_events` → `audit_events`)

| Legacy field                                                  | In Denali? | Notes                                  |
| ------------------------------------------------------------- | ---------- | -------------------------------------- |
| `tenant_id`, `action`, `metadata`                             | Yes        |                                        |
| `actor_user_id`                                               | Partial    | `actor_id` (string, nullable)          |
| `resource_type` / `resource_id`                               | Partial    | `entity_type` / `entity_id`            |
| `actor` display, `user_id` subject, `client_ip`, `request_id` | **No**     | Forensics regression vs legacy exports |

#### Constraints & DB behavior (summary)

- Legacy PostgreSQL enums (`tour_lifecycle_status_enum`, registration/payment enums, …) — **not replicated**; Denali uses `String`.
- Denali adds: RLS on kernel tables, audit append-only trigger, outbox partial index, optimistic `row_version`.
- Legacy soft delete (`deleted_at` on `BaseTenantEntity`) — **not modeled** in Denali.

---

## Security / Auth gap

### Requirements matrix (selected)

| Legacy capability                           | Evidence (legacy)                         | Denali                                           | Status                   |
| ------------------------------------------- | ----------------------------------------- | ------------------------------------------------ | ------------------------ |
| Phone OTP request/login                     | `auth.controller.ts` L92–184              | No auth routes — `app.ts` L22–67                 | **Dropped**              |
| OTP challenge store (5 min, single-use)     | `otp.service.ts`; `mobile_otp_challenges` | Not in Prisma                                    | **Dropped**              |
| Telegram / workspace session / JWT issuance | `auth.controller.ts` L194–309             | None                                             | **Dropped**              |
| JWT verify (RS256)                          | `auth.middleware.ts`                      | `parse-jwt-bearer.ts`                            | **Parity** (verify-only) |
| Session revocation (`sess_ver`)             | `auth-membership-verification.ts` L99–119 | Not in `mapJwtPayload`                           | **Dropped**              |
| DB membership hydration                     | `verifyActiveMembershipAndHydrateContext` | `workspace-membership.ts` stub (prefix denylist) | **Dropped**              |
| Cookie session transport                    | `auth.middleware.ts` L168–195             | Bearer / headers only                            | **Dropped**              |
| CASL / RBAC                                 | `AbilitiesGuard`, `RolesGuard`            | `api-ability.ts` (workspace-sdk)                 | **Partial**              |
| Auth route rate limits                      | `tenant-rate-limit.service.ts` L230–235   | N/A (no auth routes)                             | **Dropped**              |
| Production bearer required                  | Protected routes middleware               | `tenant-kernel.ts`; DEC-023                      | **Parity**               |

**OTP finding:** Legacy returns `delivery: "dev_static"` only (`auth.service.ts` L215–217); production verify fails closed without dev flag (`otp.service.ts` L56–62). Denali omits OTP entirely — **intentional deferral**, not production SMS regression.

### Severity table

| Gap                                      | Severity | Risk                                                                     |
| ---------------------------------------- | -------- | ------------------------------------------------------------------------ |
| No login / OTP / session issuance API    | **P0**   | Cannot ship end-user auth on Denali alone                                |
| No `users` / `user_tenants` persistence  | **P0**   | No membership truth for revocation                                       |
| Session revocation (`sess_ver`)          | **P1**   | Stolen JWT valid until `exp`                                             |
| DB-backed membership on request          | **P1**   | Role/tenant drift vs DB undetected                                       |
| Host ↔ JWT tenant alignment              | **P1**   | Cross-tenant token reuse on wrong host                                   |
| Staging auth = production policy gap     | **P1**   | `isProductionAuthMode()` only checks `NODE_ENV===production` — CI-BYP-44 |
| Cookie BFF session                       | **P2**   | Web must use gateway JWT or headers                                      |
| OTP abuse throttling (when auth returns) | **P2**   | No auth routes today                                                     |
| JWT `caps` / CASL hydration from DB      | **P2**   | Static workspace-sdk rules only                                          |

---

## Tours gap (HTTP API)

Legacy Nest `ToursController` (`legacy/apps/api/src/modules/tours/tours.controller.ts`) vs Denali `tours.routes.ts` + `app.ts` dispatch.

| Capability                        | Legacy route                                      | Denali                               | Status                               |
| --------------------------------- | ------------------------------------------------- | ------------------------------------ | ------------------------------------ |
| Create tour                       | `POST /api/v2/tours` + required `Idempotency-Key` | `POST /tours` (optional idempotency) | **Partial**                          |
| Update tour                       | `PATCH /api/v2/tours/:id` + required idempotency  | `PATCH /tours/:id`                   | **Partial**                          |
| Get by id                         | `GET /api/v2/tours/:id`                           | `GET /tours/:id`                     | **Parity** (path prefix differs)     |
| List + pagination + status filter | `GET /api/v2/tours`                               | None                                 | **Dropped**                          |
| Lifecycle status only             | `PATCH /api/v2/tours/:id/status`                  | None (generic PATCH only)            | **Dropped**                          |
| Photo upload/delete               | `POST/DELETE .../photos`                          | None                                 | **Dropped**                          |
| Tour registrations list           | `GET .../registrations`                           | None                                 | **Dropped** (no registration schema) |
| Waitlist list                     | `GET .../waitlist-items`                          | None                                 | **Dropped**                          |
| Headless clone                    | `ToursCloneService` (service, not always HTTP)    | None                                 | **Dropped**                          |
| Delete tour                       | Not on controller                                 | None                                 | **N/A** (both lack soft-delete HTTP) |

**Denali tour kernel strengths (not legacy parity gaps):** canonical SoT, `row_version` optimistic locking, `TourCreated` outbox co-commit, RLS-scoped reads, theme-driven validation flag (`advancedRuleEngine`).

**Patch pipeline:** Legacy enforces `assertTourPatchWritePreMerge`, wire contract Zod, field policy by role — Denali validates via canonical service + workspace plugin; CASL field-level policy not ported.

---

---

## Tour Business Logic Gap

Denali Phase 5 ships a **canonical write kernel** (`CanonicalTourService` + `PlatformWizardEngine`) with a **starter** workspace plugin only. Legacy Tour Ops retains a **flat DTO tour model**, **Postgres lifecycle FSM**, **profile-specific workspace strategies** (Denali pilot / mountain / general), and **server-side publish gates** beyond HTTP route inventory in [Tours gap (HTTP API)](#tours-gap-http-api). Business-rule parity is **Partial** at best for starter-shaped tours; Denali-specific and operational rules are **Dropped** or **Deferred** to Phase 6+.

### Requirements / rules matrix

| Legacy rule                                                     | Denali coverage                                                                      | Status                           | Legacy evidence                                                                                      | Denali evidence                                                        | Severity    | Remediation hint                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| Tour lifecycle FSM (`DRAFT` → `OPEN` → `CLOSED` / `CANCELLED`)  | No `lifecycle_status` column; starter field `details.status` is plugin metadata only | **Dropped**                      | `legacy/packages/shared/rbac/tour-lifecycle-governance.ts` L15–26; `tour-lifecycle.policy.ts` L55–74 | `schema.prisma` L27–41; `starter-plugin-core.ts` L64–69, L112–116      | **P0**      | Port lifecycle to plugin + projection; reuse legacy matrix  |
| Publish = `DRAFT → OPEN` with readiness gates                   | No publish transition; create/update persist validated canonical blob                | **Dropped**                      | `tour-lifecycle.policy.ts` L92–120; `assert-tour-publish-transition.ts` L88–127                      | `canonical-tour.service.ts` L56–108, L158–200                          | **P0**      | Publish use-case with pre/post-merge gates                  |
| Lifecycle transition validation                                 | —                                                                                    | **Dropped**                      | `tour-lifecycle.policy.ts` L55–74; `tours.service.ts` L1018–1024                                     | —                                                                      | **P0**      | Wire `isTourLifecycleTransitionAllowed` or plugin lifecycle |
| Create relaxed on DRAFT; strict on OPEN/publish                 | Single validation path for all creates                                               | **Partial**                      | `tours.service.ts` L787–788, L884–892                                                                | `canonical-validation.ts` L95–139                                      | **P1**      | RuleContext `draft` vs `publish` cells                      |
| Workspace rules (`denali_pilot`, `mountain_outdoor`, `general`) | **`starter` plugin only**; `denali` unbound                                          | **Dropped**                      | `workspace.strategy.registry.ts`; `mountain-outdoor.workspace.strategy.ts` L45–66                    | `resolve-workspace-plugin.ts` L18–30; `workspaces/denali/README.md` L9 | **P0**      | Phase 6 denali plugin per `MIGRATION-MAP.md`                |
| Trip-details cross-field rules (fuel share, group size, HH:mm)  | Starter: 4 fields; noop validation hooks                                             | **Dropped**                      | `assert-create-tour-invariants.ts` L58–118, L461–493                                                 | `starter-plugin-core.ts` L38–71, L127                                  | **P0**      | Port denali-domain into plugin RuleSet                      |
| Publish geolocation zones (Denali pilot)                        | —                                                                                    | **Dropped**                      | `assert-tour-publish-transition.ts` L47–58                                                           | —                                                                      | **P1**      | Plugin validation hook                                      |
| Profile required submit + edit presets for publish              | Starter `required` on `basics.title` only                                            | **Partial**                      | `assert-profile-required-fields-for-submit.ts`                                                       | `starter-plugin-core.ts` L84–89                                        | **P1**      | Expand RuleSet matrix                                       |
| Form-profile field strip                                        | No server strip pipeline                                                             | **Dropped**                      | `create-tour-form-profile-strip.ts`; `tours.service.ts` L784                                         | —                                                                      | **P1**      | Strip in pre-TX validation                                  |
| Per-tour `total_capacity` + ≥ accepted count                    | Tenant/global **row count** cap in TX                                                | **Partial**                      | `assert-create-tour-invariants.ts` L417–425; `tours.service.ts` L1003–1010                           | `assert-tour-capacity-in-tx.ts` L7–28                                  | **P1**      | Separate registration capacity from catalog caps            |
| Paid tour amount required before OPEN                           | No `cost_context` checks                                                             | **Dropped**                      | `assert-requires-payment-cost.ts` L35–53; `tours.service.ts` L1215–1220                              | —                                                                      | **P1**      | Finance plugin root                                         |
| Catalog ref integrity (themes, leaders)                         | —                                                                                    | **Dropped**                      | `tours.service.ts` L838–839, L1173–1174                                                              | —                                                                      | **P1**      | Ref validation in plugin / catalog API                      |
| Staging shell / clone / preset create                           | Plain create only                                                                    | **Dropped**                      | `tours.service.ts` L842–855, L896–901                                                                | `canonical-tour.service.ts` L56–108                                    | **P2**      | Phase 6 use-cases                                           |
| Body-aware CASL (`TourCore`, `Publish`)                         | Coarse read/create/update                                                            | **Partial**                      | `assert-tour-mutation-abilities.ts` L52–70                                                           | `api-ability.ts` L28–32                                                | **P2**      | Extend workspace-sdk authz                                  |
| Idempotency on create                                           | **Parity**                                                                           | **Parity**                       | `tours.controller.ts` L88–93                                                                         | `tours.routes.ts` L28–56                                               | —           | —                                                           |
| Audit on create                                                 | `tour.create_*` variants                                                             | `TOUR_CREATED` same TX (DEC-007) | `tours.service.ts` L902–916                                                                          | `atomic-canonical-tour-persist.ts` L77–81                              | **Partial** | Enrich when lifecycle exists                                |
| Audit on update / publish                                       | `tour.patch` / `tour.publish`                                                        | None on PATCH                    | `tours.service.ts` L1262–1273                                                                        | AUDIT-GAP-02                                                           | **P1**      | DEC-007 extension                                           |
| Client Denali wizard rule engine                                | Server `PlatformWizardEngine`                                                        | **Partial**                      | `legacy/apps/web/.../submit-orchestrator.ts` L3–26                                                   | `canonical-validation.ts` L129–132                                     | **P1**      | RuleSet parity contract tests                               |
| Optimistic concurrency                                          | Legacy PATCH without row version                                                     | `rowVersion` required            | —                                                                                                    | `update-tour.schema.ts` L7                                             | **Partial** | Document client contract                                    |

### Status transitions

Legacy **`tour_lifecycle_status_enum`**. Product publish = **`DRAFT → OPEN`** only.

| From        | To               | Legacy allowed | Denali   |
| ----------- | ---------------- | -------------- | -------- |
| `DRAFT`     | `OPEN`           | Yes (publish)  | **None** |
| `DRAFT`     | `CANCELLED`      | Yes            | **None** |
| `OPEN`      | `CLOSED`         | Yes            | **None** |
| `OPEN`      | `CANCELLED`      | Yes            | **None** |
| `CLOSED`    | `CANCELLED`      | Yes            | **None** |
| `OPEN`      | `DRAFT`          | No             | —        |
| `CLOSED`    | `OPEN` / `DRAFT` | No             | —        |
| `CANCELLED` | `DRAFT` / `OPEN` | No             | —        |

Starter plugin declares `DRAFT → OPEN` (`starter-plugin-core.ts` L112–116) but API does **not** enforce it. Canonical enum `details.status`: `draft` | `open` | `published` (L64–69) — different from legacy and from list buckets `active` / `completed` / `archived` (`list-tours-query.dto.ts` L31–35).

### Validation ordering

#### Legacy — create

1. `assertTourCreateWritePreMerge` — `tours.controller.ts` L94–99
2. Profile resolve + strip — `tours.service.ts` L781–788
3. `assertCreateTourInvariants` (relaxed if DRAFT) — L785–788
4. Catalog / leader refs — L838–839
5. If `OPEN`: payment + `assertTourStateReadyForOpenOnCreate` — L884–892
6. TX persist + audit — L894–918

#### Legacy — update / publish

1. `assertTourPatchWritePreMerge` — `tours.controller.ts` L160–174
2. Capacity vs `acceptedCount` — `tours.service.ts` L1003–1010
3. If `DRAFT → OPEN`: `assertTourPublishableBeforePatch` — L1018–1022
4. `assertValidLifecycleTransition` — L1023–1024
5. Merge + tripDetails validation — L1026–1190
6. If effective `OPEN`: payment check — L1215–1220
7. If publish: `assertTourStateReadyForOpenAfterPatch` — L1222–1241
8. Persist + reservation sync + audit — L1243–1273

#### Denali — create / update

1. Auth + Zod — `tours.routes.ts` L18–94
2. `validationVariant` from feature flags — `tours.service.ts` L26–27, L51–52
3. `runPreTransactionValidation` → `runScheduledValidation` (DEC-016) — `pre-transaction-validation.ts` L27–50; `validation-scheduler.ts` L136–151
4. `validateCanonicalBeforePersist` (RULE-003) — `canonical-validation.ts` L95–139
5. Pre-TX gate open — `pre-transaction-validation.ts` L36–37
6. Create: `consumePreTransactionValidationGate` + atomic TX — `with-canonical-transaction.ts` L22–23; `atomic-canonical-tour-persist.ts` L64–98
7. Gate cleared in `finally` — `canonical-tour.service.ts` L105–107

#### Ordering comparison

| Stage                   | Legacy                                      | Denali                                       |
| ----------------------- | ------------------------------------------- | -------------------------------------------- |
| Pre-persist validation  | Profile invariants + optional publish gates | **Always** full canonical validation         |
| Async validation queue  | None                                        | Scheduler queues CPU; completes before TX    |
| Post-merge publish gate | Yes on `DRAFT → OPEN`                       | **None**                                     |
| Post-persist validation | None                                        | `validateCanonicalLegacySync` on create only |

Anchor: `test/validate-before-persist-ordering.spec.ts` L26–65.

### Severity summary

| Severity     | Gaps                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------- |
| **P0**       | No lifecycle/publish; denali/mountain rules not ported; starter-only plugin              |
| **P1**       | Trip-details, geolocation, paid-tour, draft-vs-publish split, update audit, catalog refs |
| **P2**       | Staging/clone; coarse CASL                                                               |
| **Deferred** | Registrations, Redis capacity reservation                                                |

### Cross-reference — phase audits

| Artifact                                                                                                           | Relevance                               |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| [`phase0-audit-report.md`](phase0-audit-report.md)                                                                 | RULE-003; pre-TX gate (DEC-026)         |
| [`phase2-paranoid-audit.md`](phase2-paranoid-audit.md)                                                             | AUDIT-GAP-02; DEC-007 create-only audit |
| [`phase3-scalability-stress-audit.md`](phase3-scalability-stress-audit.md)                                         | Validation scheduler; list deferred     |
| [`phase4-resilience-audit.md`](phase4-resilience-audit.md)                                                         | Validation variant pinned (DEC-014)     |
| [`docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md`](../../docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md) | DEC-007, DEC-016, DEC-014               |

```bash
pnpm --filter @apps/api test -- test/validate-before-persist-ordering.spec.ts test/5.2-plugin-validation.spec.ts test/1-functional/validation-gate-concurrency.spec.ts
```

---

## Observability gap

Source: [`phase2-paranoid-audit.md`](phase2-paranoid-audit.md), DEC-007, phase3/4 cross-refs.

| ID                 | Gap                                                                | Severity      | Legacy                                | Denali                                                 |
| ------------------ | ------------------------------------------------------------------ | ------------- | ------------------------------------- | ------------------------------------------------------ |
| **TRACE-REGEN-01** | Double `resolveTraceIdFromHeaders` — DB vs error correlation split | **P0**        | Single Nest request context           | `app.ts` + `bind-request-context.ts`                   |
| **AUDIT-GAP-01**   | Memory driver skips `audit_events`                                 | **P0** (prod) | DB audit on mutations                 | `STORAGE_DRIVER=memory` default without `DATABASE_URL` |
| **LOG-V-01**       | Production `console.error` on shutdown                             | **P0**        | Structured Nest logging               | `graceful-shutdown.ts:69`                              |
| **AUDIT-GAP-02**   | No audit on `PATCH /tours`                                         | **P1**        | `tenant_audit_events` on many actions | `TOUR_CREATED` only (DEC-007)                          |
| **TRACE-LOST-01**  | Access logs missing `traceId`                                      | **P1**        | Request tracing middleware            | `logHttpRequest`                                       |
| **TRACE-LOST-03**  | Outbox rows lack HTTP correlation                                  | **P1**        | `correlation_id` on outbox            | Not passed from tour create enqueue                    |
| **AUDIT-GAP-03**   | Tenant provision unlogged                                          | **P2**        | Workspace audit patterns              | Internal provision only                                |
| **MET-API-01**     | Unlabeled metrics guard                                            | **P2**        | Billing metrics                       | CI lint gap                                            |

**Strengths (Denali ≥ legacy):** Opaque 500/503 (**ERR-PASS-01**); append-only `audit_events` trigger; tenant-labeled metrics (**MET-OK-01**); ALS cleanup verified.

---

## Config sync gap

**Verdict:** **Partial** — Denali `GET /api/v2/tenant-config` (theme + `workspaceType`) vs legacy full `@repo/core` `TenantConfig` (layout, nav, `features.modules`).

| Legacy capability                    | Evidence (legacy)                          | Denali                                                                 | Status          |
| ------------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------- | --------------- |
| Rich `TenantConfig` wire model       | `tenant-config.ts` L74–80                  | `{ tenantId, subdomain, workspaceType, theme }` only                   | **Partial**     |
| `enabled_modules` + owner PATCH      | `workspace-settings-modules.controller.ts` | Not in Prisma                                                          | **Dropped**     |
| Redis host resolver cache (60s)      | `tenant-host-resolver.service.ts`          | 5s in-process registry                                                 | **Partial**     |
| BFF + React Query client sync        | `tenant-config-provider.tsx`               | RSC theme fetch only — `fetch-tenant-theme.server.ts`                  | **Partial**     |
| Per-tenant feature flags in API body | `features.flags` arbitrary                 | `advancedRuleEngine` tour-only; stripped from config API (**FF-F-03**) | **Partial**     |
| Theme-driven rate limit RPS          | Separate auth/tour limits                  | `tenant-rate-limiter.ts` + `theme.rateLimitRps`                        | **Denali-only** |
| Dev provisioning                     | Legacy scripts                             | `POST /internal/tenants/provision` (dev guard)                         | **Partial**     |

**Consistency risks:** **CFG-01** split read paths (cached config vs uncached flags on `POST /tours`); **CFG-02** `featureFlags` omitted from public config response.

---

## Error handling gap

| Dimension                       | Legacy                   | Denali                                            | Status                       |
| ------------------------------- | ------------------------ | ------------------------------------------------- | ---------------------------- |
| Opaque 500 for unhandled faults | Variable Nest filters    | `error-interceptor.ts` L187–190 — **ERR-PASS-01** | **Denali stronger**          |
| Validation errors (400)         | DTO / Zod pipes          | `ValidationFailure`, canonical sync 409           | **Parity**                   |
| Auth errors (401/403)           | `auth.middleware.ts`     | Kernel + `sendHttpError` mapping                  | **Parity**                   |
| Rate limit 429                  | Throttler + tenant abuse | `TenantRateLimitExceededError`                    | **Parity** (tour paths)      |
| Correlation id on errors        | Request id / tracing     | `x-correlation-id` header                         | **Partial** — TRACE-REGEN-01 |
| Internal route error bypass     | —                        | **ERR-BYPASS-01** — minor leak on `/internal/*`   | **P2** gap                   |

---

## Rate Limiting & Capacity Gap

**Audit date:** 2026-06-05  
**Legacy evidence:** `legacy/apps/api/src/common/tenant-abuse/`, `legacy/apps/api/src/common/throttling/`, `legacy/apps/api/src/common/billing/`, Nest `ThrottlerModule` — `app.module.ts` L52–86.  
**Denali evidence:** `apps/api/src/middleware/tenant-rate-limiter.ts`, `redis-rate-limiter-store.ts`, `http/bind-request-context.ts`, `canonical/assert-tour-capacity-in-tx.ts`, `db/pool-saturation.ts`, `db/tour-cap-config.ts`.

**Finding:** Denali `TenantRateLimiter` covers **authenticated per-tenant HTTP RPS** on a **small route set** (tours + tenant-config). Legacy layers **four independent systems** — (1) Redis sliding-window abuse limits keyed by tenant/user/IP/route class, (2) NestJS `@nestjs/throttler` route buckets, (3) daily plan quotas (`tenant_usage_daily` / `tenant_plan_limits`), (4) registration seat capacity — plus web BFF sliding windows. Most legacy scopes are **not ported**; Denali adds pool-saturation 503 mapping and theme-driven RPS overrides with scalability debt (**RL-DOS-\***, **NN-\***).

### Requirements matrix

| Legacy mechanism                                                                 | Scope (tenant / IP / route)                                                                                                                                     | Denali equivalent                                                                                                                                    | Ported?                                                   |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Tenant abuse — API sliding window** (`TenantRateLimitService.enforceApi`)      | **Tenant** + **user** + **IP×tenant** on all `/api/v2` (default 6000 / 1200 / 3000 per 60s) — `tenant-rate-limit.service.ts` L269–299; `env.schema.ts` L143–153 | `consumeTenantRateLimit` — tenant ALS only, default **50/s** write + optional read tier — `tenant-rate-limiter.ts` L34–49, L198–208                  | **Partial** (tenant only; token bucket vs sliding window) |
| **Tenant abuse — login** (`enforceLogin`)                                        | **Tenant** (60/60s) + **IP** (30/60s) on auth session routes — L250–266; `auth-route-policy.ts` L5–11                                                           | None — no auth routes                                                                                                                                | **No** (N/A until auth module)                            |
| **Host probe throttle** (`enforceHostProbeOnAuthRoute`)                          | **IP** (60/60s) on strict auth + `GET /api/v2/auth/workspace-host` — L228–247; `tenant-resolver.middleware.ts` L54                                              | None                                                                                                                                                 | **No**                                                    |
| **Background job budget** (`tryConsumeJobForTenant`)                             | **Tenant** (120/60s) for reconciliation — L303–322; `reconciliation.service.ts` L96                                                                             | None                                                                                                                                                 | **No**                                                    |
| **Redis fail mode** (`RATE_LIMIT_FAIL_MODE`: degraded / fail_open / fail_closed) | In-memory token-bucket fallback on Redis error — `tenant-rate-limit.service.ts` L81–103; `env.schema.ts` L178–184                                               | Redis store throws → **500** on limited routes — `redis-rate-limiter-store.ts` L27–30; **RL-DOS-04**                                                 | **Partial** (stricter; availability regression)           |
| **Trusted-proxy client IP** (`resolveThrottleClientIp`)                          | XFF walk with `TRUSTED_PROXY_CIDRS` — `public-registration-throttle.ts` L107–149                                                                                | Not used by `TenantRateLimiter` (no IP keys)                                                                                                         | **No**                                                    |
| **Public catalog partition** (`resolvePartitionedPublicRateLimitBucket`)         | Unauthenticated `/api/v2` shards by tour UUID / registration UUID / host — `tenant-runtime-policy.ts` L54–80                                                    | N/A — limited Denali routes require auth ALS                                                                                                         | **N/A**                                                   |
| **Nest throttler — `public-registration`**                                       | **IP** + tenant/user composite key; 10/min prod — `app.module.ts` L59–64; `registrations.controller.ts` L108–109                                                | None — no registrations module                                                                                                                       | **No**                                                    |
| **Nest throttler — `tour-create`**                                               | **IP** tracker, 30/min — `app.module.ts` L74–77; `tours.controller.ts` L83–84                                                                                   | Write-tier tenant bucket (~50/s default) on `POST /tours` — `tours.routes.ts` L58                                                                    | **Partial** (tenant not IP; higher default RPS)           |
| **Nest throttler — `payments-webhook`**                                          | **IP**, 200/min; skips `public-registration` — `payments-webhook.controller.ts` L27–28                                                                          | None — no payments                                                                                                                                   | **N/A**                                                   |
| **Daily API quota** (`TenantUsageMeteringService.enforceHttpUsageMetering`)      | **Tenant** `api_requests_per_day` vs `tenant_plan_limits` — `tenant-usage-metering.service.ts` L96–127                                                          | None — `tenant_plan_limits` / `tenant_usage_daily` absent in Prisma                                                                                  | **No**                                                    |
| **Daily job quota** (`tryConsumeBackgroundJob`)                                  | **Tenant** `jobs_per_day` — L135–158                                                                                                                            | None                                                                                                                                                 | **No**                                                    |
| **Workspace tier quota** (`RateLimitMeterInterceptor`)                           | **Tenant** `maxActiveTours`, `maxUsers` on mutations — `rate-limit-meter.interceptor.ts` L67–76                                                                 | Env caps `MAX_TOURS_PER_TENANT` / `MAX_TOURS_GLOBAL` + `assertTourCapacityInTx` — `tour-cap-config.ts` L13–17; `assert-tour-capacity-in-tx.ts` L7–28 | **Partial** (tour **row count** only; no user cap)        |
| **Registration seat capacity** (`RegistrationCapacityService`, waitlist)         | Per-tour accepted seats + waitlist — `registrations.module.ts` L11–18                                                                                           | None — registration tables absent                                                                                                                    | **No**                                                    |
| **Abuse / quota metrics + ops debug**                                            | `TenantAbuseMetricsService`; `GET /internal/ops/…` — `ops.controller.ts` L95–108                                                                                | Partial observability (`metrics.ts`); no equivalent ops counters                                                                                     | **Partial**                                               |
| **Web BFF sliding window**                                                       | Per-key in-process limiter — `legacy/apps/web/lib/rate-limit/sliding-window-per-key.ts`                                                                         | Out of `apps/api` scope                                                                                                                              | **N/A**                                                   |

### Legacy rate/capacity logic NOT ported to `TenantRateLimiter`

Denali `consumeTenantRateLimit` does **not** subsume:

1. **Per-user** API buckets (`trl:v2:api:user:{tenant}:{user}`) — `tenant-rate-limit.service.ts` L289–293.
2. **Per-IP** buckets — login (`login_ip`), API composite (`api:ipt:{tenant}:{ip}`), host probe (`host_probe_ip`).
3. **Login / OTP / workspace-host** route classes — `enforceLogin`, `enforceHostProbeOnAuthRoute` (L215–247).
4. **Background job** tenant budgets — `tryConsumeJobForTenant` (reconciliation).
5. **NestJS `ThrottlerGuard`** named buckets — `public-registration`, `tour-create`, `payments-webhook` (`app.module.ts` L58–78).
6. **Daily plan quotas** — `tenant_usage_daily` upsert + `TENANT_QUOTA_EXCEEDED` — `tenant-usage-metering.service.ts` L46–127.
7. **Workspace plan limits** — `maxActiveTours` / `maxUsers` via `RateLimitMeterInterceptor` (distinct from tour row env caps).
8. **Registration seat consumption** and waitlist promotion — `RegistrationCapacityService` / `RegistrationWaitlistService`.
9. **Unauthenticated catalog partitioning** for rate keys — `resolvePartitionedPublicRateLimitBucket`.
10. **Trusted-proxy IP resolution** for limiter keys — `resolveThrottleClientIp`.
11. **Redis degraded in-memory fallback** (`RATE_LIMIT_FAIL_MODE=degraded`) — Denali Redis blip → hard error (**RL-DOS-04**).
12. **Sliding-window Redis ZSET algorithm** — Denali uses `rate-limiter-flexible` token bucket (`RateLimiterMemory` / `RateLimiterRedis`).
13. **Global `/api/v2` middleware coverage** — Legacy `TenantRateLimitMiddleware` on all runtime API paths; Denali limits only routes passing `{ rateLimit: 'read' \| 'write' }` to `bind-request-context.ts` (tours + tenant-config today).

### Denali-only limits (context)

| Mechanism                           | Scope                                             | Evidence                                                                                 | Notes                                                                      |
| ----------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Read/write tier split**           | **Tenant** `{tenantId}:read` vs `:write`          | `tenant-rate-limiter.ts` L194–208; `tours.routes.ts` L115; `tenant-config.routes.ts` L63 | Legacy has no independent read bucket                                      |
| **Theme `rateLimitRps` override**   | **Tenant** per-window points from `tenants.theme` | `parseRateLimitRpsFromTheme` L52–72; `resolveEffectiveRateLimitForTenant` L75–110        | Legacy HTTP limits use env only; admin DB read per consume (**RL-DOS-01**) |
| **Redis `RateLimiterRedis` store**  | **Tenant** key prefix `ratelimit`                 | `redis-rate-limiter-store.ts` L19–63                                                     | Optional via `REDIS_URL`                                                   |
| **Pool saturation → 503**           | **Global** app DB pool                            | `pool-saturation.ts` L7–28; `error-interceptor.ts`                                       | Stable `DB_POOL_SATURATED` — **NN-02**                                     |
| **Tour row capacity in TX**         | **Global** + **tenant** tour counts               | `assert-tour-capacity-in-tx.ts` L7–28; 429 `TOUR_CAPACITY_*`                             | Not registration seats; inside `withCanonicalTransaction`                  |
| **In-memory limiter without Redis** | **Tenant** keys unbounded until TTL               | `MemoryRateLimiterStore` L125–155                                                        | **RL-DOS-02**; legacy fallback compacts stale buckets L138–144             |

**Denali routes with rate limit today:** `POST /tours`, `PATCH /tours/:id`, `GET /tours/:id`, `GET /api/v2/tenant-config` — via `bind-request-context.ts` L31–34. Internal/provisioning routes are **unlimited**.

### Gaps — severity & remediation

| Gap                                         | Severity         | Legacy                                                                | Denali gap / regression                      | Remediation                                              |
| ------------------------------------------- | ---------------- | --------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| No per-user / per-IP HTTP limits            | **P1**           | `tenant-rate-limit.service.ts` L289–299                               | Single tenant bucket only                    | Scoped keys on `RateLimiterStore.consume` or edge WAF    |
| Auth login + host-probe throttles           | **P1**           | L228–266                                                              | No auth routes                               | Port when auth module lands                              |
| Daily + workspace plan quotas               | **P1**           | `tenant-usage-metering.service.ts`; `rate-limit-meter.interceptor.ts` | No metering tables                           | Restore `tenant_plan_limits` / `tenant_usage_daily`      |
| Registration seat capacity                  | **P0** (product) | `RegistrationCapacityService`                                         | Tours kernel only                            | Defer until registrations port                           |
| Nest `public-registration` throttler        | **P1**           | `registrations.controller.ts` L108+                                   | No public registration                       | `@Throttle` or middleware on return                      |
| **RL-DOS-01** admin DB per limited request  | **High**         | Config from request context — no per-request `findUnique`             | `resolveEffectiveRateLimitForTenant` L99–102 | `tenant-registry-cache` + negative-cache (**RL-DOS-03**) |
| **RL-DOS-02** unbounded memory keys         | **Medium**       | In-memory fallback compacts stale keys                                | `RateLimiterMemory` per consumer key         | Require `REDIS_URL` in prod; LRU cap                     |
| **RL-DOS-04** Redis fail-closed **500**     | **Medium**       | `RATE_LIMIT_FAIL_MODE=degraded` default                               | Throws on Redis error                        | Legacy degraded fallback or documented policy            |
| **NN-01** validation CPU / event loop       | **High**         | RuleEngine + bulk paths                                               | Rate limit bounds RPS not CPU                | Worker pool + queue depth (**SCAL-DEBT-02**, **NN-04**)  |
| **NN-02** pool saturation on neighbor reads | **High**         | Shared pool stress                                                    | `GET /tours/:id` → 503 under A write flood   | Per-tenant DB semaphore (**SCAL-DEBT-01**)               |
| **NN-05** no bulk-import quota              | **Medium**       | Sustained `POST /tours` at write RPS                                  | Same surface                                 | Job API + lower write points for bulk                    |
| **NN-07** no HTTP body size cap             | **P2**           | Nest defaults                                                         | **SCAL-DEBT-03** — none in `src/`            | 413 middleware                                           |
| Tour capacity vs rate limit codes           | **P2**           | `TENANT_QUOTA_EXCEEDED` vs `RATE_LIMITED`                             | Both 429; distinct codes in tests            | `tenant-rate-limiting.spec.ts` L67–82                    |
| No 100-tenant limiter CI probe              | **P2**           | `verify-phase-7-tenant-security.mjs` L365                             | Two-tenant specs only                        | **SCAL-DEBT-14**                                         |

### Cross-reference — phase 3 RL-DOS / NN / capacity

| Audit / test artifact                                                                        | Relevance                                              |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [`phase3-scalability-stress-audit.md`](phase3-scalability-stress-audit.md)                   | **RL-DOS-01…04**; **NN-01…08**; **SCAL-DEBT-01/04/14** |
| [`docs/phase-5/appendices/rate-limiting.md`](../../docs/phase-5/appendices/rate-limiting.md) | DEC-015 algorithm, env matrix, 429 contract            |
| [`assert-tour-capacity-in-tx.ts`](../src/canonical/assert-tour-capacity-in-tx.ts)            | Tour row caps (not HTTP rate limit)                    |
| [`phase0-audit-report.md`](phase0-audit-report.md)                                           | HT-07 singleton store; HT-14 global tour cap           |
| [`phase5-evolution-audit.md`](phase5-evolution-audit.md)                                     | SH-GAP-13 Redis fail-closed                            |

**Regression anchors:**

```bash
pnpm --filter @apps/api exec node --import tsx --test \
  test/3-performance/tenant-rate-limiter.spec.ts \
  test/3-performance/tenant-rate-limiting.spec.ts \
  test/3-performance/redis-rate-limiter.spec.ts \
  test/3-performance/noisy-neighbor-latency.spec.ts \
  test/2-observability/noise-neighbor.spec.ts
```

Legacy reference: `legacy/apps/api/src/common/tenant-abuse/tenant-rate-limit.service.spec.ts`, `legacy/apps/api/test/guards/public-registration-throttle.spec.ts`.

---

## Bulk / batch gap

Source: [`phase4-resilience-audit.md`](phase4-resilience-audit.md) § Bulk import.

| ID          | Finding                                | Legacy                                     | Denali                                                                      |
| ----------- | -------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| **BULK-01** | No HTTP bulk-import route              | Operational scripts / direct service calls | `bulk-import-consistency.spec.ts` simulates `persistNewTourAtomically` only |
| **BULK-02** | Rate limits bypassed on direct persist | N/A                                        | Bulk test bypasses `tenant-rate-limiter.ts`                                 |
| **BULK-03** | Victim tenant SLO under import storm   | Implicit monolith sharing                  | RLS **pass**; NN **fail** — no B login/read gate                            |

**Posture:** Add job API + concurrency cap (**SCAL-DEBT-09**) rather than port a legacy `/bulk-import` endpoint (none found on legacy HTTP surface).

---

## Proxy & Third-Party Integration Gap

**Audit date:** 2026-06-05  
**Legacy evidence:** `legacy/packages/security/egress-url/`, `legacy/apps/api/src/modules/payments/`, `legacy/apps/api/src/common/email/`, `legacy/apps/api/src/infra/storage/`, `legacy/apps/api/src/modules/outbox/repositories/`, `legacy/apps/web/lib/api/bff-fetch.ts`, `legacy/apps/web/lib/geocoding/`.  
**Denali evidence:** `apps/api/src/proxy/tenant-http-proxy.ts`, `apps/api/test/4-integration/proxy-tenant-isolation.spec.ts`, [`phase4-resilience-audit.md`](phase4-resilience-audit.md) (§ Proxy isolation — **PI-01**…**PI-04**), [`docs/phase-5/appendices/tenant-http-proxy.md`](../../docs/phase-5/appendices/tenant-http-proxy.md).

**Finding:** Legacy Tour Ops has **multiple live outbound and inbound HTTP integration paths** — SSRF-hardened egress (`@repo/security/egress-url`), payment PSP adapters (Zibal, Stripe), Resend email, MinIO object storage, signed payment webhooks, and a Next.js BFF that proxies browser traffic to Nest with tenant/session headers. Denali `apps/api` exposes a **single third-party HTTP seam** (`TenantHttpProxy`) that injects ALS `x-tenant-id` and optional per-tenant GET cache; it is **not instantiated in `main.ts`** and uses **unbounded global `fetch`** with **no egress allowlist**. Every revenue, email, geocoding, and object-storage integration from legacy is **Missing** in Denali.

### Integration inventory

| Legacy integration                                                                            | Purpose                                                                                                                       | Denali re-implementation                                          | Status                                                 |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| `@repo/security/egress-url` (`assertSafeOutboundUrl`, `fetchWithPinnedEgress`)                | SSRF prevention: protocol/host allowlist, private-IP block, DNS pin at connect, TLS `rejectUnauthorized`, Host header binding | —                                                                 | **Missing**                                            |
| **Zibal PSP** (`zibal-payment-gateway.impl.ts`)                                               | Outbound `POST https://gateway.zibal.ir/v1/request` for payment intents                                                       | —                                                                 | **Missing**                                            |
| **Stripe PSP** (`stripe-payment-gateway.impl.ts`)                                             | Outbound payment intent via Stripe Node SDK                                                                                   | —                                                                 | **Missing**                                            |
| **Payment webhook ingress** (`payments-webhook.controller.ts`)                                | Inbound `POST /internal/payments/webhook` — HMAC-SHA256, ±5m timestamp, replay cache, optional IP allowlist                   | —                                                                 | **Missing**                                            |
| **Tenant payment callback egress guard** (`tenant-payment-config-egress-guard.subscriber.ts`) | Reject private/blocked callback URLs on `tenant_payment_configs` save                                                         | —                                                                 | **Missing**                                            |
| **Outbox outbound URL scan** (`assert-outbound-urls-in-outbox-payload.ts`)                    | Validate HTTP(S) URLs embedded in outbox payloads before dispatch                                                             | Denali outbox relay publishes in-process only — no URL scan       | **Missing**                                            |
| **Resend email** (`email.service.ts`)                                                         | Outbound verification email via Resend API                                                                                    | —                                                                 | **Missing**                                            |
| **MinIO / S3** (`minio-storage.adapter.ts`)                                                   | Receipt uploads, tour-clone media, pending-storage-deletion saga                                                              | —                                                                 | **Missing**                                            |
| **Geocoding providers** (`legacy/apps/web/lib/geocoding/` — Neshan, Map.ir, Nominatim)        | BFF `GET /api/geocoding/search` for wizard location autocomplete                                                              | —                                                                 | **Missing** (legacy lives in `apps/web`, not Nest API) |
| **Next.js BFF → API proxy** (`bff-fetch.ts`, `bff-proxy.ts`)                                  | Browser→Nest with `x-tenant-id`, Bearer/Cookie session, `x-internal-api-key`, `x-request-id`, `traceparent`                   | Denali ingress: gateway JWT / headers only — no BFF in `apps/api` | **N/A** (`apps/web` scope)                             |
| **SMS gateway** (`registration-accepted-sms-outbox.handler.ts`)                               | Post-approval payment SMS — **log placeholder only** in legacy                                                                | —                                                                 | **Missing** (legacy also unwired)                      |
| **Telegram init validation** (`auth.service.ts` `parseTelegramInitPayload`)                   | Local HMAC of `telegram_init_payload` — **no outbound HTTP** to Telegram API                                                  | —                                                                 | **Dropped** (auth module absent)                       |
| **`TenantHttpProxy`** (map / enrichment seam)                                                 | N/A in legacy API — geocoding is web BFF                                                                                      | `tenant-http-proxy.ts` — ALS `x-tenant-id` + per-tenant GET cache | **Partial** (seam + tests; **not production-wired**)   |

### Explicit missing integrations (not re-implemented in Denali)

1. **`@repo/security/egress-url` package** — `legacy/packages/security/egress-url/`.
2. **Zibal payment gateway** — `legacy/.../zibal-payment-gateway.impl.ts` L17–107.
3. **Stripe payment gateway** — `legacy/.../stripe-payment-gateway.impl.ts`.
4. **Payment webhook receiver** + `PaymentWebhookSignatureGuard` + Redis/in-memory replay cache — `payments-webhook.controller.ts`, `webhook-signature.verify.ts`.
5. **Resend email outbound** — `email.service.ts` L56–65.
6. **MinIO object storage** — `minio-storage.adapter.ts`; env `MINIO_*` in `legacy/.../env.schema.ts` L35–43.
7. **Geocoding multi-provider BFF** — `geocoding-search.ts`, `neshan.ts`, `map-ir.ts`, `nominatim.ts`; rate limit on `geocoding/search/route.ts` L7–31.
8. **Tenant callback URL egress guard** on payment config persistence.
9. **Outbox payload outbound URL validation** before worker dispatch.
10. **Next.js BFF proxy layer** — product surface for session/cookie transport (out of `apps/api` but required for legacy web parity).

### Proxy behavior diff

| Dimension                     | Legacy                                                                                                                                                      | Denali (`TenantHttpProxy`)                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Tenant header (outbound)**  | BFF sets `x-tenant-id` from Host-resolved tenant — `get-api-base-url.ts` L17–24; Zibal uses tenant in idempotency store, not HTTP header                    | `headers.set("x-tenant-id", requireActiveTenantId())` — `tenant-http-proxy.ts` L49–50    |
| **Session / auth forwarding** | BFF: `Authorization` Bearer + `Cookie` + optional `x-internal-api-key` — `bff-proxy.ts` L46–57, L85–99                                                      | Ingress only (`tenant-kernel`); proxy does not forward user JWT to upstream              |
| **Tracing**                   | BFF sets `x-request-id`, `traceparent` — `bff-fetch.ts` L58–64                                                                                              | Not injected on outbound proxy leg                                                       |
| **TLS**                       | `fetchWithPinnedEgress`: `rejectUnauthorized: true`, SNI via pinned hostname — `assert-safe-outbound-url.ts` L332–338                                       | Global `fetch` — Node/Undici default TLS                                                 |
| **Timeouts**                  | BFF `fetch` and Zibal call have **no explicit `AbortSignal`**; egress layer supports `signal` on `http.request` — `fetch-with-pinned-egress.ts` L115        | **No timeout** — `await fetch(url, { ...init, method, headers })` only — **PI-01**       |
| **SSRF / allowlists**         | Blocks localhost, metadata, RFC1918, link-local; re-resolves DNS at connect; rejects Host override — `assert-safe-outbound-url.ts` L13–18, L41–52, L368–380 | **None** — trusts configured `upstreamBaseUrl`; caller-supplied path only                |
| **URL validation on config**  | `assertSafeOutboundUrl` on tenant callback URLs and outbox payload URLs                                                                                     | No callback or outbox URL guards                                                         |
| **Inbound webhook hardening** | HMAC + timestamp skew + replay TTL + optional `PAYMENTS_WEBHOOK_ALLOWED_IPS` — `webhook-signature.verify.ts` L8–9, L18–23                                   | No inbound third-party webhook routes                                                    |
| **Per-tenant response cache** | Geocoding BFF stateless; egress has no response cache                                                                                                       | Optional GET cache keyed `tenantId\0method\0url` — `tenant-http-proxy.ts` L19–20, L37–46 |
| **Production wiring**         | Live on payments, email, outbox worker, web BFF                                                                                                             | **`main.ts` does not construct `TenantHttpProxy`** — **PI-03**                           |

### Phase 4 proxy findings (latent Denali seam)

| ID        | Finding                                                         | Severity        | Evidence                                                             |
| --------- | --------------------------------------------------------------- | --------------- | -------------------------------------------------------------------- |
| **PI-01** | `TenantHttpProxy.fetch` — no timeout, breaker, or `AbortSignal` | **P1** (latent) | Only outbound `fetch` in `apps/api/src` — `tenant-http-proxy.ts` L52 |
| **PI-02** | Per-tenant GET cache unbounded in-memory `Map`                  | Medium          | `tenant-http-proxy.ts` L28–66                                        |
| **PI-03** | Proxy not wired in `main.ts`                                    | Low             | Reduces immediate exposure                                           |
| **PI-04** | Per-tenant cache + ALS header injection                         | Pass            | `proxy-tenant-isolation.spec.ts`                                     |

### Gaps — severity & remediation

| Gap                                 | Severity | Legacy (present)                                                  | Denali (missing / weaker)        | Remediation                                                                                                                                |
| ----------------------------------- | -------- | ----------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| No egress-url / SSRF package        | **P0**   | `legacy/packages/security/egress-url/`                            | Raw `fetch` in `TenantHttpProxy` | Port or wrap `egress-url` before any tenant-influenced outbound URL; gate outbox payloads like `assert-outbound-urls-in-outbox-payload.ts` |
| Payment PSP outbound (Zibal/Stripe) | **P0**   | `zibal-payment-gateway.impl.ts`, `stripe-payment-gateway.impl.ts` | No payments module               | Phase 6+ finance port with `fetchWithPinnedEgress` / SDK + tenant-scoped credentials                                                       |
| Payment webhook ingress             | **P0**   | `payments-webhook.controller.ts` + signature guard                | —                                | Restore signed webhook route; replay cache + IP allowlist from `env.schema.ts` L67–72                                                      |
| MinIO / receipt storage             | **P1**   | `minio-storage.adapter.ts`, `pending_storage_deletions`           | No object storage                | Port storage adapter; ties to **DELTA-NP-15** tour photos                                                                                  |
| Proxy unbounded hang (**PI-01**)    | **P1**   | Latent in BFF too; egress supports `signal`                       | `tenant-http-proxy.ts` L52       | `AbortSignal.timeout(ms)`, per-upstream breaker, metrics; wire **before** map routes                                                       |
| Tenant callback egress guard        | **P1**   | `tenant-payment-config-egress-guard.subscriber.ts`                | —                                | Prisma middleware when `tenant_payment_configs` schema lands                                                                               |
| Resend email                        | **P2**   | `email.service.ts`                                                | —                                | Outbox handler + `RESEND_API_KEY` when identity-email events port                                                                          |
| Geocoding BFF                       | **P2**   | `apps/web/lib/geocoding/*`                                        | —                                | Rebuild in future `apps/web` or API-side `TenantHttpProxy` with egress-url                                                                 |
| BFF session/cookie proxy            | **P2**   | `bff-fetch.ts`                                                    | Bearer/header ingress only       | Separate web app adapter                                                                                                                   |
| SMS provider                        | **P3**   | Log-only placeholder                                              | —                                | Defer until vendor selected                                                                                                                |

### Cross-reference — phase 4 `proxy-tenant-isolation`

| Audit / test artifact                                                                                         | Relevance                                                                                            |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [`phase4-resilience-audit.md`](phase4-resilience-audit.md) § **Proxy isolation — outbound third-party calls** | **PI-01** systemic hang; **PI-03** not wired; **PI-04** tenant isolation pass                        |
| [`tenant-http-proxy.md`](../../docs/phase-5/appendices/tenant-http-proxy.md)                                  | ALS header + cache contract; Phase 6+ egress allowlist deferred                                      |
| [`proxy-tenant-isolation.spec.ts`](../test/4-integration/proxy-tenant-isolation.spec.ts)                      | Proves `x-tenant-id` injection + no cross-tenant cache bleed; **no** timeout/SSRF/hung-upstream test |
| [`async-propagation.spec.ts`](../test/0-functional/async-propagation.spec.ts)                                 | `MockExternalEnrichmentApi` — ALS through async gaps; in-process only                                |
| [`phase1-aggressive-audit.md`](phase1-aggressive-audit.md)                                                    | **DI-PROXY-01** — cache key includes tenant; proxy not in `main.ts`                                  |

**Regression anchors:**

```bash
cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test test/4-integration/proxy-tenant-isolation.spec.ts
```

**Legacy reference tests:**

```bash
pnpm --filter @repo/security/egress-url test
pnpm --dir legacy/apps/api exec node --import tsx --test test/e2e/payments-coexistence.e2e-spec.ts
```

---

## UX regression gap

Web/BFF scope — Denali `apps/web` vs legacy `apps/web` + Nest BFF routes.

| UX surface                      | Legacy                                         | Denali web                           | Status                  |
| ------------------------------- | ---------------------------------------------- | ------------------------------------ | ----------------------- |
| Login OTP flow                  | `legacy/apps/web` BFF + `auth/login`           | No Denali login API                  | **Blocked** on auth gap |
| Full tenant shell config        | `TenantConfigProvider` + layout/nav/widgets    | Server theme accent only (Phase 4.4) | **Partial**             |
| Tour wizard templates / presets | `workspace_tour_wizard_templates` DB           | Not in Denali schema                 | **Dropped**             |
| Tour list / dashboard           | List API + `dashboard-aggregate.controller.ts` | No list route in API                 | **Dropped**             |
| Session cookie transport        | `tour_ops_session` cookie                      | JWT / headers at API                 | **Dropped** (by design) |

---

## Need-to-Port

Consolidated, deduplicated tickets. One row per real gap across sections above.

| ID              | Domain            | Legacy evidence                                                             | Why port                                      | Suggested Denali target                                      | Pri    |
| --------------- | ----------------- | --------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------ | ------ |
| **DELTA-NP-01** | Schema / auth     | `user.entity.ts`, `user-tenant.entity.ts`, `mobile-otp-challenge.entity.ts` | Membership + OTP require persistence          | Prisma models + migrations Phase 6+                          | **P0** |
| **DELTA-NP-02** | Security / auth   | `auth.controller.ts` L92–309                                                | End-user login/workspace flows                | New auth route module or separate service                    | **P0** |
| **DELTA-NP-03** | Security / auth   | `auth-membership-verification.ts` L99–119 (`sess_ver`)                      | Stolen JWT revocation                         | Extend `parse-jwt-bearer.ts` + DB check                      | **P1** |
| **DELTA-NP-04** | Security / auth   | `verifyActiveMembershipAndHydrateContext`                                   | Detect role/tenant drift                      | Replace `workspace-membership.ts` stub with DB lookup        | **P1** |
| **DELTA-NP-05** | Observability     | N/A (compliance expectation)                                                | Forensic blind spot on memory driver          | Enforce `STORAGE_DRIVER=prisma` in prod boot                 | **P0** |
| **DELTA-NP-06** | Observability     | Single request trace in Nest ALS                                            | Incident reconstruction broken                | Single ingress trace in `app.ts` → `bind-request-context`    | **P0** |
| **DELTA-NP-07** | Observability     | Structured shutdown logging                                                 | stderr may leak SQL/paths                     | `graceful-shutdown.ts` → pino only                           | **P0** |
| **DELTA-NP-08** | Config            | `tenant-config.ts` L52–80; `TenantConfigProvider`                           | Dashboard/layout cannot port without contract | Extend `themeFromJson` + workspace-sdk types                 | **P1** |
| **DELTA-NP-09** | Config / schema   | `tenant.entity.ts` `enabled_modules`; PATCH modules controller              | Product module gating                         | JSON column or settings service Phase 6+                     | **P1** |
| **DELTA-NP-10** | Config            | `tenant-host-resolver.service.ts` Redis 60s                                 | Cross-process stale host mapping              | Redis cache or gateway-owned routing                         | **P2** |
| **DELTA-NP-11** | Config            | `dynamic-config-sync.spec.ts` / **CFG-01**                                  | Theme vs flags inconsistency                  | Unified resolver + invalidation on admin write               | **P1** |
| **DELTA-NP-12** | Tours             | `tours.controller.ts` L191–218 `GET /api/v2/tours`                          | List UI / ops dashboards                      | `handleListTours` + indexed canonical projection             | **P1** |
| **DELTA-NP-13** | Tours             | `tours.controller.ts` L177–188 status PATCH                                 | Lifecycle workflows                           | Dedicated status handler or canonical patch policy           | **P1** |
| **DELTA-NP-14** | Tours             | `tours-clone.service.ts`                                                    | Operator clone workflow                       | Port clone orchestration atop canonical persist              | **P2** |
| **DELTA-NP-15** | Tours             | `tours.controller.ts` L102–138 photos                                       | Media on tours                                | Storage adapter + routes (MinIO pattern from legacy)         | **P2** |
| **DELTA-NP-16** | Schema / bookings | `registration.entity.ts`; `GET .../registrations`                           | Booking product                               | Full registration schema Phase 6+                            | **P0** |
| **DELTA-NP-17** | Schema / finance  | Ledger/payment entities (10 tables)                                         | Financial cutover                             | Finance phase per MAP                                        | **P0** |
| **DELTA-NP-18** | Schema / settings | `workspace_tour_wizard_templates` etc.                                      | Wizard UX                                     | Workspace settings ports / JSON in `tenants.theme`           | **P2** |
| **DELTA-NP-19** | Observability     | `tenant_audit_events` on updates                                            | Update forensics (if product requires)        | `TOUR_UPDATED` in same TX as PATCH                           | **P1** |
| **DELTA-NP-20** | Observability     | Outbox `correlation_id` usage                                               | Pipeline traceability                         | Pass `getActiveTraceId()` in `enqueueDomainEvent`            | **P1** |
| **DELTA-NP-21** | Security / auth   | `auth.middleware.ts` L291–307 host/token mismatch                           | Browser multi-tenant hosts                    | Kernel host ↔ JWT tenant guard                               | **P1** |
| **DELTA-NP-22** | Security / auth   | phase5 **CI-BYP-44** staging                                                | Staging header-only auth                      | `DEPLOYMENT_TIER` or `NODE_ENV=production` on staging        | **P1** |
| **DELTA-NP-23** | Rate / capacity   | **RL-DOS-01**                                                               | 100-tenant flood DoS                          | Require `REDIS_URL`; cache negative lookups                  | **P1** |
| **DELTA-NP-24** | Rate / capacity   | **NN-01** / **SCAL-DEBT-13**                                                | Bulk import starves neighbors                 | Victim SLO spec + per-tenant semaphores                      | **P1** |
| **DELTA-NP-25** | Bulk              | `bulk-import-consistency.spec.ts` gap                                       | Safe mass ingest                              | Job API with concurrency cap + rate limits                   | **P1** |
| **DELTA-NP-26** | Proxy             | `tenant-http-proxy.ts:52`                                                   | Hung upstream stalls requests                 | `AbortSignal.timeout`, breaker, metrics                      | **P1** |
| **DELTA-NP-31** | Proxy / egress    | `legacy/packages/security/egress-url/`                                      | SSRF on tenant-influenced URLs                | Port `egress-url`; wrap `TenantHttpProxy.fetch`              | **P0** |
| **DELTA-NP-32** | Payments          | `zibal-payment-gateway.impl.ts`, `stripe-payment-gateway.impl.ts`           | Revenue path                                  | Finance module + `fetchWithPinnedEgress`                     | **P0** |
| **DELTA-NP-33** | Payments          | `payments-webhook.controller.ts`                                            | PSP callbacks                                 | Signed `POST /internal/payments/webhook` + replay cache      | **P0** |
| **DELTA-NP-34** | Storage           | `minio-storage.adapter.ts`                                                  | Receipts / clone media                        | S3-compatible adapter + `pending_storage_deletions`          | **P1** |
| **DELTA-NP-35** | Email             | `email.service.ts` (Resend)                                                 | Identity verification email                   | Outbox handler when `identity.email_verification.send` ports | **P2** |
| **DELTA-NP-27** | UX                | `legacy/apps/web/lib/api/tenant-config.ts`                                  | Client config sync                            | Port provider or BFF normalizer to Denali web                | **P1** |
| **DELTA-NP-28** | Tours             | Legacy required `Idempotency-Key` on PATCH                                  | Safe retries on update                        | Extend `http-idempotency.ts` to PATCH                        | **P2** |
| **DELTA-NP-29** | Schema / audit    | `tenant_audit_events.client_ip`, `request_id`                               | Compliance exports                            | Extend `audit_events` metadata schema                        | **P2** |
| **DELTA-NP-30** | Rate / capacity   | **SCAL-DEBT-03**                                                            | Large body DoS                                | HTTP 413 body limit middleware                               | **P2** |

---

## Intentionally-Removed

Items legacy had that Denali deliberately dropped, narrowed, or replaced. **Not** listed in [Need-to-Port](#need-to-port).

| ID              | Item                                                         | Rationale                                                           | Denali replacement                                      |
| --------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------- |
| **DELTA-IR-01** | Production SMS/email OTP delivery                            | Legacy code also `dev_static` only; verify fails closed outside dev | Defer until identity phase; no false regression claim   |
| **DELTA-IR-02** | Wide normalized `tours` + `tour_details` columns             | Zero-debt canonical SoT (MAP); query columns sacrificed             | `canonical_data` JSON + app-level validation            |
| **DELTA-IR-03** | Full `tenant_audit_events` coverage on every mutation        | DEC-007 — Phase 5 minimal audit                                     | `TOUR_CREATED` only on successful Prisma create         |
| **DELTA-IR-04** | Audit on failed mutations                                    | DEC-007 success-only policy                                         | No `audit_events` row on validation failure (by design) |
| **DELTA-IR-05** | Finance, payments, ledger, reconciliation tables             | Phase 5 scope = tour kernel only                                    | None until Phase 6+ finance migration                   |
| **DELTA-IR-06** | Registrations, waitlist, booking snapshots                   | Booking product out of kernel scope                                 | None until registration schema lands                    |
| **DELTA-IR-07** | BFF auth route handlers inside API monolith                  | Denali API is not Next.js BFF                                       | `apps/web` BFF or separate auth service                 |
| **DELTA-IR-08** | Cookie-based API session (`jwt`, `tour_ops_session`)         | DEC-023 JWT/header ingress for platform API                         | Bearer + `x-*` headers / gateway injection              |
| **DELTA-IR-09** | Nest CASL mirror + JWT `caps` snapshot                       | Simpler workspace-sdk `api-ability` rules                           | Static plugin rules; DB entitlements later              |
| **DELTA-IR-10** | Legacy generic `idempotency_keys` for all endpoints          | DEC-006 scoped HTTP replay                                          | `HttpIdempotencyRecord` for POST `/tours` only          |
| **DELTA-IR-11** | Soft delete (`deleted_at`) on tenants/tours                  | Kernel uses hard rows + canonical versioning                        | Optimistic `row_version`; no tombstone column yet       |
| **DELTA-IR-12** | PostgreSQL enum columns on tours/status                      | Prisma simplicity; validate in app                                  | String columns + Zod/canonical policy                   |
| **DELTA-IR-13** | Outbox `retry_count` / `next_retry_at`                       | Simpler relay state machine in Denali                               | Relay reclaim via `processing` staleness (phase4)       |
| **DELTA-IR-14** | Rich error bodies with stack/SQL on 500                      | Security — tenant leak resistance                                   | Opaque 500 + `correlationId` (**ERR-PASS-01**)          |
| **DELTA-IR-15** | `GET /api/v2/workspaces/:id/config` (legacy BFF expectation) | Superseded narrow public contract                                   | `GET /api/v2/tenant-config`                             |

---

## Open Questions / Verify with Product

| #         | Question                                                                              | Context                                                      | Default assumption                                   |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| **OQ-01** | Is `TOUR_UPDATED` audit **required** for compliance, or acceptable defer per DEC-007? | **AUDIT-GAP-02** marked P1 product gap, not P0 prod sign-off | Defer updates until product mandates forensic parity |
| **OQ-02** | Should Denali require `Idempotency-Key` on **PATCH** tours like legacy?               | Legacy required; Denali optional                             | P2 — confirm with API consumers                      |
| **OQ-03** | Theme-only Phase 4.4 vs full `TenantConfig` for web GA?                               | **DELTA-NP-08** / CFG-02                                     | Theme-only until dashboard port scheduled            |
| **OQ-04** | When do map/enrichment routes wire `TenantHttpProxy` to production?                   | PI-01 latent until wired                                     | Before any geocode on request hot path               |
| **OQ-05** | Bulk import: operator job API vs internal script only?                                | No legacy HTTP bulk endpoint found                           | New Denali design — not verbatim port                |
| **OQ-06** | Restore legacy `client_ip` / `request_id` on audit rows?                              | Schema forensics regression                                  | Product/legal to confirm export requirements         |
| **OQ-07** | List tours: canonical JSON query vs materialized projection columns?                  | **DELTA-NP-12** performance                                  | Product + perf review before implementation          |
| **OQ-08** | Staging auth: force `NODE_ENV=production` or introduce `DEPLOYMENT_TIER`?             | CI-BYP-44                                                    | Align with `production-auth-policy.md` § Staging     |

---

## Denali-only additions (inverse gap)

| Model / behavior                                  | Purpose                                                       |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `HttpIdempotencyRecord`                           | DEC-006 — `Idempotency-Key` replay for POST `/tours`          |
| `ProcessedDomainEvent`                            | Phase 5.4-S4 consumer dedupe                                  |
| `Tenant.workspaceType` / `theme`                  | Workspace routing + UI theme JSON                             |
| `Tour.canonical` + `schemaVersion` + `rowVersion` | Canonical SoT + evolution + optimistic lock                   |
| RLS + audit append-only + outbox partial index    | Operational hardening                                         |
| `GET /api/v2/tenant-config`                       | Versioned public config (narrower than legacy `TenantConfig`) |
| Theme-driven `rateLimitRps`                       | Per-tenant limiter override                                   |

---

## Migration & product implications

1. **No lift-and-shift:** Legacy rows cannot migrate with schema-only scripts. Normalized tour, registration, payment, and identity data have no target tables.
2. **Canonical cutover:** Tour content may map into `tours.canonical_data` via transform jobs; you lose queryable `lifecycle_status`, `starts_on`, capacity counters, FK integrity.
3. **Identity blocker:** Without `users`, `user_tenants`, OTP tables — no login, RBAC, or `session_version` revocation on Denali.
4. **Finance blocker:** Ledger, payments, reconciliation absent — no financial cutover until Phase 6+.
5. **Feature flags & modules:** `enabled_modules` and workspace settings tables absent — vertical features live in future schema or `tenants.theme` JSON.
6. **Enum weakening:** Denali strings accept values outside legacy enums unless app validation enforces sets.
7. **Audit forensics:** `audit_events` lacks `client_ip`, `request_id`, actor display — legacy compliance exports need schema extension if required.

---

## Methodology

1. **Legacy schema:** TypeORM `*.entity.ts` under `legacy/apps/api/src/` (42 unique tables). No `legacy/prisma/schema.prisma`.
2. **Denali schema:** `apps/api/prisma/schema.prisma` + SQL migrations (RLS, triggers, indexes).
3. **API / runtime:** Route inventories from controllers vs `app.ts` / `*.routes.ts`; cross-checked with phase 0–5 audit docs.
4. **Comparison rules:** **Absent** / **Partial** / **Parity** / **Denali-only**; evidence = file paths and line refs where cited.
5. **Dedup:** [Need-to-Port](#need-to-port) collapses overlapping audit IDs (e.g. DM-CT-03 = DI-RAW-01).

---

## Legacy entity index (full absent list)

| #   | Entity file                                                            | Table                             |
| --- | ---------------------------------------------------------------------- | --------------------------------- |
| 1   | `identity/entities/tenant.entity.ts`                                   | `tenants`                         |
| 2   | `identity/entities/user.entity.ts`                                     | `users`                           |
| 3   | `identity/entities/user-tenant.entity.ts`                              | `user_tenants`                    |
| 4   | `identity/entities/workspace-invite.entity.ts`                         | `workspace_invites`               |
| 5   | `identity/entities/email-verification-token.entity.ts`                 | `email_verification_tokens`       |
| 6   | `identity/entities/user-role-audit.entity.ts`                          | `user_role_audit`                 |
| 7   | `tenant/entities/tenant-custom-domain.entity.ts`                       | `tenant_custom_domains`           |
| 8   | `auth/entities/mobile-otp-challenge.entity.ts`                         | `mobile_otp_challenges`           |
| 9   | `tours/entities/tour.entity.ts`                                        | `tours`                           |
| 10  | `tours/entities/tour-details.entity.ts`                                | `tour_details`                    |
| 11  | `tours/entities/tour-product.entity.ts`                                | `tour_products`                   |
| 12  | `tours/entities/tour-departure.entity.ts`                              | `tour_departures`                 |
| 13  | `tours/entities/tour-price.entity.ts`                                  | `tour_prices`                     |
| 14  | `tours/entities/pending-storage-deletion.entity.ts`                    | `pending_storage_deletions`       |
| 15  | `registrations/registration.entity.ts`                                 | `registrations`                   |
| 16  | `registrations/waitlist-item.entity.ts`                                | `waitlist_items`                  |
| 17  | `pricing/entities/booking-price-snapshot.entity.ts`                    | `booking_price_snapshots`         |
| 18  | `payments/entities/payment.entity.ts`                                  | `payments`                        |
| 19  | `payments/entities/payment-receipt.entity.ts`                          | `payment_receipts`                |
| 20  | `payments/entities/tenant-payment-config.entity.ts`                    | `tenant_payment_configs`          |
| 21  | `payments/entities/payment-gateway-idempotency.entity.ts`              | `payment_gateway_idempotency`     |
| 22  | `finance/ledger/entities/ledger-journal-batch.entity.ts`               | `ledger_journal_batches`          |
| 23  | `finance/ledger/entities/ledger-journal-line.entity.ts`                | `ledger_journal_lines`            |
| 24  | `finance/ledger/entities/account-balance.entity.ts`                    | `account_balances`                |
| 25  | `finance/reconciliation/entities/reconciliation-job.entity.ts`         | `reconciliation_jobs`             |
| 26  | `finance/reconciliation/entities/reconciliation-finding.entity.ts`     | `reconciliation_findings`         |
| 27  | `settings-locations/entities/workspace-region.entity.ts`               | `workspace_regions`               |
| 28  | `settings-locations/entities/workspace-destination.entity.ts`          | `workspace_destinations`          |
| 29  | `settings-locations/entities/workspace-equipment-item.entity.ts`       | `workspace_equipment_items`       |
| 30  | `settings-locations/entities/workspace-guide-language.entity.ts`       | `workspace_guide_languages`       |
| 31  | `settings-locations/entities/workspace-tour-theme.entity.ts`           | `workspace_tour_themes`           |
| 32  | `settings-locations/entities/workspace-tour-creation-preset.entity.ts` | `workspace_tour_creation_presets` |
| 33  | `settings-locations/entities/workspace-tour-wizard-template.entity.ts` | `workspace_tour_wizard_templates` |
| 34  | `draft-engine/entities/draft-snapshot.entity.ts`                       | `draft_snapshots`                 |
| 35  | `draft-engine/entities/draft-event.entity.ts`                          | `draft_events`                    |
| 36  | `safety-profile/entities/medical-profile.entity.ts`                    | `medical_profiles`                |
| 37  | `safety-profile/entities/emergency-contact.entity.ts`                  | `emergency_contacts`              |
| 38  | `common/billing/entities/tenant-plan-limits.entity.ts`                 | `tenant_plan_limits`              |
| 39  | `common/billing/entities/tenant-usage-daily.entity.ts`                 | `tenant_usage_daily`              |
| 40  | `common/outbox/entities/outbox-event.entity.ts`                        | `outbox_events`                   |
| 41  | `common/audit/entities/tenant-audit-event.entity.ts`                   | `tenant_audit_events`             |
| 42  | `idempotency/entities/idempotency-key.entity.ts`                       | `idempotency_keys`                |

---

## Document history

| Date       | Change                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-05 | Proxy & Third-Party Integration Gap — egress-url, PSP, webhooks, BFF, geocoding inventory; PI-01 cross-ref                |
| 2026-06-05 | Tour Business Logic Gap — lifecycle FSM, rules matrix, validation ordering                                                |
| 2026-06-05 | Rate Limiting & Capacity Gap — legacy abuse/throttler/quotas matrix vs `TenantRateLimiter`                                |
| 2026-06-05 | Delta-Audit synthesis: executive rollup, Need-to-Port, Intentionally-Removed, Open Questions, TOC, completeness checklist |
| 2026-06-05 | Domain sections: auth, tours API, observability, config, errors, rate/capacity, bulk, proxy, UX                           |
| 2026-06-05 | Schema gap inventory (42 legacy entities vs 6 Denali models)                                                              |

Architect, documentation status: Updated. Link to docs: `apps/api/docs/legacy-vs-denali-gap-analysis.md`.
