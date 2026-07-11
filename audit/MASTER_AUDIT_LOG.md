# MASTER AUDIT LOG

**Re-verification date:** 2026-07-07  
**Method:** Ruthless static analysis — grep, file reads, guard script inspection, subagent cross-verification against live trunk (not stale report copy).  
**Charter:** `ENTERPRISE_AUDIT_REPORT.md` audit points 1–10, 13–18, 21, 25.

---

### Audit Point 1 — Dependency Mapping
- **Status:** Pass
- **Severity:** Low
- **Description:** Zero peer-to-peer imports between workspace packages in `src/`. All four workspaces depend only on `@app-tour/workspace-sdk` and platform packages. Cross-workspace edges are absent; `phase-8-guard` enforces the boundary.
- **Location:** `packages/workspaces/{denali,urban,starter,guest-club}/src/**`; `scripts/guards/phase-8-guard.mjs` lines 209–217; `scripts/guards/foundation-gate-config.mjs` lines 64–71 (scan roots omit denali/urban/guest-club).
- **Fix:** Extend `guard:import-boundary` scan roots to all four workspaces, not only `starter`.

---

### Audit Point 2 — Plugin Contract
- **Status:** Pass
- **Severity:** Low
- **Description:** All four plugins satisfy `WorkspacePlugin` at runtime. `denali.plugin.ts` is a tight 6-export contract surface enforced by `guard-denali-plugin-surface.mjs` — materially improved vs stale report. `urban.plugin.ts` still exports registry constants and validators alongside the factory without an equivalent surface guard.
- **Location:** `packages/workspaces/denali/src/denali.plugin.ts` lines 29–117; `scripts/guards/guard-denali-plugin-surface.mjs` lines 14–21; `packages/workspaces/urban/src/urban.plugin.ts` lines 26–357; `packages/workspace-sdk/src/plugin/workspace-plugin.contract.ts` lines 35–70.
- **Fix:** Add `guard-urban-plugin-surface.mjs` mirroring denali's allowlist. Keep implementation exports on `denali/src/internal.ts` and package subpaths, not `./plugin`.

---

### Audit Point 3 — Bootstrapping
- **Status:** Pass
- **Severity:** Low
- **Description:** `register-safe.ts` provides per-plugin lazy registration with isolated `ready`/`failed` status, inflight dedup, and telemetry. Generated manifest uses dynamic `import()` per `pluginId`. Portal root layout no longer side-effect-imports `register`; `instrumentation.ts` calls `registerAllWorkspacePluginsSafe()` via dynamic import. Chaos/isolation tests exist.
- **Location:** `packages/workspace-plugin-host/src/register-safe.ts` lines 88–182; `packages/workspace-plugin-host/src/workspace-plugin-register-manifest.generated.ts` lines 17–43; `apps/portal/instrumentation.ts` lines 1–21; `apps/portal/app/layout.tsx` lines 1–15; `packages/workspace-plugin-host/test/bootstrap-isolation-chaos.spec.ts` lines 54–143.
- **Fix:** Residual hub coupling in `apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts` lines 12–26 (`SYNC_WORKSPACE_PLUGINS` still eager-loads all four at module eval). Consider lazy-only path to match plugin-host isolation; warm only active `pluginId` in portal instrumentation.

---

### Audit Point 4 — Interface Segregation
- **Status:** Warning
- **Severity:** Medium
- **Description:** No `@prisma/client` imports under `packages/workspaces/**`. Ten port files define host-injected boundaries with SDK abstractions. Prisma adapters live exclusively in `apps/api`. Gaps: Denali embeds MinIO client directly in workspace code; `guest-club` has no HTTP ports; `tourStore?: unknown` in route deps weakens compile-time segregation.
- **Location:** `packages/workspaces/denali/src/photos/minio-photo-storage.ts` line 1; `packages/workspaces/denali/src/http/ports/tour-store.port.ts` lines 13–15; `packages/workspaces/guest-club/` (0 `*.port.ts` files); `packages/workspaces/denali/package.json` line 580.
- **Fix:** Extract MinIO behind a host-injected photo-storage port. Add `guest-club` HTTP ports when guest HTTP routes land. Replace `tourStore?: unknown` with `DenaliTourStorePort | undefined` in `denali/product-host-ports.ts`.

---

### Audit Point 5 — Workspace Isolation
- **Status:** Warning
- **Severity:** High
- **Description:** Bookings list/mutate paths correctly use `withTenantRls(tenantId, ...)`. `getById` deliberately bypasses RLS via `getPrismaAdmin().operatorRegistration.findUnique({ where: { id } })` — enables cross-tenant PK reads at the DB layer; security depends entirely on caller authz. Only production caller (`finance.service.ts`) enforces `booking.tenantId === auth.tenantId`. `listOutboxByAggregate` also pre-fetches booking via bare `getPrisma().findUnique` without RLS.
- **Location:** `apps/api/src/bookings/prisma-bookings.repository.ts` lines 174–180 (`listByTenantPage` + RLS), lines 317–324 (`getById` admin bypass), lines 327–331 (`listOutboxByAggregate` no RLS); `apps/api/src/workspace-finance/finance.service.ts` lines 237–244; `apps/api/test/bookings-safety.spec.ts` lines 78–95.
- **Fix:** Prefer two-step pattern: admin PK lookup for `tenantId` only, then `withTenantRls(tenantId, tx => tx.operatorRegistration.findFirst({ where: { id, tenantId } }))`. Add `guard:bookings-getbyid-tenant-scope` asserting every `getById` caller validates `tenantId`. Fix `listOutboxByAggregate` to use admin tenantId probe or `withTenantRls` consistently.

---

### Audit Point 6 — Schema Sync
- **Status:** Warning
- **Severity:** Medium
- **Description:** Manifests validate under Zod (CI + runtime) and codegen reads `httpRoutes` only, but structural parity debt remains: `denali` omits `pluginApiVersion`; three workspaces retain orphan top-level `http` blocks alongside `httpRoutes`; three parallel validation authorities (CI Zod, runtime Zod with `.passthrough()`, stale JSON Schema appendix); `denali` has dual theme ingress (`manifest.theme` + `denali-token-bridge.ts`).
- **Location:** `packages/workspaces/denali/workspace.manifest.json` lines 1–4, 15–33, 50–53; `packages/workspaces/urban/workspace.manifest.json` lines 4, 19–23; `packages/workspaces/guest-club/workspace.manifest.json` lines 4, 21–25; `packages/workspace-sdk/src/manifest.schema.ts` lines 120–130; `packages/workspace-sdk/src/workspace-registry/workspace-manifest.schema.ts` lines 12–23; `docs/phase-10/appendices/WORKSPACE-MANIFEST.schema.json` lines 7–8; `packages/workspaces/denali/src/theme/denali-token-bridge.ts` lines 1–30.
- **Fix:** Add `"pluginApiVersion": 1` to denali manifest; remove orphan `http` blocks from denali/urban/guest-club; add `guard:manifest-parity` asserting `pluginApiVersion` on every workspace; regenerate or retire `WORKSPACE-MANIFEST.schema.json`; codegen manifest `theme` from `denali-token-bridge` to eliminate dual ingress.

---

### Audit Point 7 — Token Parity
- **Status:** Warning
- **Severity:** Medium
- **Description:** Denali admin ↔ portal DTCG shared semantics are aligned (`color.primary` → `{denali.forest-600}`) and enforced by `guard:token-parity` (Denali-only). Remaining gaps: `--ws-*` ingress is scoped on an inner `<div>` in `PlatformThemeProvider`, not `body`; `shell-bridge.css` falls back when `--ws-color-accent` is absent; guest-club marketing DTCG references `{ws.color-accent}` but the marketing skin chain never defines `--ws-color-accent` on the body selector.
- **Location:** `scripts/guards/guard-token-parity.mjs` lines 22–42, 86–114; `packages/design-tokens/dtcg/workspaces/denali.admin.tokens.json` lines 45–48; `packages/design-tokens/dtcg/workspaces/denali.portal.tokens.json` lines 43–47; `packages/theme-react/src/providers/PlatformThemeProvider.tsx` lines 49–52; `packages/design-tokens/dtcg/workspaces/guest-club.marketing.tokens.json` line 6; `packages/workspaces/guest-club/theme/marketing/tokens.css` lines 1–5.
- **Fix:** Extend `guard:token-parity` to marketing slice; fix guest-club by resolving `{ws.color-accent}` to a literal in DTCG or adding a marketing skin rule that sets `--ws-color-accent` on `body[data-app-surface="marketing"][data-workspace-plugin="guest-club"]`; consider moving `--ws-*` injection to `body`.

---

### Audit Point 8 — DTCG Pipeline
- **Status:** Warning
- **Severity:** Medium
- **Description:** Codegen chain is correctly wired: `design-tokens` build runs DTCG primitives → semantics → themes → workspace CSS generators. `guard-dtcg-css-sync` re-runs all four generators in `--check` mode. Operational gaps: `generate:denali-semantic-slices` is manual and not invoked by `design-tokens build`; root `pnpm build` omits `@apps/web`; `test-changed` fans `design-tokens` changes only to `@apps/web`, not portal/marketing.
- **Location:** `packages/design-tokens/package.json` lines 35–37; `packages/design-tokens/scripts/generate-tokens.mjs` lines 55–59; `scripts/guards/guard-dtcg-css-sync.mjs` lines 12–30; `package.json` line 10, line 98; `scripts/test-changed.sh` lines 95–96; `scripts/guards/validate-design-tokens.mjs` lines 17–22.
- **Fix:** Wire `denali-semantic-slices --check` into `guard-dtcg-css-sync` or `guard:token-parity`; add portal/marketing to `test-changed` expand for `design-tokens`; include `@apps/web` in root build or document separate deploy build; add Turborepo `dependsOn` so token changes invalidate all three app surfaces.

---

### Audit Point 9 — Versioning
- **Status:** Warning
- **Severity:** Medium
- **Description:** Versioning is fragmented and mostly documentary: all manifests use `version: 1` (schema revision, no migration logic); `pluginApiVersion` is optional in runtime Zod and defaults to `1` at publish (`?? 1`); denali omits the field; `guestExtensionsVersion` and `memberPortal.manifestVersion` differ across workspaces. Registry loader uses Zod passthrough with no semver negotiation or manifest revision adapters.
- **Location:** `packages/workspaces/denali/workspace.manifest.json` lines 2–4, 317–320; `packages/workspaces/urban/workspace.manifest.json` lines 3–5, 168–169; `packages/workspaces/guest-club/workspace.manifest.json` lines 3–5, 140–141; `packages/workspaces/starter/workspace.manifest.json` lines 2–4; `packages/workspace-sdk/src/workspace-registry/workspace-manifest.schema.ts` lines 15–23, 34–43; `apps/api/src/workspace-metadata/workspace-definition.repository.ts` lines 55–63; `packages/workspace-sdk/src/workspace-registry/ensure-loaded.ts` lines 7–9.
- **Fix:** Publish a manifest schema versioning policy (`manifestSchemaVersion` + per-block revision fields); make `pluginApiVersion` required in CI schema; add codegen admission asserts for `guestExtensionsVersion` / `memberPortal.manifestVersion`; implement revision adapters or explicit fail-fast when `version` bumps.

---

### Audit Point 10 — State Consistency
- **Status:** Warning
- **Severity:** High
- **Description:** Admin `tenantConfig` sync is sound: theme writes call `invalidateTenantRegistryCache`; admin layout fetches theme with `cache: "no-store"`; branding UI calls `invalidateBranding()` + `router.refresh()`. Guest surfaces are intentionally decoupled from DB `tenantConfig.theme` (manifest-only branding). Guest `pluginId` resolution is cached up to 300s via `nextRevalidate: 300` on public tenant-context fetches. `WorkspaceRegistry` loads once per process — manifest changes require restart.
- **Location:** `apps/api/src/tenant/update-tenant-registry-row.ts` lines 12–15, 54; `apps/api/src/tenant/tenant-registry-cache.ts` lines 15, 185–197; `apps/web/src/tenant/fetch-tenant-theme.server.ts` lines 14–31; `apps/web/app/(app)/settings/branding/branding-settings-client.tsx` lines 62–68; `apps/portal/src/shell/portal-providers.tsx` lines 12–17; `apps/web/src/tenant/fetch-public-tenant-context.server.ts` lines 18–24; `packages/workspace-sdk/src/workspace-registry/ensure-loaded.ts` lines 7–9; `packages/workspace-plugin-host/src/register-safe.ts` lines 43–50.
- **Fix:** Lower `nextRevalidate` to 30–60s or use `cache: "no-store"` + `revalidateTag` for tenant-context; on `updateTenantRegistryRow`, fan out BFF cache invalidation; add manifest aggregate-hash reload to `ensureWorkspaceRegistryLoaded`; document guest manifest-only branding as intentional, or add `TenantThemeProvider` on portal with no-store fetch.

---

### Audit Point 13 — API Consistency
- **Status:** Warning
- **Severity:** High
- **Description:** Tenant authentication is centralized and well-tested (`TenantKernel`, claim-mismatch guard). Request validation is fragmented: only ~13 `*.schema.ts` files under `apps/api/src` (tours, platform, provision) — no expansion to bookings/users/settings. Duplicated `resolveTenantIdFromRequest` in auth routes. `handleReplayOutbox` accepts manual `tenantId` without auth/ALS. No global validation middleware or route wrapper.
- **Location:** `apps/api/src/routes/auth.routes.ts` (4 refs to `resolveTenantIdFromRequest`); `apps/api/src/routes/public-auth.routes.ts` (5 refs); `apps/api/src/tenant-kernel/` (centralized auth — PASS); tour CRUD vs clone/list session split in `apps/api/src/tours/`.
- **Fix:** Expand Zod to bookings, users, settings, integrations mutations. Introduce `withValidatedRoute` helper binding auth + ALS + Zod. Extract shared pre-login `resolveTenantIdFromRequest` helper. Require service JWT + ALS on `handleReplayOutbox`.

---

### Audit Point 14 — Error Handling
- **Status:** Warning
- **Severity:** High
- **Description:** Core operator path masks DB engine errors correctly (500 opaque + correlationId). Repository-layer P2002 handling is partial but effective where implemented. One confirmed client leak on platform tenant provision: `tenants-create.ts` returns `err.message` on 500. No unified `AppError` interceptor — Prisma FK/unique semantics lost behind generic 500s; platform/auth routes bypass central mapper.
- **Location:** `apps/api/src/routes/platform/tenants-create.ts` lines 94–95; `apps/api/src/storage/prisma-tour.repository.ts` (P2002 handling); `apps/api/src/error-interceptor.ts` (no global Prisma classifier); 130+ catch sites without mechanical enforcement.
- **Fix:** Replace `tenants-create.ts` leak with opaque 500 + `handleHttpError`. Implement `mapPrismaErrorToAppError()` for P2002/P2003 → 409/422. Route auth/public-auth through interceptor. Add ESLint/guard on catch sites that leak `err.message`.

---

### Audit Point 15 — Query Performance (Operator Bookings List)
- **Status:** Pass
- **Severity:** Low
- **Description:** Operator HTTP list path remediated: `listByTenantPage` uses `BOOKING_LIST_SELECT` (excludes `registrationIntake`), keyset pagination on `(submittedAt desc, id desc)`, `take: limit + 1`, and `withTenantRls`. `listBookings` service uses `Promise.all([listByTenantPage, countByListFilters])`. CI guards `guard:unbounded-list` and `guard:list-projection-openapi` enforce projection discipline on OpenAPI contracts.
- **Location:** `apps/api/src/bookings/prisma-bookings.repository.ts` lines 24–40 (`BOOKING_LIST_SELECT`), lines 183–217 (`listByTenantPage`); `apps/api/src/bookings/bookings.service.ts` lines 97–99; `scripts/guards/guard-unbounded-list.mjs`; `scripts/guards/guard-list-projection-openapi.mjs`; `apps/api/src/openapi/list-projection-openapi.ts`; `docs/dev/list-projection-guards.mdoc`.
- **Fix:** None for operator list path. Migrate duplicate-finder callers off legacy `listByTenant` and remove guard allowlist entry when complete.

---

### Audit Point 15 — Query Performance (Legacy Bookings listByTenant)
- **Status:** Pass (remediated 2026-07-07)
- **Severity:** Low
- **Description:** `listByTenant` delegates to `listByTenantPage` with cap 500 (`MAX_BOOKINGS_LIST_BY_TENANT_DEPRECATED`). Member summary uses SQL counts + `listRecentBySubmittedUser(take: 10)`. Duplicate finders use targeted `findFirst` paths.
- **Location:** `apps/api/src/bookings/prisma-bookings.repository.ts`; `apps/api/src/bookings/bookings-member-summary-projection.ts`; `apps/api/src/identity/users.service.ts`.
- **Fix:** None — see `audit/REMEDIATION_LOG.md` Performance Remediation Phases 1–6.

---

### Audit Point 15 — Query Performance (Tour List)
- **Status:** Pass (remediated 2026-07-07)
- **Severity:** Low
- **Description:** Operator HTTP list uses `listOperatorToursPage` — one bounded DB query per request with filter/sort on denormalized columns. `canonical` still loaded for page rows (workspace extractors). Category filter remains post-projection on the page.
- **Location:** `apps/api/src/tours/list-tours-operator.ts`; `apps/api/src/tours/operator-tour-list-db-query.ts`; `apps/api/src/storage/prisma-tour.repository.ts`.
- **Fix:** None for operator list. Optional future: denormalize `category` for DB-side filter.

---

### Audit Point 15 — Query Performance (N+1 Patterns)
- **Status:** Pass (remediated 2026-07-07)
- **Severity:** Low
- **Description:** `bulkApproveWithOutbox` uses single `withTenantRls` transaction + `updateMany`. Exposure profile seeding uses `createMany`. Finance invoice facts use SQL aggregates.
- **Location:** `apps/api/src/bookings/prisma-bookings.repository.ts`; `apps/api/src/exposure/prisma-exposure-profile.repository.ts`; `apps/api/src/finance/load-registration-invoice-facts.ts`.
- **Fix:** Optional — outbox reader idempotency pre-fetch (workspace-finance) if volume warrants.

---

### Audit Point 16 — Component Coupling
- **Status:** Warning
- **Severity:** High
- **Description:** Portal app source is decoupled correctly (0 hex/rgb/palette literals in TSX/CSS). Admin (`apps/web`) couples status and shell chrome to raw Tailwind palette (`emerald-*`, `amber-*`, `green-*` in 14+ files) and hex CSS fallbacks (`#2563eb` in operator shell). shadcn primitives use semantic tokens; feature pages and platform ops do not. No ESLint/guard on app raw colors.
- **Location:** `apps/web/src/shell/operator-brand.module.css` lines 14–15; `apps/web/src/shell/operator-account-menu.module.css` lines 26–27; `apps/web/app/(app)/settings/integrations/integrations-settings-client.tsx` (7+ palette sites); `apps/portal/**` (clean — 0 matches).
- **Fix:** Remove `#2563eb` hex fallbacks; add `--color-scrim` token for drawer scrim. Replace `emerald-*`/`amber-*` with semantic tokens or Badge variants. Extract shared `<StatusBanner>`. Add `guard:app-color-literals` or ESLint rule banning raw palette in `apps/web`.

---

### Audit Point 17 — Bundle Analysis
- **Status:** Warning
- **Severity:** Medium
- **Description:** Theme ingress is correctly active-plugin-only (PASS). Portal root layout static `register` import remediated — no longer FAIL. Remaining O(workspaces) cost: admin `SYNC_WORKSPACE_PLUGINS` eager static imports all four plugins at module eval; portal instrumentation warms all four trunk plugins at boot via `registerAllWorkspacePluginsSafe()`. Per-plugin dynamic registrars exist in codegen but admin client hydration uses sync path.
- **Location:** `apps/portal/app/layout.tsx` lines 1–15 (no plugin-host import — PASS); `apps/portal/instrumentation.ts` lines 14–21; `packages/workspace-plugin-host/src/register-safe.ts` lines 177–181; `apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts` lines 12–29; `packages/workspace-plugin-host/src/workspace-plugin-register-manifest.generated.ts` lines 18–42 (dynamic import — improved); `scripts/guards/guard-intake-plugin-registry.mjs`.
- **Fix:** Replace admin `SYNC_WORKSPACE_PLUGINS` with I3 lazy sync codegen. Register only active `pluginId` per host in instrumentation. Route client hydrate through `loadWorkspacePluginByIdFromRegistry` async loader.

---

### Audit Point 18 — CSS Injection
- **Status:** Warning
- **Severity:** Medium
- **Description:** Script-style CSS injection is adequately mitigated (`javascript:`, `url()`, `expression()` blocked at CI and DOM). `PlatformThemeProvider` uses fail-soft sanitization via inline `style` on wrapper div. `ThemeTokenSanitizer` not shipped — security relies on duplicated blocklists without centralized fail-closed allowlist. Layout/brand defacement via permitted token overrides (`--primary`, `--background`) remains possible. Runtime registry accepts unvalidated `theme` (loose Zod).
- **Location:** `packages/theme-react/src/providers/PlatformThemeProvider.tsx` lines 43–52; `packages/theme-react/src/providers/map-theme-to-css-variables.ts` lines 10–49; `packages/workspace-sdk/src/theme/theme-css-value-safety.ts` lines 5–63; `packages/workspace-sdk/src/manifest.schema.ts` lines 51–114 (CI strict); `packages/workspace-sdk/src/workspace-registry/workspace-manifest.schema.ts` line 21 (runtime loose).
- **Fix:** Implement `ThemeTokenSanitizer` with `ALLOWED_VALUE_SHAPES` per §9.6. Restrict runtime theme keys to `--ws-*` pattern. Enforce sanitizer at registry read (fail-closed). Add structured telemetry on dropped malicious tokens.

---

### Audit Point 21 — Manifest Sanitization
- **Status:** Warning
- **Severity:** Medium
- **Description:** `javascript:` and URL-based script injection via manifest theme is blocked today (CI blocklist + DOM blocklist + contract tests T-6b–T-6j). Operators cannot write manifest `theme` (tenant branding uses `validateTenantTheme` only). `ThemeTokenSanitizer` and `ALLOWED_VALUE_SHAPES` are not shipped — file absent from repo. Duplicated sanitizer logic between `theme-css-value-safety.ts` and `map-theme-to-css-variables.ts` with subtle divergence (`;{}\\` only in DOM path).
- **Location:** `packages/workspace-sdk/src/theme/theme-css-value-safety.ts` lines 5–63; `packages/workspace-sdk/src/manifest.schema.ts` lines 51–114; `packages/workspace-sdk/src/workspace-registry/workspace-manifest.schema.ts` line 21; `packages/workspace-sdk/src/workspace-registry/read-workspace-manifest-theme.ts` lines 11–26; `packages/theme-react/src/providers/map-theme-to-css-variables.ts` lines 28–49; `packages/workspace-sdk/test/theme/theme-css-value-safety.spec.ts` lines 22–35.
- **Fix:** Ship `packages/workspace-sdk/src/theme/theme-token-sanitizer.ts` with centralized `ALLOWED_VALUE_SHAPES`. Wire runtime registry read through sanitizer (fail-closed). Add `guard:theme-sanitizer-parity` asserting SDK and theme-react paths share one authority. Consolidate blocklists — delete DOM duplicate.

---

### Audit Point 25 — Data Exposure (Public Tenant Branding API)
- **Status:** Warning
- **Severity:** Medium
- **Description:** API service layer returns explicit 4-field DTO only (`displayName`, `primaryColor`, `logoUrl`, `defaultLocale`) — no `tenantId`, `storageKey`, or `cssVariables`. `logoUrl` is a signed URL (300s TTL), not raw storage key. Regression risk: web BFF pass-through forwards full backend JSON on 200 without output filter. OpenAPI missing response schema. No `guard:public-tenant-branding-dto`. Missing API-TB-18 negative contract test asserting forbidden fields absent.
- **Location:** `apps/api/src/tenant/tenant-branding.service.ts` lines 183–212 (public DTO); `apps/api/src/tenant/tenant-branding.routes.ts` lines 184–196; `apps/web/app/api/public/tenant-branding/route.ts` lines 33–34 (pass-through — regression risk); `apps/api/src/openapi/openapi.json` lines 3116–3148 (no response schema); `apps/marketing/src/tenant/fetch-public-tenant-branding.ts` lines 42–48 (4-field pick — PASS).
- **Fix:** Add strict 4-field output filter on web BFF route. Add OpenAPI `PublicTenantBrandingResponse` schema with `additionalProperties: false`. Ship `guard:public-tenant-branding-dto`. Add API-TB-18 test asserting response never contains `tenantId`, `storageKey`, `cssVariables`, `pluginId`.

---

## Executive Summary

| AP | Name | Verdict | Top Severity | Delta vs ENTERPRISE_AUDIT_REPORT |
|----|------|---------|--------------|----------------------------------|
| 1 | Dependency Mapping | **Pass** | Low | Unchanged |
| 2 | Plugin Contract | **Pass** | Low | **Improved** — denali surface guard shipped |
| 3 | Bootstrapping | **Pass** | Low | **Improved** — `register-safe.ts` + dynamic imports |
| 4 | Interface Segregation | **Warning** | Medium | Unchanged |
| 5 | Workspace Isolation | **Warning** | High | Unchanged |
| 6 | Schema Sync | **Warning** | Medium | Unchanged |
| 7 | Token Parity | **Warning** | Medium | guest-club marketing `--ws-color-accent` FAIL |
| 8 | DTCG Pipeline | **Warning** | Medium | Unchanged |
| 9 | Versioning | **Warning** | Medium | Unchanged |
| 10 | State Consistency | **Warning** | High | Unchanged |
| 13 | API Consistency | **Warning** | High | Unchanged |
| 14 | Error Handling | **Warning** | High | `tenants-create.ts` leak confirmed |
| 15 | Query Performance | **Pass** | Low | **Remediated** — bookings summary, finance aggregates, operator tour DB page, guard tightening (2026-07-07) |
| 16 | Component Coupling | **Warning** | High | Unchanged |
| 17 | Bundle Analysis | **Warning** | Medium | **Partial fix** — portal layout static register removed |
| 18 | CSS Injection | **Warning** | Medium | Unchanged |
| 21 | Manifest Sanitization | **Warning** | Medium | Unchanged |
| 25 | Data Exposure | **Warning** | Medium | Unchanged |

**Critical path (fix first):** AP 10 (300s guest `pluginId` cache).

**Recently remediated:** AP 2/3 (plugin encapsulation + bootstrap isolation), AP 15 performance backlog (bookings member summary, finance invoice facts, operator tour DB pagination, repository N+1 batching, guard tightening), AP 17 portal layout static register removal.

---

*Generated by Senior Staff Engineer audit — 2026-07-07. Re-run after material changes to protected packages or before Phase 6 closure.*

---

## Supplement — Cross-Workspace Import Audit (`packages/workspaces/*/src`)

**Audit date:** 2026-07-07  
**Rule:** No peer-to-peer workspace dependency — a workspace package must not import from another workspace package (`@app-tour/workspace-denali`, `@app-tour/workspace-urban`, `@app-tour/workspace-starter`, `@app-tour/workspace-guest-club`). Allowed upstream: `@app-tour/workspace-sdk` only.  
**Scope:** All `src/` trees under `packages/workspaces/{denali,urban,starter,guest-club}/`.  
**Method:** Full-tree grep for `@app-tour/workspace-*` package specifiers, relative path escapes (`../../../<other-workspace>`), `packages/workspaces/<peer>` string references, `require()` / dynamic `import()` — plus `package.json` dependency inspection and custom Node line-scanner across all four workspaces.

### Scan summary

| Workspace | `src/` files scanned | Cross-workspace imports | `package.json` workspace deps |
|-----------|----------------------|-------------------------|-------------------------------|
| `denali` | 120+ `.ts`/`.tsx` | **0** | `@app-tour/workspace-sdk` only |
| `urban` | 40+ | **0** | `@app-tour/workspace-sdk` only |
| `starter` | 15+ | **0** | `@app-tour/workspace-sdk` only |
| `guest-club` | 10+ | **0** | `@app-tour/workspace-sdk` only |

**Result:** **0 peer-to-peer violations** in production `src/` across all four workspace packages.

---

### Cross-Workspace Import Scan — Production `src/`
- **Status:** Pass
- **Severity:** Low
- **Description:** Exhaustive scan of all `packages/workspaces/*/src/**` found zero imports from a peer workspace package. Every `@app-tour/workspace-*` import in `src/` resolves to `@app-tour/workspace-sdk` (platform contract). Intra-package relative imports (e.g. `../../denali.plugin` within denali) are same-package references, not peer coupling. No `require()` or dynamic `import()` of peer workspace packages.
- **Location:** `packages/workspaces/denali/src/**`, `packages/workspaces/urban/src/**`, `packages/workspaces/starter/src/**`, `packages/workspaces/guest-club/src/**` (full trees); representative same-package relative: `packages/workspaces/denali/src/ui/chrome/denali-flat-edit-form.tsx` line 6, `packages/workspaces/denali/src/ui/chrome/wizard-draft-shell-surface.ts` line 13.
- **Fix:** None required. Maintain zero peer imports on new workspace code; reject PRs that add `@app-tour/workspace-<peer>` to any workspace `package.json` or `src/` import.

---

### Cross-Workspace Import Scan — `package.json` Dependency Graph
- **Status:** Pass
- **Severity:** Low
- **Description:** All four workspace `package.json` files declare exactly one workspace-family dependency: `@app-tour/workspace-sdk`. No workspace lists another workspace (`@app-tour/workspace-denali`, etc.) in `dependencies` or `devDependencies`. Confirmed by `phase-8-guard.mjs` urban↔denali rail check (`runP8UrbanNotDenaliRail`, lines 209–217).
- **Location:** `packages/workspaces/denali/package.json` line 577; `packages/workspaces/urban/package.json` line 76; `packages/workspaces/starter/package.json` line 35; `packages/workspaces/guest-club/package.json` line 57; `scripts/guards/phase-8-guard.mjs` lines 212–218.
- **Fix:** None required. Extend CI to assert all four workspace `package.json` files contain no peer `@app-tour/workspace-*` deps (today only urban→denali is explicitly guarded).

---

### Cross-Workspace Import Scan — Guard Coverage Gap
- **Status:** Warning
- **Severity:** Medium
- **Description:** Production code is clean, but automated enforcement does not fully cover all workspace `src/` trees. `IMPORT_BOUNDARY_SCAN_ROOTS` includes only `packages/workspaces/starter` — denali, urban, and guest-club `src/` are not in the AST import-boundary scan. `phase-8-guard` urban↔denali coupling check scans `packages/workspaces/urban/src` only (not denali→urban, starter, or guest-club). Current PASS relies on manual/grep audit, not mechanical CI over all four packages.
- **Location:** `scripts/guards/foundation-gate-config.mjs` lines 64–72 (`IMPORT_BOUNDARY_SCAN_ROOTS`); `scripts/guards/phase-8-guard.mjs` lines 233–237 (`urbanSourceTargets`); `scripts/guards/import-boundary-ast.mjs` lines 56–59 (blocks platform→workspace imports, not workspace→workspace).
- **Fix:** Add `packages/workspaces/{denali,urban,guest-club}/src` to `IMPORT_BOUNDARY_SCAN_ROOTS` or ship dedicated `guard:workspace-peer-imports.mjs` that fails on any `@app-tour/workspace-(denali|urban|starter|guest-club)` import where importer package ≠ target package. Wire into `pnpm run guard:import-boundary` and `phase-6:fast-track`.

---

### Cross-Workspace Import Scan — `test/` (informational, out of scope)
- **Status:** Pass
- **Severity:** Low
- **Description:** `test/` directories use same-package package-alias imports only (e.g. `@app-tour/workspace-denali/marketing` from `packages/workspaces/denali/test/*`). No cross-workspace test imports found. One urban test file contains the string `@app-tour/workspace-denali` inside an assertion proving denali is **not** in deps — not an import.
- **Location:** `packages/workspaces/denali/test/marketing-catalog-filter-config.spec.ts` line 7; `packages/workspaces/urban/test/phase-7.contract.spec.ts` line 199 (assertion only).
- **Fix:** None. Optionally extend peer-import guard to `test/` for defense-in-depth.

---

## Supplement — Export Subpath Encapsulation Audit (`packages/workspaces/*/package.json`)

**Audit date:** 2026-07-07  
**Contract authority:** `WorkspacePlugin` interface (`packages/workspace-sdk/src/plugin/workspace-plugin.contract.ts` lines 35–70) — platform code should depend on the frozen plugin object returned from manifest `plugin.entry` / `plugin.export`, not leaf modules.  
**Strict contract subpaths:** `./plugin` (or equivalent manifest entry), theme CSS assets (`./theme/*.css`), wizard locale JSON (`./messages/*/wizard.json`).  
**Method:** Parsed `exports` from all four `package.json` files; cross-checked root `index.ts` barrels and `guard-denali-plugin-surface.mjs` allowlist (`docs/dev/denali-plugin-encapsulation.mdoc`).

### Export debt summary

| Workspace | Total `exports` keys | Contract subpaths | **Technical-debt subpaths** | Debt ratio |
|-----------|---------------------:|------------------:|--------------------------:|-----------:|
| `denali` | 140 | 9 | **131** | 94% |
| `urban` | 15 | 7 | **8** | 53% |
| `starter` | 5 | 4 | **1** | 20% |
| `guest-club` | 10 | 5 | **5** | 50% |
| **Total** | **170** | **25** | **145** | **85%** |

**Contract subpaths (allowed):** `./plugin`, `./guest-club.plugin`, `./theme/*`, `./messages/*/wizard.json`, and root `.` **only when** it re-exports plugin factory + theme identity constants (starter qualifies; denali/urban/guest-club do not).

---

### Export Encapsulation — Denali Root Barrel Leak
- **Status:** Fail
- **Severity:** Critical
- **Description:** Root export `"."` re-exports 100+ symbols from `internal.ts`, `composites/`, `finance/`, `photos/`, `clone/`, `acl/`, and smoke fixtures — far beyond `WorkspacePlugin` contract. Any consumer importing `@app-tour/workspace-denali` (without a subpath) bypasses `./plugin` encapsulation entirely. `guard-denali-plugin-surface` guards `denali.plugin.ts` only, not `index.ts`.
- **Location:** `packages/workspaces/denali/package.json` lines 9–12 (`"."` export); `packages/workspaces/denali/src/index.ts` lines 1–141 (re-exports `internal`, `composites`, `finance`, `photos`, `clone`, `acl`, etc.).
- **Fix:** Slim `index.ts` to re-export only the six `./plugin` contract symbols. Move all other symbols off the root barrel; remove `"."` export or make it a deprecated re-export of `./plugin` only. Add `guard:workspace-root-barrel` CI check.

---

### Export Encapsulation — Denali Wildcard Subpaths
- **Status:** Fail
- **Severity:** High
- **Description:** Four wildcard export patterns expose entire internal directories without explicit allowlisting: `./ui/adapters/*`, `./ui/logic/*`, `./ui/hooks/*`, `./ui/test-ids/*`. Any file added under these dirs becomes public API surface automatically.
- **Location:** `packages/workspaces/denali/package.json` lines 256–263, 300–303, 464–467, 536–539.
- **Fix:** Replace wildcards with explicit subpath entries (or remove from `exports` and route hosts through manifest-bound surfaces). Ban `*` in workspace `exports` via `guard:workspace-export-surface`.

---

### Export Encapsulation — Denali Non-Contract Subpaths (131)
- **Status:** Fail
- **Severity:** High
- **Description:** Denali exposes 131 subpaths outside the `WorkspacePlugin` contract. Host apps (`apps/web`, `apps/api`, `apps/marketing`, `workspace-plugin-host`) import these directly via codegen binding files instead of resolving behavior through `getDenaliWorkspacePlugin()`. Largest leak categories: UI chrome/surfaces (60+), wizard engine (12), settings enrichers (11), HTTP/finance side-effects (4).
- **Location:** `packages/workspaces/denali/package.json` lines 17–547 (full debt inventory below).
- **Fix:** Migrate host bindings to read surfaces from `WorkspacePlugin` fields (`wizardHost`, `operatorSettings`, `catalogIntake`, etc.). Deprecate leaf subpaths per row in `docs/dev/denali-plugin-encapsulation.mdoc` migration map. Target: ≤10 manifest-codegen subpaths + `./plugin` + theme/messages.

**Complete denali debt subpath inventory:**

| Category | Subpaths |
|----------|----------|
| Plugin shim | `./plugin-for-wizard-engine` |
| Adapters | `./adapters/canonical-basics` |
| Catalog / registration | `./catalog-registration-flow`, `./catalog-registration-flow/react` |
| Composites | `./composites`, `./composites/wizard-composite-registry-surface` |
| Draft | `./draft`, `./draft/wizard-draft-unification-surface`, `./draft/tour-wizard` |
| ACL / canonical | `./acl` |
| Schemas | `./schemas/file-asset` |
| Settings (11) | `./settings/theme-compatible-categories`, `./settings/equipment-compatible-categories`, `./settings/equipment-icon-registry`, `./settings/equipment-compatible-themes`, `./settings/destination-location-types`, `./settings/destination-settings-surface`, `./settings/wizard-template-long-description`, `./settings/wizard-template-catalog-meta`, `./settings/wizard-template-editor`, `./settings/wizard-template-preset-surface`, `./settings/wizard-template-roadmap` |
| Wizard engine (12) | `./wizard/rules-loader`, `./wizard/wizard-rules-surface`, `./wizard/build-field-step-resolver`, `./wizard/validation`, `./wizard/submit`, `./wizard/catalog-sanitize`, `./wizard/template-invariants`, `./wizard/host-hooks`, `./wizard/contextual`, `./wizard/canonical-form-sync`, `./wizard/resolve-initial-step-index` |
| Clone / edit / tours | `./clone/hydration`, `./clone`, `./edit`, `./tours`, `./tours/tour-list-category-surface` |
| Photos | `./photos` |
| Program | `./program/itinerary` |
| Finance | `./finance/api-tour-created-adapter` |
| HTTP | `./http`, `./http/routes` |
| Exposure | `./exposure` |
| Marketing | `./marketing`, `./marketing/marketing-catalog-surface` |
| UI barrel | `./ui` |
| UI surfaces | `./ui/composite-ids`, `./ui/composite-renderers`, `./ui/composite-field`, `./ui/composite-surface`, `./ui/review-surface`, `./ui/review-surface-impl`, `./ui/review/denali-review-step`, `./ui/review/denali-review-validation-summary`, `./ui/review/denali-wizard-content-quality-header`, `./ui/field-label-resolver`, `./ui/operator-ui-components-surface`, `./ui/settings/settings-equipment-ui-surface`, `./ui/create-wizard`, `./ui/flat-edit` |
| UI chrome (18) | `./ui/chrome/wizard-draft-shell-surface`, `./ui/chrome/wizard-create-chrome-surface`, `./ui/chrome/wizard-flat-edit-chrome-surface`, `./ui/chrome/wizard-flat-edit-form-surface`, `./ui/chrome/wizard-flat-edit-page-surface`, `./ui/chrome/wizard-create-view-surface`, `./ui/chrome/draft-form-adapter`, `./ui/chrome/draft-persist`, `./ui/chrome/create-submit-logic`, `./ui/chrome/tour-create-payload`, `./ui/chrome/wizard-validation`, `./ui/chrome/flat-edit-plan`, `./ui/chrome/denali-flat-edit-validation-list`, `./ui/chrome/draft-binding`, `./ui/chrome/create-tour-wizard-screen`, `./ui/chrome/use-create-tour-wizard-core`, `./ui/chrome/denali-create-tour-wizard-view`, `./ui/chrome/denali-flat-edit-form`, `./ui/chrome/flat-edit-page-screen`, `./ui/chrome/flat-edit-patch-logic`, `./ui/chrome/use-flat-edit-page-core` |
| UI fields (22) | `./ui/fields/tour-kind`, `./ui/fields/difficulty-level`, `./ui/fields/transport-mode`, `./ui/fields/elevation-gain`, `./ui/fields/approximate-return-time`, `./ui/fields/publish-status`, `./ui/fields/peak-experience`, `./ui/fields/social-media-link`, `./ui/fields/pricing-participants`, `./ui/fields/pricing-payment`, `./ui/fields/custom-services`, `./ui/fields/tour-services`, `./ui/fields/guide-language-ids`, `./ui/fields/leader-user-ids`, `./ui/fields/gear`, `./ui/fields/program-content`, `./ui/fields/datetime`, `./ui/fields/datetime-end`, `./ui/fields/destination`, `./ui/fields/gathering-points`, `./ui/fields/location-zones`, `./ui/fields/photos`, `./ui/fields/itinerary` |
| UI components (18) | `./ui/components/difficulty-range-slider`, `./ui/components/location-picker-map`, `./ui/components/denali-photo-preview`, `./ui/components/denali-map-preview`, `./ui/components/denali-itinerary-segment-destination-field`, `./ui/components/denali-searchable-select`, `./ui/components/equipment-catalog-avatar`, `./ui/components/equipment-icon-picker`, `./ui/components/denali-itinerary-segment-photo-picker`, `./ui/components/denali-location-address-picker`, `./ui/components/denali-location-point-editor`, `./ui/components/localized-date-picker`, `./ui/components/localized-datetime-picker`, `./ui/components/calendar/denali-calendar`, `./ui/components/localized-numeric-input`, `./ui/components/denali-time-input` |
| UI adapters (explicit) | `./ui/adapters/photo-upload-client`, `./ui/adapters/photo-upload-errors`, `./ui/adapters/wizard-media-bff-path`, `./ui/adapters/submit-catalog-fetch`, `./ui/adapters/theme-catalog-fetch` |
| Wildcards (4) | `./ui/adapters/*`, `./ui/logic/*`, `./ui/hooks/*`, `./ui/test-ids/*` |

---

### Export Encapsulation — Urban Root Barrel + HTTP Leak
- **Status:** Warning
- **Severity:** High
- **Description:** Root `"."` re-exports `URBAN_FIELD_REGISTRY`, `URBAN_RULE_SET`, `URBAN_WIZARD_SURFACE`, validation hooks, and smoke constants from `urban.plugin.ts` — coupling consumers to registry internals instead of `getUrbanWorkspacePlugin()`. Eight additional debt subpaths expose HTTP handlers, auth, catalog, exposure, and registration-flow surfaces directly. No `guard-urban-plugin-surface.mjs` exists.
- **Location:** `packages/workspaces/urban/package.json` lines 9–48; `packages/workspaces/urban/src/index.ts` lines 1–24; consumers: `apps/api/src/middleware/workspace-http-error-map.generated.ts` lines 9–12, `apps/api/src/http/workspace-http-routes.generated.ts` line 16.
- **Fix:** Slim urban root barrel to plugin factory + id/type + theme constants only. Add `guard-urban-plugin-surface.mjs`. Route HTTP error codes through `WorkspacePlugin` lifecycle or a single `./http` manifest-bound entry (not `./auth`, `./catalog`, `./exposure` separately).

**Complete urban debt subpath inventory:** `./catalog-registration-flow`, `./catalog-registration-flow/react`, `./http`, `./http/routes`, `./tours`, `./auth`, `./catalog`, `./exposure`

---

### Export Encapsulation — Starter Missing `./plugin` Entry
- **Status:** Warning
- **Severity:** Medium
- **Description:** Starter omits `./plugin` subpath — only root `"."` and `./exposure` are non-theme exports. Manifest consumers must import `@app-tour/workspace-starter` root barrel instead of the canonical `./plugin` pattern used by denali/urban. `./exposure` exposes `starter-exposure.surface` outside the plugin object.
- **Location:** `packages/workspaces/starter/package.json` lines 8–19; `packages/workspaces/starter/src/index.ts` lines 1–4; contrast `packages/workspaces/denali/package.json` lines 13–16.
- **Fix:** Add `"./plugin": { "types": "./dist/starter.plugin.d.ts", "default": "./dist/starter.plugin.js" }`. Fold `./exposure` into `WorkspacePlugin.exposureSurface` accessor; remove standalone export.

**Complete starter debt subpath inventory:** `./exposure`

---

### Export Encapsulation — Guest-Club Non-Standard Plugin Path
- **Status:** Warning
- **Severity:** Medium
- **Description:** Guest-club uses `./guest-club.plugin` instead of canonical `./plugin` — breaks uniform manifest `plugin.entry: "./plugin"` convention. Root barrel exports smoke fixtures (`GUEST_CLUB_SMOKE_*`) alongside plugin factory. Five debt subpaths expose catalog, HTTP, and registration-flow outside contract.
- **Location:** `packages/workspaces/guest-club/package.json` lines 13–37; `packages/workspaces/guest-club/src/index.ts` lines 1–6; `packages/workspace-plugin-host/src/register-guest-club.generated.ts` line 12 (`@app-tour/workspace-guest-club/guest-club.plugin`).
- **Fix:** Rename export to `./plugin` (alias old path deprecated for one release). Remove smoke fixture exports from root barrel. Consolidate `./catalog`, `./http`, `./http/routes`, `./catalog-registration-flow` behind plugin surfaces.

**Complete guest-club debt subpath inventory:** `./catalog`, `./catalog-registration-flow`, `./catalog-registration-flow/react`, `./http`, `./http/routes`

---

### Export Encapsulation — Manifest-Codegen Coupling (Systemic)
- **Status:** Warning
- **Severity:** High
- **Description:** `workspace.manifest.json` declares 30+ `export` bindings pointing at debt subpaths (e.g. `denaliWizardRulesSurface` → `./wizard/wizard-rules-surface`), and codegen emits static imports in `apps/web/src/bootstrap/*.generated.ts` and `apps/api/src/**/*.generated.ts`. This architectural pattern **institutionalizes** encapsulation leaks — every new manifest binding adds a permanent public subpath.
- **Location:** `packages/workspaces/denali/workspace.manifest.json` lines 142–399 (surface bindings); `apps/web/src/bootstrap/workspace-wizard-rules-bindings.generated.ts` line 7; `apps/api/src/settings/workspace-settings-enrichers.generated.ts` lines 7–8; `docs/dev/denali-plugin-encapsulation.mdoc` lines 31–44 (documents leak as intentional interim).
- **Fix:** Introduce `WorkspacePluginHostSurface` registry on the plugin object; codegen should import only `@app-tour/workspace-<id>/plugin` and call typed accessors. Add `guard:workspace-export-allowlist` comparing `package.json` `exports` keys against manifest + contract allowlist; fail on drift.

---

### Export Encapsulation — Guard Coverage
- **Status:** Warning
- **Severity:** Medium
- **Description:** Only denali `./plugin` **file exports** are guarded (`guard-denali-plugin-surface.mjs`). No guard validates `package.json` `exports` keys, root barrel re-exports, wildcard patterns, or urban/starter/guest-club plugin surfaces.
- **Location:** `scripts/guards/guard-denali-plugin-surface.mjs` lines 14–21 (6-symbol allowlist on `denali.plugin.ts` only); no `guard-urban-plugin-surface.mjs`; no `guard:workspace-export-surface`.
- **Fix:** Ship `guard:workspace-export-surface.mjs` — per workspace, fail when `exports` contains keys outside `{ ".", "./plugin", "./theme/*", "./messages/*" }` plus an explicit manifest-codegen allowlist file. Wire into `phase-6:fast-track`.

---

## Supplement — Catch Block Error Leakage Audit (`apps/api/src`)

**Audit date:** 2026-07-07  
**Scope:** All `catch` blocks in `apps/api/src/**/*.{ts,tsx}` (spec files excluded).  
**Method:** Automated brace-balanced catch-block scanner + manual review of error-mapper helpers invoked from catch paths and `handleHttpError` fallback chain.  
**Scan volume:** **217** `catch` blocks across **~95** production source files.

### Catch block audit summary

| Category | Count | Severity |
|----------|------:|----------|
| **Critical — raw `err.message` in HTTP 500 response** | 1 | Critical |
| **High — `error.message` forwarded as client `code`/`error` via mapper or interceptor fallback** | 6 patterns | High |
| **Medium — typed domain `error.message` in client response** | 12 catch sites | Medium |
| **Medium — raw `error.message` logged in catch** | 14 catch sites | Medium |
| **Medium — raw message persisted to integration job record** | 1 | Medium |
| **Prisma object serialized directly to client in catch** | **0** | — |
| **Catch blocks delegating to `handleHttpError` (500 path masks correctly)** | ~150+ | Pass |

---

### Catch Block Security — `tenants-create.ts` Unhandled 500 Leak
- **Status:** Fail
- **Severity:** Critical
- **Description:** Final `catch` arm returns `(err as Error)?.message` in the JSON body on HTTP 500. Any unhandled error — including Prisma `PrismaClientKnownRequestError` with SQL-adjacent engine text — is serialized directly to the platform provision client. No `handleHttpError` delegation; no correlation id.
- **Location:** `apps/api/src/routes/platform/tenants-create.ts` lines 76–96 (`catch (err: unknown)` → line 95 `res.end(JSON.stringify({ error: (err as Error)?.message || "provision_failed" }))`).
- **Fix:** Replace with opaque `{ error: "internal_error", code: "PROVISION_FAILED" }` + `handleHttpError(res, err)` or `logInternalServerError` + correlation id. Never expose `err.message` on 500.

---

### Catch Block Security — `handleHttpError` Message Fallback (Interceptor)
- **Status:** Fail
- **Severity:** High
- **Description:** When catch blocks delegate to `handleHttpError` and the error is not a recognized typed/domain class, the interceptor forwards raw `error.message` as both `error` and `code` fields for non-500 mapped statuses (lines 602–607). A Prisma or Node internal error whose message does not map to status 500 will leak engine text to the client. This is the **primary amplification path** for ~150 catch blocks that call `handleHttpError(res, error)`.
- **Location:** `apps/api/src/middleware/error-interceptor.ts` lines 588–607 (`const message = error instanceof Error ? error.message : "unknown_error"` → `sendHttpError(res, status, { error: message, code: message })`).
- **Fix:** For unrecognized errors, always return opaque `{ error: "internal_error" }` on 500 and stable machine codes on 4xx; use `resolveInternalErrorCode(error)` for logging only, never as client body. Add `mapPrismaErrorToAppError()` before the message fallback.

---

### Catch Block Security — Message-as-Code Error Mappers (Called from Catch)
- **Status:** Warning
- **Severity:** High
- **Description:** Four route-level error mappers extract `error.message` and pass it as the HTTP `code` field (or unqualified string) to clients. Invoked from `catch` blocks on branding, wizard-photos, avatar, and exposure routes. Safe only when `message` is a known stable code constant; **unsafe** if an unhandled `Error` or Prisma error reaches the mapper before the prefix guard — `message.includes("CONTENT_TYPE")` is especially broad.
- **Location:**
  - `apps/api/src/tenant/tenant-branding.routes.ts` lines 44–67 (`mapBrandingError` → line 66 `code: message`)
  - `apps/api/src/tours/tour-wizard-photos.routes.ts` lines 51–65 (`mapWizardPhotoError` → line 65 `code: message`)
  - `apps/api/src/identity/me.avatar.routes.ts` lines 23–37 (`mapOperatorAvatarError` → line 37 `code: message`)
  - `apps/api/src/exposure/exposure.routes.ts` lines 52–64 (`mapExposureRouteError` → `message: error.message` on typed errors — lower risk)
- **Fix:** Replace `code: message` with allowlisted code constants only (`if (message === KNOWN_CODE)`). Unknown messages must fall through to `handleHttpError` after Prisma classification, never pass raw message as `code`.

---

### Catch Block Security — Auth Routes Domain `error.message` in Response
- **Status:** Warning
- **Severity:** Medium
- **Description:** Pre-login auth catch blocks send `error.message` in JSON responses for typed OTP/mobile errors. Messages are controlled domain strings today, but the pattern bypasses `handleHttpError` and would leak if an unexpected error shared the same `instanceof` chain or if domain error messages are ever populated from upstream.
- **Location:**
  - `apps/api/src/identity/auth.routes.ts` lines 105–107, 157–163, 172–176, 253–260
  - `apps/api/src/identity/public-auth.routes.ts` lines 105–111, 164–171, 226–232
- **Fix:** Send stable `code` only; map domain errors to fixed user-facing `error` strings. Log via `logRequestOtpDebug` using `error.code`, not `error.message` (line 161 logs raw message).

---

### Catch Block Security — Users / Drafts Domain Message in Response
- **Status:** Warning
- **Severity:** Medium
- **Description:** Catch blocks return `error.message` for rate-limit and rewards validation paths. Workspace draft version-conflict catch sends full `error.message` plus server payload on 409.
- **Location:**
  - `apps/api/src/identity/users.routes.ts` lines 224–233 (`OtpRateLimitedError` → `error: error.message`), lines 424–429 (`REWARDS_*` prefix → `code: error.message`)
  - `apps/api/src/workspace-drafts/workspace-drafts.routes.ts` lines 31–41 (`error: error.message` on version conflict)
- **Fix:** Use opaque `error` string + stable `code` field. For draft conflicts, return `code: "WORKSPACE_DRAFT_VERSION_CONFLICT"` without echoing exception message.

---

### Catch Block Security — Platform `tenants-get` Catch Logging Stack + Message
- **Status:** Warning
- **Severity:** Medium
- **Description:** Seven inner `catch` blocks call `logPlatformTenantsGetFailure`, which writes raw `err.message` and full `err.stack` to `console.error` as JSON. While responses correctly delegate to `handleHttpError`, logs may contain Prisma/SQL fragments and are not passed through `resolveInternalErrorCode` redaction.
- **Location:** `apps/api/src/routes/platform/tenants-get.ts` lines 12–22 (`logPlatformTenantsGetFailure`), called from catch at lines 59, 74, 85, 104, 114, 125, 142.
- **Fix:** Log `resolveInternalErrorCode(err)` only; never log raw `stack` to stdout in production. Use structured `logger.error({ err, event })` with Pino redaction.

---

### Catch Block Security — Integration / Scheduler Catch Log Leaks
- **Status:** Warning
- **Severity:** Medium
- **Description:** Catch blocks in integration and background scheduler paths log raw `error.message` via `logger.warn({ err: error.message })` or equivalent. Not client-facing, but Prisma connection errors, query text fragments, or host paths may enter log streams.
- **Location:**
  - `apps/api/src/integrations/application/dispatch-integration-domain-event.ts` lines 295, 427, 620
  - `apps/api/src/integrations/http/integrations.service.ts` lines 545, 561
  - `apps/api/src/integrations/worker/start-integration-delivery-worker.ts` lines 58–60
  - `apps/api/src/exposure/start-denali-exposure-reminder-scheduler.ts` lines 164–166
  - `apps/api/src/marketing/schedule-marketing-catalog-revalidate.ts` lines 62–67
  - `apps/api/src/outbox/start-projection-auto-reconcile.ts` lines 92–95
  - `apps/api/src/main.ts` lines 163–165 (boot failure catch)
  - `apps/api/src/settings/bootstrap-workspace-wizard-templates.ts` lines 17–24
  - `apps/api/src/settings/bootstrap-denali-dev-smoke-fixtures.ts` lines 43–46
  - `apps/api/src/settings/bootstrap-operator-smoke-catalog.ts` lines 23–26
- **Fix:** Replace `err: error.message` with `error_code: resolveInternalErrorCode(error)` in all catch logging. Ban raw `error.message` in catch log fields via ESLint rule `no-catch-message-log`.

---

### Catch Block Security — Integration Worker Message Persistence
- **Status:** Warning
- **Severity:** Medium
- **Description:** Catch in delivery worker stores raw `error.message` in the job outcome record (`INTEGRATION_DELIVERY_UNHANDLED`). If job failure details are ever exposed via operator API or admin UI, Prisma/internal text would leak indirectly.
- **Location:** `apps/api/src/integrations/worker/process-integration-delivery-once.ts` lines 121–127.
- **Fix:** Persist `resolveInternalErrorCode(error)` only; keep detail in server-side dead-letter log.

---

### Catch Block Security — Prisma Direct Client Serialization
- **Status:** Pass
- **Severity:** Low
- **Description:** Zero catch blocks serialize a Prisma error object (`PrismaClientKnownRequestError`, `JSON.stringify(err)`) directly into an HTTP response. Prisma types appear only in repository-layer catch for control-flow (P2002 retry, P2025 not-found), not client egress.
- **Location:** Scanned all 217 catch blocks; Prisma handling in `apps/api/src/storage/prisma-tour.repository.ts`, `apps/api/src/http/http-idempotency.ts`, `apps/api/src/outbox/outbox-relay.ts` — internal only.
- **Fix:** Maintain zero-Prisma-response policy; add `guard:catch-no-err-message-response` banning `(err as Error)?.message` and `error: error.message` in files under `routes/` and `*.routes.ts`.

---

### Catch Block Security — Platform Routes Opaque 500 Pattern (Positive)
- **Status:** Pass
- **Severity:** Low
- **Description:** 20+ platform route catch blocks correctly return `{ error: "internal_error" }` on unhandled failures (no message leak). Examples: `tenants-subscription-patch.ts`, `tenants-status-patch.ts`, `tenants-owner-invite-post.ts`, `workspace-definitions-post.ts`.
- **Location:** `apps/api/src/routes/platform/tenants-subscription-patch.ts` lines 66–67; `apps/api/src/routes/platform/tenants-status-patch.ts` lines 81–82; pattern repeated across platform CRUD handlers.
- **Fix:** None. Extend this pattern to `tenants-create.ts` and migrate remaining platform handlers to shared `handlePlatformHttpError` wrapper.

---

### Catch Block Security — Guard Coverage Gap
- **Status:** Warning
- **Severity:** Medium
- **Description:** No CI guard scans catch blocks for `error.message` in client responses or log fields. AP 14 finding (`tenants-create.ts`) was already documented but remains unfixed. `logInternalServerError` correctly uses `resolveInternalErrorCode` (line 246) but is bypassed by platform route manual catch and interceptor fallback.
- **Location:** `apps/api/src/middleware/error-interceptor.ts` lines 236–249 (safe logging); `apps/api/src/observability/log-safety.ts` lines 111–115 (`resolveInternalErrorCode`); no `guard:catch-error-leak` in `package.json` scripts.
- **Fix:** Ship `scripts/guards/guard-catch-error-leak.mjs` — fail on `catch` blocks containing `error.message`/`err.message` adjacent to `sendJson`, `sendHttpError`, `res.end`, or `logger.*` message fields. Wire into `phase-6:fast-track`.

---

## Supplement — Repository RLS Audit (`apps/api/src/**/*repository.ts`)

**Audit date:** 2026-07-07  
**Rule:** Tenant-scoped Prisma models must use `withTenantRls(tenantId, tx => …)` **or** include `tenantId` in the `where` clause. `getPrismaAdmin()` bypass is permitted only for documented platform/worker paths with caller-side authz.  
**Scope:** 18 Prisma-backed `*repository.ts` files (excludes `in-memory-*`, `create-*` factories, and interface-only `tour.repository.ts`).  
**RLS reference:** `operator_registrations`, `user_tenants`, `tours`, `integration_*`, `exposure_*`, workspace settings tables — `ENABLE ROW LEVEL SECURITY` + `app.current_tenant_id` policies. **`operator_pending_invites`** — RLS enabled via migration `20260707110000_operator_pending_invites_rls` (Phase 5).

### Repository RLS summary

| Verdict | Count | Repositories affected |
|---------|------:|-----------------------|
| **Pass** (all tenant paths use `withTenantRls`) | 14 | bookings (except 2 methods), tour, settings×3, workspace-drafts×2, exposure×3, finance×2, integration-connection, integration-policy, identity (invite methods) |
| **Fail** | 0 methods | — |
| **Warning** | 1 method | integration-delivery (admin worker claims) |
| **High (documented bypass)** | 1 method | bookings `getById` admin PK |
| **Exempt (platform-global)** | 6 files | `platform-*` repos, `workspace-definition.repository.ts` |

---

### Repository RLS — `operator_pending_invites` Table Has No RLS
- **Status:** Pass (remediated Phase 5)
- **Severity:** Critical (was)
- **Description:** `operator_pending_invites` is tenant-scoped (`tenant_id` FK). Migration `20260707110000_operator_pending_invites_rls` adds `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + tenant isolation policy. All identity invite repository methods now use `withTenantRls`.
- **Location:** `apps/api/prisma/migrations/20260707110000_operator_pending_invites_rls/migration.sql`; `apps/api/src/identity/prisma-identity.repository.ts` invite methods.
- **Fix:** Shipped Phase 5. See `docs/dev/ci-defensive-guards.mdoc`.

---

### Repository RLS — Identity `operatorPendingInvite` Methods Without `withTenantRls`
- **Status:** Pass (remediated Phase 5)
- **Severity:** High (was)
- **Description:** All six `PrismaIdentityRepository` invite methods now use `withTenantRls(tenantId, tx => …)`. Token and PK lookups are tenant-scoped: `findPendingInvite(tenantId, inviteId)`, `findPendingInviteByToken(tenantId, inviteToken)`, `acceptPendingInvite(tenantId, inviteToken, userId)`.
- **Location:** `apps/api/src/identity/prisma-identity.repository.ts` — `createPendingInvite`, `listPendingInvitesByTenant`, `findPendingInvite`, `findPendingInviteByToken`, `revokePendingInvite`, `acceptPendingInvite`.
- **Fix:** Shipped Phase 5. Cross-tenant token accept returns 404 (RLS fail-closed) instead of 403 tenant mismatch.

---

### Repository RLS — Identity `updateUserMobile` Cross-Tenant `userTenant.updateMany`
- **Status:** Pass (remediated Phase 5b)
- **Severity:** High (was)
- **Description:** Mobile change updates global `users` row via app pool, then bumps `sessionVersion` on **all** memberships via `getPrismaAdmin().userTenant.updateMany({ where: { userId } })`. Previously used `getPrisma().userTenant.updateMany` inside transaction — RLS would silently skip cross-tenant rows, leaving stale sessions.
- **Location:** `apps/api/src/identity/prisma-identity.repository.ts` — `updateUserMobile`.
- **Fix:** Shipped Phase 5b. Documented in `docs/dev/ci-defensive-guards.mdoc` cross-tenant admin paths.

---

### Repository RLS — Bookings `getById` Admin PK Bypass
- **Status:** Warning
- **Severity:** High
- **Description:** `getById(id)` uses `getPrismaAdmin().operatorRegistration.findUnique({ where: { id } })` — no `tenantId` in `where`, no `withTenantRls`. Documented for member-receipt flow where app pool (NOBYPASSRLS) returns zero rows. Enables cross-tenant PK reads at DB layer; security depends entirely on caller authz (`finance.service.ts` enforces `booking.tenantId === auth.tenantId`).
- **Location:** `apps/api/src/bookings/prisma-bookings.repository.ts` lines 317–324.
- **Fix:** Two-step pattern: admin PK lookup for `tenantId` only, then `withTenantRls(tenantId, tx => tx.operatorRegistration.findFirst({ where: { id, tenantId } }))`. Add `guard:bookings-getbyid-tenant-scope` on callers.

---

### Repository RLS — Bookings `listOutboxByAggregate` Pre-Fetch Without RLS
- **Status:** Pass (remediated Phase 1 / verified Phase 5b)
- **Severity:** Medium (was)
- **Description:** Uses admin probe pattern: `getPrismaAdmin().operatorRegistration.findUnique({ select: { tenantId: true } })` then `withTenantRls` for outbox fetch. Same two-step contract as `getById`.
- **Location:** `apps/api/src/bookings/prisma-bookings.repository.ts` — `listOutboxByAggregate`.
- **Fix:** Shipped. See `docs/dev/list-projection-guards.mdoc` AP5 section.

---

### Repository RLS — Integration Delivery Worker Admin Claims
- **Status:** Warning
- **Severity:** Medium
- **Description:** `claimPendingBatch` uses `getPrismaAdmin()` raw SQL when `INTEGRATION_DELIVERY_TENANT_SCOPE` is unset — cross-tenant job claim by design. `claimPendingForTenant` uses admin client but filters `tenant_id = $tenantId` in SQL. `markDone`/`markFailed`/`markDead` correctly use `withTenantRls` but `update({ where: { id } })` relies on RLS session — acceptable when wrapper is present.
- **Location:** `apps/api/src/integrations/infrastructure/prisma-integration-delivery.repository.ts` lines 58–65, 120–172 (`claimPendingGlobal`), 174–228 (`claimPendingForTenant`).
- **Fix:** Document worker paths in runbook; require `INTEGRATION_DELIVERY_TENANT_SCOPE` in production. Add metric when global claim path is used.

---

### Repository RLS — Settings Resources PK-Only Mutations Inside `withTenantRls`
- **Status:** Pass
- **Severity:** Low
- **Description:** `prisma-settings-resources.repository.ts` uses `delete({ where: { id: itemId } })` and `update({ where: { id: record.id } })` without explicit `tenantId` in `where`, but all paths are inside `withTenantRls(tenantId, …)` and preceded by `get*(tenantId, itemId)` guard. RLS session var enforces tenant isolation at DB layer.
- **Location:** `apps/api/src/settings/prisma-settings-resources.repository.ts` lines 273, 301, 388, 415, 499, 526, 619, 647, 799, 811, 867, 898.
- **Fix:** None required. Optional: add `tenantId` to `where` for defense-in-depth readability.

---

### Repository RLS — Prisma Repositories Fully Wrapped (Positive)
- **Status:** Pass
- **Severity:** Low
- **Description:** All tenant-scoped methods in these repositories consistently use `withTenantRls` with `tenantId` in `where` clauses. No bare `getPrisma()` access to tenant-scoped models.
- **Location:**
  - `apps/api/src/storage/prisma-tour.repository.ts` — compound `tenantId_id` lookups (lines 89–96, 151–168)
  - `apps/api/src/workspace-finance/finance.repository.ts` — 17 `withTenantRls` call sites
  - `apps/api/src/denali-finance/finance.repository.ts` — mirror of workspace-finance
  - `apps/api/src/settings/prisma-settings-config.repository.ts` lines 25–61
  - `apps/api/src/settings/prisma-settings-audit.repository.ts` lines 29–39
  - `apps/api/src/workspace-drafts/prisma-workspace-drafts.repository.ts` lines 66–154
  - `apps/api/src/workspace-drafts/prisma-workspace-draft-events.repository.ts` lines 42–65
  - `apps/api/src/exposure/prisma-exposure-intent.repository.ts` lines 88–138
  - `apps/api/src/exposure/prisma-exposure-profile.repository.ts` lines 64–86
  - `apps/api/src/exposure/denali-reminder-activation.repository.ts` lines 35–51
  - `apps/api/src/integrations/infrastructure/prisma-integration-connection.repository.ts` lines 59–113
  - `apps/api/src/integrations/infrastructure/prisma-integration-policy.repository.ts` lines 74–169
  - `apps/api/src/bookings/prisma-bookings.repository.ts` — list/mutate paths (lines 174–454, except `getById`/`listOutboxByAggregate`)
- **Fix:** None. Use as reference implementations for new repositories.

---

### Repository RLS — Platform-Global Repositories (Exempt)
- **Status:** Pass
- **Severity:** Low
- **Description:** Platform and workspace-definition repositories intentionally use `getPrismaAdmin()` for cross-tenant platform ops (`tenants`, `platform_ops_users`, `workspace_definitions`). Not tenant-scoped operator data paths.
- **Location:** `apps/api/src/platform/platform-tenant.repository.ts`; `apps/api/src/platform/platform-subscription.repository.ts`; `apps/api/src/platform/platform-domain.repository.ts`; `apps/api/src/platform/platform-plan.repository.ts`; `apps/api/src/platform/platform-ops-user.repository.ts`; `apps/api/src/workspace-metadata/workspace-definition.repository.ts`.
- **Fix:** None. Keep separate from operator tenant-scoped repository guard scan.

---

### Repository RLS — Global Identity Tables (Exempt)
- **Status:** Pass
- **Severity:** Low
- **Description:** `User` and `MobileOtpChallenge` models have no `tenantId` column — global auth primitives. `getPrisma()` access in `findUserByMobile`, `findUserById`, `createOtpChallenge`, `findOtpChallenge`, `markOtpChallengeUsed`, `registerPublicGuest` user creation, and `updateUserMobile` user row update is correct (not tenant-scoped tables).
- **Location:** `apps/api/src/identity/prisma-identity.repository.ts` lines 102–116, 134–170, 536–538, 606–610.
- **Fix:** None for global tables. Do not extend exempt status to `operatorPendingInvite` or `userTenant` paths.

---

### Repository RLS — Guard Coverage Gap
- **Status:** Pass (remediated Phase 5)
- **Severity:** Medium (was)
- **Description:** `scripts/guards/guard-repository-rls.mjs` scans `apps/api/src/**/*repository.ts` for bare `getPrisma().<tenantModel>` outside `withTenantRls` or documented `getPrismaAdmin` probe paths. Wired into `phase-6:fast-track`. Static spec: `apps/api/test/identity-pending-invite-rls.spec.ts`.
- **Location:** `scripts/guards/guard-repository-rls.mjs`; `package.json` `guard:repository-rls`; `docs/dev/ci-defensive-guards.mdoc`.
- **Fix:** Shipped Phase 5. `updateUserMobile` remains on LEGACY_ALLOWLIST (deferred follow-up).

---

## Supplement — Unbounded `findMany` Audit (`apps/api/src/**/*.repository.ts`)

**Audit date:** 2026-07-07  
**Rule:** Every Prisma `findMany` in repository files must include **`take:`** (pagination bound) or **`select:`** (column projection). Queries with neither are high-risk unbounded reads.  
**Method:** Brace-balanced parser across all `*.repository.ts` under `apps/api/src` (48 `findMany` calls found).  
**Existing guard:** `scripts/guards/guard-unbounded-list.mjs` covers only `operatorRegistration.findMany` and `tour.findMany` — 17 of 19 unbounded calls are **unguarded**.

### `findMany` scan summary

| Metric | Count |
|--------|------:|
| Total `findMany` calls | 48 |
| **Bounded** (`take` and/or `select`) | 29 |
| **Unbounded** (no `take`, no `select`) | **19** |
| Covered by `guard-unbounded-list` | 1 (bookings `listByTenant`, allowlisted) |
| **Unguarded unbounded** | **18** |

---

### Unbounded `findMany` — Bookings `listByTenant` (Legacy)
- **Status:** Fail
- **Severity:** Critical
- **Description:** `listByTenant` loads **all** `operatorRegistration` rows for a tenant with no `take` or `select` — includes full `registrationIntake` JSON per row. Used by duplicate-finder helpers in `bookings.service.ts`. Explicitly allowlisted in `guard-unbounded-list.mjs` until migration.
- **Location:** `apps/api/src/bookings/prisma-bookings.repository.ts` lines 173–179 (`listByTenant` → `operatorRegistration.findMany`); `scripts/guards/guard-unbounded-list.mjs` lines 27–31.
- **Fix:** Replace callers with targeted `findFirst` queries or `listByTenantPage` + `BOOKING_LIST_SELECT`. Remove guard allowlist entry.

---

### Unbounded `findMany` — Tour `listByTenantPage` (Take Without Select)
- **Status:** Warning
- **Severity:** High
- **Description:** Paginated tour list has `take: limit + 1` but **no `select`** — every page row loads full `canonical` Json. Passes `guard-unbounded-list` via `take` only; still a projection bottleneck at scale.
- **Location:** `apps/api/src/storage/prisma-tour.repository.ts` lines 207–211 (`listByTenantPage`).
- **Fix:** Add tour list projection `select` excluding `canonical` (or slim canonical slice). Wire operator list through `listPage` instead of `ScopedTourRepository.findMany`.

---

### Unbounded `findMany` — Identity Membership & Invites
- **Status:** Fail
- **Severity:** High
- **Description:** Two tenant-scoped `findMany` calls load full row sets without bound or projection.
- **Location:**
  - `apps/api/src/identity/prisma-identity.repository.ts` line 129 — `listMembershipsByTenant` → `userTenant.findMany({ where: { tenantId } })`
  - `apps/api/src/identity/prisma-identity.repository.ts` lines 194–196 — `listPendingInvitesByTenant` → `operatorPendingInvite.findMany({ where: { tenantId, status: "INVITED" } })`
- **Fix:** Add `take` + cursor for large tenants; add `select` projecting only fields needed for directory UI. Wrap invite list in `withTenantRls` (see RLS audit).

---

### Unbounded `findMany` — Settings Resource Catalogs (7 Methods)
- **Status:** Warning
- **Severity:** High
- **Description:** Seven list methods load entire per-tenant workspace catalogs (equipment, themes, languages, presets, regions, destinations) with `where: { tenantId }` only — no `take`, no `select`. Acceptable for small catalogs today; unbounded as tenants grow resource libraries.
- **Location:** `apps/api/src/settings/prisma-settings-resources.repository.ts`:
  - `listEquipment` line 210
  - `listTourThemes` line 307
  - `listGuideLanguages` line 421
  - `listTourPresets` line 532
  - `listRegions` line 653
  - `listDestinations` line 663
- **Fix:** Add `select` listing only fields required by settings UI; cap with `take: MAX_SETTINGS_CATALOG` (e.g. 500) + guard. Slug-uniqueness queries at lines 190, 195, 356, 465 already use `select` — **Pass**.

---

### Unbounded `findMany` — Settings Audit Trail
- **Status:** Fail
- **Severity:** High
- **Description:** `listByTenant` loads all `operatorSettingsAuditEvent` rows for a tenant — append-only audit table grows without bound.
- **Location:** `apps/api/src/settings/prisma-settings-audit.repository.ts` lines 28–34 (`listByTenant`).
- **Fix:** Keyset paginate on `(occurredAt desc, id desc)` with `take: limit + 1`; project with `select` excluding large JSON payload fields if present.

---

### Unbounded `findMany` — Integration Connections & Policies
- **Status:** Fail
- **Severity:** High
- **Description:** Three `findMany` calls load full `integrationConnection` rows including **`credentials` Json** — no `take`, no `select`.
- **Location:**
  - `apps/api/src/integrations/infrastructure/prisma-integration-connection.repository.ts` lines 113–123 (`listForWorkspace`)
  - `apps/api/src/integrations/infrastructure/prisma-integration-policy.repository.ts` lines 75–85 (`listEnabledConnectionsForScope`)
  - `apps/api/src/integrations/infrastructure/prisma-integration-policy.repository.ts` lines 102–107 (`listPoliciesForConnection`)
- **Fix:** Add `select` excluding `credentials` on list paths (load credentials only on `findUnique` detail). Bound connection lists with `take` — typical tenant has <20 connections but not enforced.

---

### Unbounded `findMany` — Exposure Intents
- **Status:** Warning
- **Severity:** Medium
- **Description:** `listForConnectionScope` loads all `exposureIntent` rows for a connection scope without `take` or `select`. JSON `scope`/`policy` fields may be large.
- **Location:** `apps/api/src/exposure/prisma-exposure-intent.repository.ts` lines 110–119.
- **Fix:** Add `select` for list projection; paginate if intent count can exceed ~100 per connection.

---

### Unbounded `findMany` — Workspace Draft Events (In-Memory Pagination)
- **Status:** Fail
- **Severity:** High
- **Description:** `listByDraft` fetches **all** `workspaceDraftEvent` rows for a draft key, then sorts and `.slice(0, limit)` in application memory. SQL has no `take` — worst-case loads entire event history.
- **Location:** `apps/api/src/workspace-drafts/prisma-workspace-draft-events.repository.ts` lines 61–79 (`listByDraft`).
- **Fix:** Push `take: limit` + `orderBy: { createdAt: 'desc' }` into Prisma query; add `select` excluding large event payloads if not needed for list view.

---

### Unbounded `findMany` — Bookings Outbox by Aggregate
- **Status:** Warning
- **Severity:** Medium
- **Description:** `listOutboxByAggregate` loads all `outboxEvent` rows for an aggregate without `take`. Typically small per booking but unbounded for long-lived aggregates.
- **Location:** `apps/api/src/bookings/prisma-bookings.repository.ts` lines 335–339.
- **Fix:** Add `take: MAX_OUTBOX_EVENTS_PER_AGGREGATE` or keyset pagination; `select` payload only when needed.

---

### Unbounded `findMany` — Platform Subscription Batch
- **Status:** Warning
- **Severity:** Medium
- **Description:** `listExpiredPastDue` scans all `tenantSubscription` rows with `status: "past_due"` — cross-tenant platform query with `include: { plan: true }`, no `take`. Scales with platform tenant count.
- **Location:** `apps/api/src/platform/platform-subscription.repository.ts` lines 69–76.
- **Fix:** Batch with `take: BATCH_SIZE` + cursor; run in scheduler loop. Platform-admin scope — acceptable short-term with batching.

---

### Unbounded `findMany` — Platform Plan Catalog
- **Status:** Pass
- **Severity:** Low
- **Description:** `platformPlan.findMany({ orderBy: { id: "asc" } })` — unbounded but **fixed small catalog** (handful of plan rows). Low production risk.
- **Location:** `apps/api/src/platform/platform-plan.repository.ts` line 16.
- **Fix:** None required. Optional `take: 50` for symmetry.

---

### Unbounded `findMany` — Bounded Queries (Positive Reference)
- **Status:** Pass
- **Severity:** Low
- **Description:** 29 `findMany` calls correctly use `take` and/or `select`. Finance repos exemplify dual constraint (`take` + `select` on payments/outbox). Bookings `listByTenantPage`, platform tenant list, tour pagination, draft snapshot list, and role-audit history are bounded.
- **Location:** `apps/api/src/workspace-finance/finance.repository.ts` lines 92–521; `apps/api/src/bookings/prisma-bookings.repository.ts` lines 202–207; `apps/api/src/platform/platform-tenant.repository.ts` lines 49–53; `apps/api/src/workspace-drafts/prisma-workspace-drafts.repository.ts` lines 74–90; `apps/api/src/identity/prisma-identity.repository.ts` lines 513–517 (`take: 50`).
- **Fix:** None. Use as template for remediating unbounded calls.

---

### Unbounded `findMany` — Guard Coverage Gap
- **Status:** Warning
- **Severity:** High
- **Description:** `guard-unbounded-list.mjs` scans only `operatorRegistration.findMany` and `tour.findMany`. **18 of 19** unbounded `findMany` calls across settings, identity, integrations, exposure, drafts, and platform repos are invisible to CI.
- **Location:** `scripts/guards/guard-unbounded-list.mjs` lines 19–22 (`FIND_MANY_PATTERNS`); `package.json` `phase-6:fast-track` includes guard.
- **Fix:** Extend guard to **all** `.findMany(` in `apps/api/src/**/*.repository.ts` — require `take` or `select` unless on explicit allowlist with expiry. Alias: `guard:unbounded-findmany`.

---

## Supplement — Service-Layer N+1 Loop Audit (`apps/api/src/**/*service.ts`)

**Audit date:** 2026-07-07  
**Rule:** Service methods must not execute Prisma or repository **read/write** queries inside `for`/`for-of`/`for-in` loops or `array.map(async …)` / `Promise.all(…map(async))` when iteration count scales with tenant data (memberships, connections, tours, audit rows, etc.).  
**Method:** Static scan of all **29** `*service.ts` files under `apps/api/src` — multiline grep for loop + `await` + `find*`/`count*`/`list*`/`get*`/`create*`/`update*`/`upsert*`/`remove*` on Prisma or repository deps; manual read of each hit and cross-check of delegated repository methods.  
**False positives excluded:** `registration-capacity.service.ts` line 35 (`for-of` over in-memory capacity rows — no DB).

### Service N+1 scan summary

| Verdict | Count | Notes |
|---------|------:|-------|
| **Fail** (loop + DB, production hot paths) | **6** | identity bulk×4, integrations patch, exposure×2 |
| **Fail** (multiplicative N+1) | **1** | exposure control plane (connections × event types) |
| **Warning** (admin/migration, bounded N) | **2** | canonical migration, dev provisioning seed |
| **Related** (full-tenant scan, no loop) | **5** | bookings duplicate finders + user booking summary |
| **Pass** (no loop+query in service layer) | **20** | remaining `*service.ts` files |

---

### Service N+1 — `listUsersDirectory` (Critical)
- **Status:** Pass (remediated Phase 5c)
- **Severity:** Critical (was)
- **Description:** Single `listMembershipsWithUsersByTenant` join query (`userTenant` + `user` include) replaces per-membership `findUserById`. Filter/sort/pagination remain in-memory (unchanged HTTP contract).
- **Location:** `apps/api/src/identity/prisma-identity.repository.ts` — `listMembershipsWithUsersByTenant`; `apps/api/src/identity/users.service.ts` — `listUsersDirectory`.
- **Fix:** Shipped Phase 5c. Future: SQL-side filter/pagination via `listUsersDirectoryPage`.

---

### Service N+1 — `getWorkspaceUserRoleHistory`
- **Status:** Pass (remediated Phase 5c)
- **Severity:** High (was)
- **Description:** Batched actor lookup via `findUsersByIds(unique actorUserIds)` — one global `users.findMany` instead of up to 50 sequential `findUserById` calls.
- **Location:** `apps/api/src/identity/users.service.ts` — `getWorkspaceUserRoleHistory`.
- **Fix:** Shipped Phase 5c.

---

### Service N+1 — `runBulkMutation` (Bulk Role / Suspend / Reactivate)
- **Status:** Pass (partial — Phase 5e)
- **Severity:** High (was)
- **Description:** `loadBulkUserMutationPrefetch` loads memberships + users once; mutators accept optional prefetch to skip per-user lookups. Per-user writes/audits remain sequential for error collection.
- **Location:** `apps/api/src/identity/users.service.ts` — `runBulkMutation`, bulk patch/suspend/reactivate.
- **Fix:** Shipped Phase 5e. Repository-level bulk transaction deferred.

---

### Service N+1 — `bulkRemoveWorkspaceUsers`
- **Status:** Pass (partial — Phase 5d)
- **Severity:** High (was)
- **Description:** Prefetches `findMembershipsByUserIds` + `findUsersByIds` before the remove loop (2 queries vs 2N). Per-user `removeWorkspaceUser` remains sequential for error collection.
- **Location:** `apps/api/src/identity/users.service.ts` — `bulkRemoveWorkspaceUsers`.
- **Fix:** Shipped Phase 5d prefetch. Full bulk delete transaction deferred.

---

### Service N+1 — `getWorkspaceUserBookingSummary` (Full-Tenant Load)
- **Status:** Fail
- **Severity:** High
- **Description:** Not a loop, but same class of bug: loads **entire tenant** via unbounded `listByTenant`, then filters in memory by `submittedByUserId`. One user profile view can pull all registration rows + `registrationIntake` JSON for the workspace.
- **Location:** `apps/api/src/identity/users.service.ts` lines 641–644; delegates to `apps/api/src/bookings/prisma-bookings.repository.ts` `listByTenant` lines 173–179.
- **Fix:** Add `countBySubmittedByUser` / `listBySubmittedByUser` with `select` summary fields and `take` on detail drill-down. Cross-ref unbounded `findMany` supplement.

---

### Service N+1 — `listWorkspaceIntegrations`
- **Status:** Pass (remediated Phase 5c)
- **Severity:** High (was)
- **Description:** `listForWorkspace` now maps `createdAt`/`updatedAt` on `IntegrationConnectionRecord`. Removed per-row `findUnique` re-fetch in service layer.
- **Location:** `apps/api/src/integrations/infrastructure/prisma-integration-connection.repository.ts`; `apps/api/src/integrations/http/integrations.service.ts` — `listWorkspaceIntegrations`.
- **Fix:** Shipped Phase 5c.

---

### Service N+1 — `patchIntegration` Event Policy Loop
- **Status:** Pass (remediated Phase 5e)
- **Severity:** Medium (was)
- **Description:** Event policy upserts moved to `sync-integration-event-policies.ts` (infrastructure). Service validates patches against provider `defaultEventPolicies` allowlist before delegating.
- **Location:** `apps/api/src/integrations/infrastructure/sync-integration-event-policies.ts`; `patchIntegration` in `integrations.service.ts`.
- **Fix:** Shipped Phase 5e.

---

### Service N+1 — `getWorkspaceExposureSurfaces`
- **Status:** Pass (remediated Phase 5d)
- **Severity:** Medium (was)
- **Description:** `findForContexts` batch-loads all surface intents in one `withTenantRls` + `findMany({ OR })` query instead of per-surface `findForContext`.
- **Location:** `apps/api/src/exposure/workspace-exposure-surfaces.service.ts`; `apps/api/src/exposure/prisma-exposure-intent.repository.ts`.
- **Fix:** Shipped Phase 5d.

---

### Service N+1 — `buildConnectionContexts` + `getWorkspaceExposureControlPlane` (Multiplicative)
- **Status:** Warning (partial — Phase 5d)
- **Severity:** Critical (was)
- **Description:** `listForConnectionScope` hoisted once per connection; `connectionIntents` passed into `resolveConnectionExposureIntentForRoute`. Request-scoped cache for `resolvePersistedExposureProfileForContext`. Legacy per-event `findForContext` and profile seed paths may still run in loop.
- **Location:** `apps/api/src/exposure/exposure-control-plane.service.ts` — `buildConnectionContexts`.
- **Fix:** Phase 5d reduced connection-scope re-list from O(eventTypes) to O(1). Further batching deferred.

---

### Service N+1 — `migrateWorkspaceCanonicalForTenant`
- **Status:** Warning
- **Severity:** Medium
- **Description:** Loads all tours once (`findMany` with `select`), then **`prisma.tour.update` per tour** needing migration. Acceptable for rare admin migration with allowlist, but still **O(tours)** writes in a loop — long-running lock risk on large tenants.
- **Location:** `apps/api/src/canonical/migrate-canonical-workspace.service.ts` lines 118–145 (`migrateWorkspaceCanonicalForTenant`).
- **Fix:** Batch updates in chunks inside `$transaction`; or `updateMany` where canonical shape is uniform. Keep allowlist gate; add progress telemetry.

---

### Service N+1 — `seedDevTenants` (Dev-Only)
- **Status:** Warning
- **Severity:** Low
- **Description:** `for (const subdomain of PHASE_43_SEED_SUBDOMAINS)` calls `upsertSeedTenant` sequentially — **one upsert per subdomain**. Bounded to dev seed list (2 entries); guarded by `assertProvisioningDevelopmentOnly`.
- **Location:** `apps/api/src/internal/provisioning.service.ts` lines 82–84 (`seedDevTenants`).
- **Fix:** None required for production. Optional: `Promise.all` for dev speed.

---

### Service N+1 — Bookings Duplicate Finders (Full-Tenant Scan, No Loop)
- **Status:** Fail
- **Severity:** High
- **Description:** Four helpers each call **`repo.listByTenant(tenantId)`** (unbounded full tenant load) then filter in memory — not loop N+1, but **O(tenant registrations)** per duplicate check on guest registration hot path.
- **Location:** `apps/api/src/bookings/bookings.service.ts` lines 160, 182, 204, 225 (`findBookingById`, `findGuestBookingDuplicateByPhone`, `findGuestBookingDuplicateByTourNationalId`, `findGuestBookingDuplicate`).
- **Fix:** Replace with targeted `findFirst`/`findMany({ where: { tenantId, tourId, … }, take: 1, select: … })` using indexed columns. Cross-ref bookings `listByTenant` unbounded supplement.

---

### Service N+1 — Repository Delegation Note (`bulkApproveBookings`)
- **Status:** Warning
- **Severity:** Medium
- **Description:** `bookings.service.ts` `bulkApproveBookings` delegates to `repo.bulkApproveWithOutbox` without a service-layer loop, but the **repository** runs per-booking `$transaction` in a `for-of`. Flagged here because service callers inherit the cost.
- **Location:** `apps/api/src/bookings/bookings.service.ts` line 294 → `apps/api/src/bookings/prisma-bookings.repository.ts` `bulkApproveWithOutbox`.
- **Fix:** Batch approve in single transaction with outbox fan-out; service stays thin.

---

### Service N+1 — Guard Coverage Gap
- **Status:** Pass (remediated Phase 5b)
- **Severity:** High (was)
- **Description:** `scripts/guards/guard-service-n-plus-one.mjs` detects `await` + repository/Prisma queries inside loops in `*service.ts`. Baseline violations on `LEGACY_ALLOWLIST`; admin/migration paths on `ADMIN_ALLOWLIST`. Wired into `phase-6:fast-track`.
- **Location:** `scripts/guards/guard-service-n-plus-one.mjs`; `docs/dev/ci-defensive-guards.mdoc`.
- **Fix:** Shipped Phase 5b. Shrink allowlist as services batch queries (e.g. `listUsersDirectory` join refactor).

---

### Service N+1 — Positive Patterns (Reference)
- **Status:** Pass
- **Severity:** Low
- **Description:** `listBookings` / `getBookingsSummary` use paginated `listByTenantPage` + `countByListFilters` — no loop queries. `settings.service.ts`, `tours.service.ts`, `finance.service.ts`, and `workspace-drafts.service.ts` issue single repository calls per method with no iteration-bound DB access in the service layer.
- **Location:** `apps/api/src/bookings/bookings.service.ts` (`listBookings`); `apps/api/src/settings/settings.service.ts`; `apps/api/src/tours/tours.service.ts`; `apps/api/src/workspace-finance/finance.service.ts`.
- **Fix:** None. Use as template when remediating identity and exposure services.

---

## Supplement — Semantic Color Contract Audit (`apps/web`, `apps/portal`)

**Audit date:** 2026-07-07  
**Rule:** UI must consume the semantic CSS contract (`--color-*` / shadcn semantic tokens like `bg-primary`, `text-muted-foreground`, `text-destructive`). **Forbidden:** raw hex literals (`#fff`, `#2563eb`) in app CSS/TSX and Tailwind palette scale classes (`emerald-500`, `amber-200`, `green-600`, `bg-black/80`) that bypass token theming and tenant/workspace rebrand.  
**Contract refs:** `docs/phase-2-design-system.mdoc` (components read only `var(--color-*)`); `docs/workspaces/denali/unified-semantic-token-schema.mdoc`; `packages/design-tokens` → `--color-success`, `--color-warning`, `--color-danger` mapped in `badge.tsx`.  
**Method:** Ripgrep `#`, Tailwind palette scales (`emerald|amber|green|…-\d`), and `bg-black`/`bg-white` under `apps/web` and `apps/portal` production sources; cross-check existing guards (`guard-admin-feature-appearance-ast` F7, `guard-shell-appearance-ast` I0, `guard-dtcg-hex-ban`).

### Semantic color scan summary

| App | Hex in production source | Palette scale in TSX | Raw white/black | Verdict |
|-----|-------------------------:|---------------------:|----------------:|---------|
| **`apps/web`** | **18** fallback literals in 5 `*.module.css` | **24** expressions in **14** TSX files | **2** (`bg-black/80` in shadcn overlays) | **Fail** |
| **`apps/portal`** | **0** | **0** | **0** | **Pass** |
| Tests (exempt) | 14 assertions in e2e/unit specs | — | — | Expected |

---

### Semantic Color — `apps/web` CSS Module Hex Fallbacks
- **Status:** Fail
- **Severity:** High
- **Description:** Five operator-shell and feature CSS modules embed **hardcoded hex fallbacks** inside `var(--color-*, #…)` chains. When semantic tokens are absent (bootstrap gap, wrong theme arm, or partial tenant override), the UI silently falls back to **platform-default grays and blue** (`#e5e5e5`, `#6b7280`, `#2563eb`, `#fff`, `#111`) instead of failing closed. Phase 2 spec marks literal `#fff` in modules as forbidden.
- **Location:**
  - `apps/web/src/admin/shell/operator-brand.module.css` lines 7, 14–15, 28 (`#e5e5e5`, `#2563eb`, `#fff`, `#6b7280`)
  - `apps/web/src/admin/shell/operator-header.module.css` lines 7–8
  - `apps/web/src/admin/shell/operator-drawer.module.css` line 16 (`#fff`)
  - `apps/web/src/admin/shell/operator-account-menu.module.css` lines 12–14, 26–27, 41–44, 52
  - `apps/web/app/(app)/tours/tours-list-view.module.css` lines 20, 23, 33
- **Fix:** Remove hex fallbacks; require semantic vars only (`var(--color-border-subtle)` with no second argument). If fallbacks are needed for Storybook, gate behind `@supports` or document in generated bootstrap only. Add `guard:app-css-no-hex-fallback` on `apps/web/**/*.module.css`.

---

### Semantic Color — Platform Super-Admin Status Chips (Emerald/Amber)
- **Status:** Fail
- **Severity:** Medium
- **Description:** Platform club/certification UI uses raw Tailwind **`emerald-*` / `amber-*`** for success/pending states instead of `Badge` `variant="success"` / `variant="warning"` (which bind `--color-success*` / `--color-warning*`).
- **Location:**
  - `apps/web/src/platform/workspace-production-certification-badge.tsx` lines 22–23
  - `apps/web/src/platform/workspace-builder/publish-bar.tsx` line 79 (`text-emerald-700`)
  - `apps/web/src/platform/platform-clubs-table.tsx` line 59
  - `apps/web/src/platform/club-detail/platform-club-detail-client.tsx` line 174
  - `apps/web/src/platform/club-detail/tab-sites.tsx` lines 79, 107
- **Fix:** Replace with `<Badge variant="success">` / `variant="warning"` or `text-[var(--color-success)]` / `bg-[var(--color-success-bg)]`. Extend F7 guard scan roots to `apps/web/src/platform/**`.

---

### Semantic Color — Settings / Integrations / Exposure Alert Banners
- **Status:** Fail
- **Severity:** High
- **Description:** Repeated **copy-pasted alert styling** with raw `amber-*` and `emerald-*` Tailwind scales across operator settings surfaces. **11 occurrences** in `integrations-settings-client.tsx` alone. These bypass semantic status tokens, break dark-mode parity (manual `dark:text-amber-100` pairs), and resist tenant primary rebrand.
- **Location:**
  - `apps/web/src/integrations/IntegrationConnectionLoadWarningsBanner.tsx` lines 32, 41
  - `apps/web/src/exposure/DenaliWorkspaceSurfacesPanel.tsx` line 276
  - `apps/web/app/(app)/settings/integrations/integrations-settings-client.tsx` lines 596, 751, 839, 902, 1024, 1097, 1156
  - `apps/web/app/(app)/settings/integrations/integration-event-delivery-policy-panel.tsx` line 521
  - `apps/web/app/(app)/settings/exposure/exposure-settings-client.tsx` line 285
  - `apps/web/app/(app)/settings/exposure/control-plane/exposure-control-plane-client.tsx` line 175
  - `apps/web/app/(app)/settings/branding/branding-settings-client.tsx` line 199 (`amber-200`/`amber-50`)
  - `apps/web/app/(app)/settings/tour-wizard-template/wizard-template-client.tsx` lines 268, 279 (`amber-*`, `green-600`)
  - `apps/web/app/(app)/settings/tour-presets/advanced/presets-advanced-client.tsx` line 121 (`green-600`)
- **Fix:** Introduce shared `StatusBanner` / `Callout` component using `--color-warning`, `--color-warning-bg`, `--color-success`, `--color-success-bg` (mirror `badge.tsx` lines 13–18). Migrate all settings alert `className` strings. Ban palette scales in `apps/web/app/(app)/settings/**` via extended F7 scope.

---

### Semantic Color — shadcn Overlay `bg-black/80`
- **Status:** Warning
- **Severity:** Medium
- **Description:** Dialog and sheet overlays use **`bg-black/80`** instead of a semantic scrim token (e.g. `--color-overlay` / `bg-background/80`). Fixed black scrim ignores workspace dark-primary tuning and high-contrast tenant themes.
- **Location:** `apps/web/src/components/ui/dialog.tsx` line 21; `apps/web/src/components/ui/sheet.tsx` line 20.
- **Fix:** Add `--color-overlay` to DTCG semantics; map in shadcn overlay to `bg-[color-mix(in_srgb,var(--color-overlay)_80%,transparent)]` or Tailwind `bg-overlay/80` after token registration.

---

### Semantic Color — `apps/portal` Production Source (Pass)
- **Status:** Pass
- **Severity:** Low
- **Description:** Zero hex literals, zero Tailwind palette scale classes, and zero raw `white`/`black` color utilities in `apps/portal/app/**` and `apps/portal/src/**`. Portal `globals.css` is import-only (`portal-bootstrap.css` + `tailwindcss`). Shell components use `data-*` hooks; `guard-shell-appearance-ast` (I0) forbids appearance `className` on portal shell TSX. Member profile avatar uses BEM class hooks (`member-profile-avatar__*`) styled by workspace skin CSS in `packages/workspaces/*/theme/`, not inline colors. OTP segment input uses layout utilities + semantic `ring-ring` only.
- **Location:** `apps/portal/app/globals.css` lines 1–2; `apps/portal/src/shell/portal-member-shell.tsx`; `apps/portal/app/me/profile/member-profile-avatar.tsx`; `apps/portal/src/features/auth/otp-segment-input.tsx` lines 217–220.
- **Fix:** None. Preserve portal pattern: no color in app TSX; brand via workspace theme imports.

---

### Semantic Color — Test Fixtures (Exempt)
- **Status:** Pass
- **Severity:** Low
- **Description:** Hex literals in **tests only** assert expected DTCG primary values (`#0f766e`, `#5eead4`, `#2563eb`, `#dc2626`, `#059669`). Not rendered UI; validate token pipeline correctness.
- **Location:** `apps/web/tests/e2e/operator-smoke.spec.ts`; `apps/web/tests/e2e/th-1-tenant-theme-isolation.spec.ts`; `apps/web/test/denali-admin-theme.spec.ts`; `apps/portal/test/guest-theme-stack.spec.ts` line 88.
- **Fix:** None.

---

### Semantic Color — Positive Pattern (`Badge` Semantic Variants)
- **Status:** Pass
- **Severity:** Low
- **Description:** shadcn `Badge` correctly wires success/warning/destructive to **`var(--color-success*)`**, **`var(--color-warning*)`**, **`var(--color-danger*)`** — the target pattern for platform status chips and settings alerts.
- **Location:** `apps/web/src/components/ui/badge.tsx` lines 13–18.
- **Fix:** None. Migrate all `emerald-*` / `amber-*` / `green-*` call sites to this component or equivalent semantic utilities.

---

### Semantic Color — Guard Coverage Gap
- **Status:** Warning
- **Severity:** High
- **Description:** Existing guards **do not cover** the violations found:
  - `guard-admin-feature-appearance-ast` (F7) scans only `apps/web/src/admin/{patterns,dashboard,onboarding}` — **misses** `platform/`, `settings/`, `integrations/`, `exposure/`, and `components/ui/`.
  - `guard-dtcg-hex-ban` covers `packages/design-tokens` and workspace skin hooks — **not** `apps/web/**/*.module.css` hex fallbacks.
  - `guard-shell-appearance-ast` (I0) covers portal shell TSX — does not scan portal `otp-segment-input` (layout-only today; no palette drift).
  - No guard bans `bg-black/80` in shared shadcn primitives.
- **Location:** `scripts/guards/lib/admin-feature-appearance-ast-scan.mjs` lines 35–39 (`ADMIN_FEATURE_SCAN_DIRS`); `scripts/guards/guard-dtcg-hex-ban.mjs` (packages scope only); `scripts/guards/lib/platform-control-steps.mjs` lines 5, 35.
- **Fix:** Extend F7 roots to `apps/web/src/platform`, `apps/web/app/(app)/settings`, `apps/web/src/integrations`, `apps/web/src/exposure`, `apps/web/src/components/ui`. Add `guard:app-css-no-hex` for `apps/web/**/*.module.css`. Register semantic overlay token and ban `bg-black/` in `components/ui/*`. Wire extended pack into `phase-2:gate` / `phase-6:fast-track`.

---

## Supplement — `package.json` Dependency Hygiene + API Sync I/O Audit

**Audit date:** 2026-07-07  
**Scope:** All **26** `package.json` files in the monorepo; production `apps/api/src` sync filesystem usage on HTTP request paths.  
**Method:** `npx depcheck` per workspace (key packages); manual import graph verification for flagged modules; ripgrep `readFileSync` / `readdirSync` / `statSync` / `existsSync` under `apps/api/src`; trace call chains from route handlers.  
**Existing guard:** `scripts/guards/guard-guest-consumer-deps.mjs` (generated-manifest workspace deps only — partial coverage).

### Dependency audit summary

| Category | Count | Severity |
|----------|------:|----------|
| **Undeclared** (used in code, missing from `package.json`) | **2** | High |
| **Unused** (declared, zero production imports) | **12+** dep entries | Medium |
| **Depcheck false positives** (CSS/tooling; keep) | ~15 | Low |
| **`apps/api` duplicate `prebuild` key** | **1** | Critical |
| **Sync fs on API request path** (indirect) | **2** modules | Medium |
| **Sync fs in route files** | **0** | Pass |

---

### Dependency — `apps/api` Duplicate `prebuild` Script Key
- **Status:** Fail
- **Severity:** Critical
- **Description:** `apps/api/package.json` declares **`prebuild` twice** (lines 115 and 119). JSON parsers keep only the **last** value — the long guard chain (`guard:import-boundary`, `guard:tenant-isolation`, … `guard:bulk-import-victim-slo`) is **silently dropped**. Effective `prebuild` is only workspace builds + registry codegen. `pretest`/`prelint` still run guards, but **`pnpm run build` skips the prebuild guard bundle**.
- **Location:** `apps/api/package.json` lines 115–119.
- **Fix:** Merge into a single `prebuild` script (guards then workspace build). Add `guard:package-json-unique-scripts` banning duplicate keys in committed `package.json` files.

---

### Dependency — `guest-club` Missing `next-intl` Declaration
- **Status:** Fail
- **Severity:** High
- **Description:** `registration-flow.steps.tsx` imports `useTranslations` from **`next-intl`**, but `packages/workspaces/guest-club/package.json` lists only `react` / `react-dom` as peers. Urban workspace correctly declares `next-intl` in `peerDependencies`. Standalone install or strict hoisting can break guest-club build/runtime.
- **Location:** `packages/workspaces/guest-club/src/catalog/registration-flow/registration-flow.steps.tsx` line 7; `packages/workspaces/guest-club/package.json` lines 59–61.
- **Fix:** Add `"next-intl": "^4.11.1"` to `peerDependencies` (mirror urban). Extend `guard-guest-consumer-deps` or workspace contract test.

---

### Dependency — `ui-primitives` Missing `@storybook/react`
- **Status:** Fail
- **Severity:** Medium
- **Description:** Storybook files import types from **`@storybook/react`**, but `package.json` only declares `@storybook/react-vite`. Works today via transitive resolution; fragile on fresh `pnpm install` or Storybook 9 split.
- **Location:** `packages/ui-primitives/stories/Atoms.stories.tsx` line 1; `packages/ui-primitives/.storybook/preview.tsx` line 1; `packages/ui-primitives/package.json` lines 81–84.
- **Fix:** Add `@storybook/react` to `devDependencies` aligned with `^8.6.14`.

---

### Dependency — `apps/web` Unused Leaflet Stack
- **Status:** Fail
- **Severity:** Medium
- **Description:** **`leaflet`**, **`react-leaflet`**, and **`@types/leaflet`** are declared in `apps/web/package.json` but **zero imports** under `apps/web/`. Map UI lives in `@app-tour/workspace-denali` (which has its own `leaflet` dependency). Dead weight in admin install graph.
- **Location:** `apps/web/package.json` lines 61–62, 68, 80; no matches under `apps/web/src` or `apps/web/app`.
- **Fix:** Remove the three packages from `apps/web`. Rely on denali workspace for map features.

---

### Dependency — `apps/marketing` Unused Three.js Stack
- **Status:** Fail
- **Severity:** Medium
- **Description:** **`three`**, **`@react-three/fiber`**, **`@react-three/drei`**, and **`@types/three`** are declared but **never imported** in `apps/marketing/src`. Marketing gallery/catalog uses static images and CSS hooks only.
- **Location:** `apps/marketing/package.json` lines 44–45, 54, 63; no `three` / `react-three` imports in `apps/marketing/src`.
- **Fix:** Remove unused 3D dependencies (~large transitive tree).

---

### Dependency — Workspace Theme Packages (Unused `design-tokens` / `theme-react`)
- **Status:** Warning
- **Severity:** Medium
- **Description:** Several workspace packages declare **`@app-tour/design-tokens`** and/or **`@app-tour/theme-react`** in `dependencies` but have **no TypeScript imports**. Theme coupling is via exported `theme/*.css` files (DTCG-generated), not JS imports. Dead dependency entries inflate install graph and confuse ownership.
- **Location:**
  - `packages/workspaces/denali/package.json` lines 572, 575 (no TS imports; CSS under `theme/`)
  - `packages/workspaces/urban/package.json` line 72 (`design-tokens`; also unused `tenant-kernel`, `ui-primitives`)
  - `packages/workspaces/starter/package.json` (`design-tokens`)
  - `packages/workspaces/guest-club/package.json` lines 55–56 (`design-tokens`, `platform-core` — neither imported in `src/`)
- **Fix:** Remove unused JS dependencies; document CSS-only theme contract in package README. Keep `design-tokens` only on **app** consumers (`apps/web`, `apps/portal`, `apps/marketing`) where `globals.css` `@import`s it.

---

### Dependency — `tenant-kernel` Unused `workspace-sdk`
- **Status:** Warning
- **Severity:** Low
- **Description:** `@app-tour/tenant-kernel` lists **`@app-tour/workspace-sdk`** in `dependencies` but **no file under `packages/tenant-kernel/src/` imports it**. Package is host/RLS-only.
- **Location:** `packages/tenant-kernel/package.json` line 21; `packages/tenant-kernel/src/index.ts` (exports host + RLS only).
- **Fix:** Remove `@app-tour/workspace-sdk` from `dependencies` unless a planned re-export is imminent.

---

### Dependency — Depcheck False Positives (Keep)
- **Status:** Pass
- **Severity:** Low
- **Description:** These are **required** despite depcheck "unused" reports:
  - **`@app-tour/design-tokens`**, **`tailwindcss`**, **`postcss`**, **`@tailwindcss/postcss`** in `apps/web`, `apps/portal`, `apps/marketing` — consumed via `globals.css` `@import` and `next.config.ts` `transpilePackages`, not JS `import`.
  - **`@app-tour/config`** in workspace `devDependencies` — shared `tsconfig` / eslint extends.
  - **`happy-dom`** in `apps/web` — pulled via `@happy-dom/global-registrator` in `test/register-dom.mjs`.
- **Location:** `apps/web/app/globals.css` line 1; `apps/portal/app/globals.css` line 1; `apps/web/next.config.ts` line 21.
- **Fix:** None. Extend depcheck config with `ignoreMatches` for CSS-only packages or use `depcheck --ignores` in CI.

---

### Dependency — `apps/api` Production Dependencies (Pass)
- **Status:** Pass
- **Severity:** Low
- **Description:** All **11** `dependencies` in `apps/api/package.json` are imported in production `src/`: `@casl/ability`, `@prisma/client`, `ioredis`, `jose`, `pino`, `rate-limiter-flexible`, `zod`, `archiver` (`stream-tenant-gdpr-export-zip.ts`), workspace packages. **No undeclared npm imports** found in `apps/api/src` (path aliases and relative imports only).
- **Location:** `apps/api/package.json` lines 151–167.
- **Fix:** None. Fix duplicate `prebuild` separately.

---

### Dependency — Guard Coverage Gap
- **Status:** Warning
- **Severity:** Medium
- **Description:** `guard-guest-consumer-deps` only validates **generated manifest** workspace imports — not general undeclared/unused deps. Running it today fails on a **self-reference false positive** (`workspace-plugin-host` generated manifest). No monorepo-wide `depcheck` in `phase-6:fast-track` or `pre-commit:fast`.
- **Location:** `scripts/guards/guard-guest-consumer-deps.mjs` lines 13–51; not wired in root `package.json` scripts.
- **Fix:** Wire `depcheck` per app/package in CI with CSS ignore list; fix plugin-host self-ref false positive; add `pnpm run guard:deps-hygiene`.

---

### API Sync I/O — Migration Consistency on Request Path
- **Status:** Warning
- **Severity:** Medium
- **Description:** Route handlers under `apps/api/src/routes/` contain **zero** direct sync fs calls. However, **`GET /internal/consistency/migrations`** (`handleMigrationConsistency`) calls `runMigrationConsistencyCheck()` when the in-memory cache is empty. That function invokes **`listExpectedMigrationNamesFromDisk()`** — `existsSync`, `readdirSync`, and **`statSync` per migration folder** on the event loop. Usually served from `getLastMigrationConsistencyReport()` after boot (`main.ts` line 105), but cache miss forces sync disk walk.
- **Location:** `apps/api/src/routes/internal/migration-consistency.ts` lines 29–30 → `apps/api/src/health/migration-consistency-check.ts` lines 70–88, 212; boot path `apps/api/src/main.ts` lines 103–106.
- **Fix:** Cache expected migration names at boot (module singleton); route handler reads cache only. Or use `fs.promises.readdir` + async `stat` off the hot path.

---

### API Sync I/O — Validation Worker Pool Path Probe
- **Status:** Warning
- **Severity:** Low
- **Description:** Tour canonical validation (`canonical-validation.ts` → `validation-worker-pool.ts`) calls **`fs.existsSync`** in `resolveWorkerScriptPath()` when spawning worker threads. Runs on **first validation** per process (pool singleton), not per request after warm-up. Low volume but still sync I/O on the request thread before worker offload.
- **Location:** `apps/api/src/canonical/validation-worker-pool.ts` lines 62–77; invoked from tour write routes via `runValidationOffThread`.
- **Fix:** Resolve worker script path once at module init; env var override `VALIDATION_WORKER_SCRIPT`. No `existsSync` in request path after boot.

---

### API Sync I/O — Route Files + GDPR Export (Pass / Note)
- **Status:** Pass
- **Severity:** Low
- **Description:** **No** `readFileSync` / `readdirSync` in `apps/api/src/routes/**`. `POST` tenant GDPR export (`tenants-export-post.ts`) streams via **`archiver`** (async pipe to `ServerResponse`) — no sync file reads on request path. Sync fs in `apps/api` is confined to **tests**, **guard scripts**, and the two production modules above.
- **Location:** `apps/api/src/platform/stream-tenant-gdpr-export-zip.ts`; `apps/api/src/routes/platform/tenants-export-post.ts` line 50.
- **Fix:** None for export path. Add `guard:no-sync-fs-in-routes` banning `*Sync(` imports in `apps/api/src/routes/**` and route-adjacent services called per-request.

---

### API Sync I/O — Related (Workspace Plugin Load, Not API Routes)
- **Status:** Warning
- **Severity:** Medium
- **Description:** `@app-tour/workspace-denali` **`denali-token-bridge.ts`** uses **`readFileSync`** on DTCG JSON at **module evaluation** when the Denali plugin loads in API process. Affects API cold start / first plugin import, not individual route files. Documented in enterprise audit AP 3.
- **Location:** `packages/workspaces/denali/src/theme/denali-token-bridge.ts` line 29.
- **Fix:** Precompile token bridge at build time; lazy async load with cache; fail fast at image build not first request.

---

## Supplement — Untested Components Audit (`apps/api` repositories + services)

**Audit date:** 2026-07-07  
**Window:** Files **created** on or after **2026-05-07** (2 months) per `git log --diff-filter=A`.  
**Scope:** Production `*repository.ts` and `*service.ts` under `apps/api/src` — excludes `in-memory-*`, `create-*` factories, `lazy-*` boot loaders, and interface-only `*.repository.ts` ports.  
**Rule:** A component is **tested** if any `*.spec.ts` or `*.test.ts` under `apps/api` **imports** the module (relative or `../src/...` path) or is **colocated** as `{name}.spec.ts`. Contract-guard specs that only **string-list** file paths in allowlists do **not** count as behavioral coverage.  
**Method:** Git add-date scan of **50** in-window components + ripgrep import graph across `apps/api/{src,test}/**/*.{spec,test}.ts`.

### Untested components summary

| Verdict | Repositories | Services | Total |
|---------|-------------:|---------:|------:|
| **Untested** (no importing/colocated spec) | **10** | **14** | **24** |
| **Tested** (≥1 importing/colocated spec) | **15** | **11** | **26** |
| **In-window production components** | **25** | **25** | **50** |

**Coverage rate:** 26 / 50 (**52%**) have a corresponding spec that imports the module or sits colocated. **48%** are **Untested Components** by this definition.

---

### Untested Components — Identity / Member Session (High)
- **Status:** Fail
- **Severity:** High
- **Description:** Seven identity **service** files added in-window have **zero** dedicated specs. `users.service.ts` has targeted tests (`users-directory-sort`, `users-role-history`, etc.), but member-session surfaces (`me`, `me.mobile`, `me.entitlements`, `otp`, `invites`, `operator-avatar`) and the **`prisma-identity.repository`** backing them are untested at unit/repository level (only a path string in `integrity-audit-3.2.spec.ts`).
- **Location:**
  - `apps/api/src/identity/prisma-identity.repository.ts` (added 2026-06-11)
  - `apps/api/src/identity/me.service.ts` (2026-06-11)
  - `apps/api/src/identity/me.mobile.service.ts` (2026-07-02)
  - `apps/api/src/identity/me.entitlements.service.ts` (2026-07-05)
  - `apps/api/src/identity/otp.service.ts` (2026-06-11)
  - `apps/api/src/identity/invites.service.ts` (2026-06-11)
  - `apps/api/src/identity/operator-avatar.service.ts` (2026-06-25)
- **Fix:** Add `prisma-identity.repository.spec.ts` (RLS + invite/membership queries). Add `me.service.spec.ts`, `otp.service.spec.ts`, `invites.service.spec.ts` with mocked repository. Portal member smoke tests cover portal BFF, not these API services directly.

---

### Untested Components — Workspace Finance + Denali Finance (High)
- **Status:** Fail
- **Severity:** High
- **Description:** All four in-window **finance** repository/service pairs lack importing specs. `test/finance-*.spec.ts` exercises HTTP handlers, schedule store, and outbox processors — **not** `workspace-finance/finance.service.ts`, `workspace-finance/finance.repository.ts`, or `denali-finance/*`.
- **Location:**
  - `apps/api/src/workspace-finance/finance.repository.ts` (2026-06-11)
  - `apps/api/src/workspace-finance/finance.service.ts` (2026-06-11)
  - `apps/api/src/denali-finance/finance.repository.ts` (2026-06-11)
  - `apps/api/src/denali-finance/finance.service.ts` (2026-06-11)
- **Fix:** Add `finance.repository.spec.ts` (RLS, payment list projection, tenant scope). Add `finance.service.spec.ts` for registration→invoice orchestration. Reuse patterns from `test/compile-invoice-balances.spec.ts`.

---

### Untested Components — Bookings Service (Medium)
- **Status:** Fail
- **Severity:** Medium
- **Description:** `prisma-bookings.repository.ts` is well covered (`bookings-perf`, `bookings-list-pagination`, `bookings-safety`, `bookings-pagination-stress`), but **`bookings.service.ts`** has no importing spec — only a file-path string in `test/p6-preservation-gate.spec.ts` inventory.
- **Location:** `apps/api/src/bookings/bookings.service.ts` (added 2026-06-11).
- **Fix:** Add `bookings.service.spec.ts` for duplicate-finder helpers, pagination delegation, and bulk-approve error mapping (mock repository).

---

### Untested Components — Settings Repositories + Explore (Medium)
- **Status:** Fail
- **Severity:** Medium
- **Description:** `settings.service.ts` and `settings-config.service.ts` have specs, but three **Prisma settings repositories** and **`settings-explore.service.ts`** do not. `integrity-audit-3.2.spec.ts` lists paths only.
- **Location:**
  - `apps/api/src/settings/prisma-settings-audit.repository.ts` (2026-06-11)
  - `apps/api/src/settings/prisma-settings-config.repository.ts` (2026-06-11)
  - `apps/api/src/settings/prisma-settings-resources.repository.ts` (2026-06-11)
  - `apps/api/src/settings/settings-explore.service.ts` (2026-06-11)
- **Fix:** Colocated repository specs mirroring `prisma-tour.repository.spec.ts` pattern (memory driver or test DB). `settings-explore.service.spec.ts` for module listing/filtering.

---

### Untested Components — Workspace Drafts (Medium)
- **Status:** Fail
- **Severity:** Medium
- **Description:** `test/workspace-drafts.spec.ts` is an **HTTP integration** suite (hits routes via `createRequestListener`) — it does **not** import `workspace-drafts.service.ts` or the Prisma draft repositories. Repository singletons are reset via `create-*` factories only.
- **Location:**
  - `apps/api/src/workspace-drafts/prisma-workspace-drafts.repository.ts` (2026-06-11)
  - `apps/api/src/workspace-drafts/prisma-workspace-draft-events.repository.ts` (2026-06-11)
  - `apps/api/src/workspace-drafts/workspace-drafts.service.ts` (2026-06-11)
- **Fix:** Add repository specs for envelope tombstone invariants + RLS. Factor service unit tests for patch/list/delete orchestration (complement HTTP suite).

---

### Untested Components — Integrations + Exposure Gaps (Medium)
- **Status:** Fail
- **Severity:** Medium
- **Description:**
  - **`prisma-integration-connection.repository.ts`** — no importing spec (policy/delivery repos have integration coverage).
  - **`integrations.service.ts`** — listed in `field-exposure-phase-6-cutover.contract.spec.ts` allowlist only; `integrations.routes.spec.ts` tests secret store, not the service.
  - **`prisma-exposure-profile.repository.ts`** — no spec (`prisma-exposure-intent.repository.ts` **is** tested via `exposure-intent.repository.spec.ts`).
  - **`workspace-exposure-surfaces.service.ts`** — `resolve-workspace-exposure-surfaces.spec.ts` tests the resolver helper, not the service; contract spec is path-only.
- **Location:**
  - `apps/api/src/integrations/infrastructure/prisma-integration-connection.repository.ts` (2026-06-26)
  - `apps/api/src/integrations/http/integrations.service.ts` (2026-06-26)
  - `apps/api/src/exposure/prisma-exposure-profile.repository.ts` (2026-06-29)
  - `apps/api/src/exposure/workspace-exposure-surfaces.service.ts` (2026-06-29)
- **Fix:** Add `prisma-integration-connection.repository.spec.ts`; extend `integrations.routes.spec.ts` or add `integrations.service.spec.ts` for `listWorkspaceIntegrations` DTO mapping. Add `prisma-exposure-profile.repository.spec.ts` for `ensureSeededProfile`.

---

### Untested Components — Tenant Branding Service (Low)
- **Status:** Fail
- **Severity:** Low
- **Description:** `tenant-branding.service.ts` has no importing spec. `test/tenant-branding.spec.ts` covers **`GET /public/tenant-branding`** end-to-end and imports `tenant-branding-storage`, not the service module.
- **Location:** `apps/api/src/tenant/tenant-branding.service.ts` (added 2026-06-11).
- **Fix:** Add `tenant-branding.service.spec.ts` for theme merge / logo URL resolution with mocked config repository.

---

### Untested Components — Full Inventory (24)

| Added | Kind | File |
|------:|------|------|
| 2026-06-11 | repository | `src/denali-finance/finance.repository.ts` |
| 2026-06-11 | repository | `src/identity/prisma-identity.repository.ts` |
| 2026-06-11 | repository | `src/settings/prisma-settings-audit.repository.ts` |
| 2026-06-11 | repository | `src/settings/prisma-settings-config.repository.ts` |
| 2026-06-11 | repository | `src/settings/prisma-settings-resources.repository.ts` |
| 2026-06-11 | repository | `src/workspace-drafts/prisma-workspace-draft-events.repository.ts` |
| 2026-06-11 | repository | `src/workspace-drafts/prisma-workspace-drafts.repository.ts` |
| 2026-06-11 | repository | `src/workspace-finance/finance.repository.ts` |
| 2026-06-26 | repository | `src/integrations/infrastructure/prisma-integration-connection.repository.ts` |
| 2026-06-29 | repository | `src/exposure/prisma-exposure-profile.repository.ts` |
| 2026-06-11 | service | `src/bookings/bookings.service.ts` |
| 2026-06-11 | service | `src/denali-finance/finance.service.ts` |
| 2026-06-11 | service | `src/identity/invites.service.ts` |
| 2026-06-11 | service | `src/identity/me.service.ts` |
| 2026-07-02 | service | `src/identity/me.mobile.service.ts` |
| 2026-07-05 | service | `src/identity/me.entitlements.service.ts` |
| 2026-06-25 | service | `src/identity/operator-avatar.service.ts` |
| 2026-06-11 | service | `src/identity/otp.service.ts` |
| 2026-06-26 | service | `src/integrations/http/integrations.service.ts` |
| 2026-06-11 | service | `src/settings/settings-explore.service.ts` |
| 2026-06-11 | service | `src/tenant/tenant-branding.service.ts` |
| 2026-06-11 | service | `src/workspace-drafts/workspace-drafts.service.ts` |
| 2026-06-11 | service | `src/workspace-finance/finance.service.ts` |
| 2026-06-29 | service | `src/exposure/workspace-exposure-surfaces.service.ts` |

---

### Untested Components — Positive Patterns (Tested In-Window)
- **Status:** Pass
- **Severity:** Low
- **Description:** Recent components **with** corresponding specs include: `prisma-bookings.repository.ts` (4 perf/safety specs), `canonical-tour.service.ts` (colocated), `migrate-canonical-workspace.service.ts`, `exposure-control-plane.service.ts`, `users.service.ts` (4 specs), platform tenant/domain/subscription repos (6+ specs), `prisma-tour.repository.ts`, `tours.service.ts`, `registration-capacity.service.ts`, `provisioning.service.ts`.
- **Location:** Examples: `apps/api/test/bookings-perf.spec.ts`; `apps/api/src/exposure/exposure-control-plane.service.spec.ts`; `apps/api/test/platform-tenant-repository.spec.ts`.
- **Fix:** None. Use as template for untested identity/finance/settings modules.

---

### Untested Components — Guard Coverage Gap
- **Status:** Warning
- **Severity:** Medium
- **Description:** No CI guard requires a `*.spec.ts` / `*.test.ts` for each new `*repository.ts` or `*service.ts`. `test:changed` runs affected tests but does not fail when a new production file ships without any spec importing it.
- **Location:** `apps/api/package.json` `pretest` guard chain; `scripts/test-changed.sh`.
- **Fix:** Add `scripts/guards/guard-api-component-test-coverage.mjs` — fail on new `*repository.ts`/`*service.ts` in diff without matching `{name}.spec.ts` or grep-proven import in `apps/api/**/*.{spec,test}.ts`. Wire into `pre-commit:fast` or `phase-3:api-gate`.

---

## Supplement — TODO / FIXME / HACK Comment Audit (full project)

**Audit date:** 2026-07-07  
**Pattern:** `// TODO`, `// FIXME`, `// HACK`, and block-comment `* TODO:` / `* FIXME:` / `* HACK:` in `*.{ts,tsx,js,jsx,mjs}` (excluding `node_modules`, `dist`, `.next`).  
**Scope:** Active trunk (`apps/`, `packages/`, `scripts/`, `infra/`, `.github/`) + frozen `legacy/` (reference-only per `AGENTS.md`).  
**Method:** Ripgrep across the repo; manual categorization of each **active-trunk** hit; thematic rollup for **legacy** (36 markers).

### TODO/FIXME/HACK summary

| Scope | `// TODO` | `// FIXME` | `// HACK` | `* TODO:` (block) | Total markers |
|-------|----------:|-----------:|----------:|------------------:|--------------:|
| **Active trunk** (`apps`, `packages`, `scripts`) | **1** | **0** | **0** | **0** | **1** |
| **Legacy** (frozen) | 4 | 0 | 0 | 32 | **36** |
| **Guard/meta only** (`scripts/guards/*`) | — | — | — | — | 4 (not product debt) |

**Active-trunk verdict:** **Pass** — near-zero comment debt; one security-relevant TODO in operator impersonation exit path.

---

### Active Trunk — `operator-shell.tsx` Impersonation Audit Gap
- **Status:** Fail
- **Category:** Security
- **Risk:** High
- **Description:** `handleExitImpersonation` posts logout but does **not** emit platform impersonation **audit END** event. Comment explicitly defers to **P2-B-v1.1**. Platform impersonation without paired END breaks audit trail completeness and compliance queries (who exited impersonation, when).
- **Location:** `apps/web/src/admin/shell/operator-shell.tsx` line 55 (`// TODO P2-B-v1.1 audit END on logout`).
- **Fix:** Call platform impersonation end API (mirror start flow in `start-platform-impersonation`) before `fetch("/api/auth/logout")`. Add E2E asserting audit row pair START/END. Remove TODO when `platform-audit` spec covers exit.

---

### Active Trunk — Zero FIXME / HACK (Pass)
- **Status:** Pass
- **Category:** Architectural
- **Risk:** Low
- **Description:** **Zero** `// FIXME` or `// HACK` comments in `apps/api`, `apps/web`, `apps/portal`, `apps/marketing`, or `packages/**` production TypeScript. No performance hacks or known-broken workarounds flagged in source comments.
- **Location:** Scanned `apps/**` and `packages/**` `*.{ts,tsx,js,jsx,mjs}` (2026-07-07).
- **Fix:** None. Maintain zero FIXME/HACK policy via CI grep gate on `apps/` and `packages/`.

---

### Legacy — Security-Oriented TODOs (Frozen, Reference Only)
- **Status:** Warning
- **Category:** Security
- **Risk:** Medium (if ported verbatim)
- **Description:** **11** block-comment TODOs in `legacy/apps/api/src/common/audit/**` and `legacy/apps/api/src/common/logger/logger.service.ts` describe unimplemented **hash-chain integrity**, **signed exports**, **legal-hold retention**, and **`pino.redact`** paths. Not executed in active trunk but document security features never migrated.
- **Location:**
  - `legacy/apps/api/src/common/audit/audit-integrity-metadata.ts` lines 5–7 (`hash-chain`, `signed exports`, `legal hold`)
  - `legacy/apps/api/src/common/audit/audit-retention-policy.ts` lines 12–13
  - `legacy/apps/api/src/common/audit/audit.service.ts` lines 16–17
  - `legacy/apps/api/src/common/logger/logger.service.ts` line 16
- **Fix:** Do **not** copy legacy TODOs into trunk. When implementing audit hardening in `apps/api`, treat these as requirements in `docs/` only — close with specs + guards, not comment debt.

---

### Legacy — Performance / Reliability TODOs (Frozen)
- **Status:** Warning
- **Category:** Performance
- **Risk:** Medium
- **Description:** **6** TODOs flag **client fallback paths** and **reconciliation jobs** that trade correctness for availability: registration details hook falls back to table projection; pricing snapshot migration notes ledger reconciliation job.
- **Location:**
  - `legacy/apps/web/src/hooks/useRegistrationDetails.ts` lines 45, 53
  - `legacy/apps/web/src/services/registrations.ts` line 12
  - `legacy/apps/api/src/modules/pricing/repositories/create-pricing-snapshot.repository.ts` line 20
  - `legacy/apps/api/src/database/migrations/1777594500000-BookingPriceSnapshots.ts` line 10
  - `legacy/apps/api/src/common/observability/observability-metrics.service.ts` line 9
- **Fix:** Active trunk bookings list pagination and finance outbox tests supersede several legacy patterns — confirm no equivalent fallback remains in `apps/web` / `apps/api` before deleting legacy.

---

### Legacy — Architectural / Domain TODOs (Frozen)
- **Status:** Warning
- **Category:** Architectural
- **Risk:** Low
- **Description:** **19** block-comment TODOs in legacy finance pricing, reconciliation, booking state machine, and shared-contracts describe **future product features** (coupons, surge pricing, campaign engine, settlement files, partial refunds) — roadmap notes, not active bugs.
- **Location:** `legacy/apps/api/src/modules/finance/pricing/**`; `legacy/apps/api/src/modules/finance/reconciliation/**`; `legacy/apps/api/src/modules/registrations/domain/**`; `legacy/packages/shared-contracts/src/auth/index.ts` line 3.
- **Fix:** None in legacy. For active trunk finance work, track in phase docs / MAP — not inline TODOs.

---

### Legacy — DTO Validation TODOs (Frozen)
- **Status:** Warning
- **Category:** Security
- **Risk:** Low
- **Description:** Two inline `// TODO` comments note `ValidationPipe` `forbidNonWhitelisted` rejecting unknown registration DTO fields — API strictness documentation, not an open vulnerability in active trunk.
- **Location:** `legacy/apps/api/src/modules/registrations/dto/create-registration.dto.ts` line 43; `create-waitlist-item.dto.ts` line 19.
- **Fix:** None (legacy frozen). Active `apps/api` uses Zod/http validation — verify parity if guest registration DTOs are reintroduced.

---

### TODO/FIXME/HACK — Guard Coverage Gap
- **Status:** Warning
- **Category:** Architectural
- **Risk:** Medium
- **Description:** Existing enforcement is **partial**:
  - `guard-no-todo-guest.mjs` — bans TODO/FIXME only in `workspace-sdk` catalog/profile, `guest-surface-host`, `workspace-plugin-host` generated paths.
  - `anti-hollow-phase8.mjs` — bans TODO/FIXME in `docs/phase-8/**` markdown/yaml only.
  - **No guard** on `apps/web`, `apps/api`, `apps/portal`, or `packages/workspaces/**` — the operator-shell TODO shipped unchecked.
- **Location:** `scripts/guards/guard-no-todo-guest.mjs` lines 12–17; `scripts/guards/lib/anti-hollow-phase8.mjs` lines 19–20.
- **Fix:** Add `guard-no-todo-product.mjs` failing on `\b(TODO|FIXME|HACK)\b` in `apps/{api,web,portal,marketing}/src/**` and `packages/**/src/**` (allowlist `scripts/guards/**`). Wire into `phase-6:fast-track` or `pre-commit:fast`.

---

### TODO/FIXME/HACK — Risk Matrix (Active Trunk Only)

| # | File | Marker | Category | Risk |
|---|------|--------|----------|------|
| 1 | `apps/web/src/admin/shell/operator-shell.tsx:55` | `// TODO P2-B-v1.1 audit END on logout` | Security | **High** |

**Legacy rollup (36 markers — do not action in trunk):**

| Category | Count | Max risk |
|----------|------:|----------|
| Security (audit, logger, DTO strictness) | 15 | Medium |
| Performance (fallbacks, reconciliation, metrics) | 6 | Medium |
| Architectural (finance/registrations roadmap) | 15 | Low |

