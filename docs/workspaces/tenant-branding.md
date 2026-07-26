# Tenant workspace branding (logo)

```yaml
doc_id: TENANT-WORKSPACE-BRANDING
version: "2026-06-10-v4"
status: production-closed
layer: tenant (Level 2)
workspace_plugin: fallback mark only (Level 3)
```

## Scope

Organization-scoped branding for multi-tenant operators: **logo** and optional **display name** stored on `tenants.theme` JSON, assets in MinIO under `{tenantId}/branding/logo`.

| Concern | Owner |
|---------|--------|
| Upload contract + object key | `@app-tour/workspace-sdk` (`tenant-brand-logo.ts`) |
| MinIO put/get + theme persistence | `apps/api/src/tenant/tenant-branding.*` |
| Settings UI | `apps/web` — module `workspace_branding` |
| Consumption | `TenantBrandMark` — admin nav, wizard bridge, login |

Workspace plugins (Denali `DenaliLogoMark`, starter initial) remain **fallback** when tenant logo is unset.

## Data model

```typescript
// TenantThemeConfig (workspace-sdk)
{
  primaryColor?: string;
  cssVariables?: Record<string, string>;
  displayName?: string;
  logo?: { storageKey: string; contentType?: string };
}
```

- `storageKey` must equal `buildTenantBrandLogoObjectKey(tenantId)` after upload.
- Logo is **not** injected via `cssVariables` — rendered as `<img src={signedUrl}>`.
- `validateTenantTheme` seals raster metadata; `buildTenantThemeStyle` ignores logo fields.

## API

| Method | Path | Auth |
|--------|------|------|
| GET | `/settings/branding` | operator session |
| PATCH | `/settings/branding` | owner/admin |
| POST | `/settings/branding/logo` | owner/admin · binary body |
| DELETE | `/settings/branding/logo` | owner/admin |
| GET | `/settings/branding/logo/url` | operator session · signed read |
| GET | `/public/tenant-branding` | host subdomain only · no session |

Public response: `{ displayName?, primaryColor?, logoUrl? }` — short-lived signed URL (300s).

## Settings module

```text
id: workspace_branding
kind: readonly_explorer (custom UI — no explore API)
route: settings/branding
ability: operator.settings.workspace_branding
nav.group: workspace
```

Registered in Denali + starter manifests. Registry row: [SETTINGS-MODULE-REGISTRY §7](../phase-9/appendices/SETTINGS-MODULE-REGISTRY.md). Member read: [CASL-OPERATOR-SPEC SDK-9.6-04](../phase-9/appendices/CASL-OPERATOR-SPEC.md).

**CASL surface:** `operator.settings.workspace_branding.read` (member allow) · mutate via `isAdminOrOwner` on API (manifest `ability` label is `operator.settings.workspace_branding`).

**OpenAPI:** `/settings/branding*` + `/public/tenant-branding` registered in `DISPATCH_ROUTES` (DEC-099); run `pnpm --filter @apps/api run openapi:generate` after route changes.

## Security

- Content-Type whitelist: JPEG, PNG, WebP (same as tour photos).
- Magic-byte sniff: `assertTenantBrandLogoBytesMatchContentType` rejects header/body mismatch (`TENANT_BRAND_LOGO_BYTES_*`).
- Max size: 2 MiB.
- Object key tenant-scoped; cross-tenant key rejected on read.
- No SVG (XSS surface).
- Cache invalidation: `invalidateTenantRegistryCache` on theme update.
- **Module gate (BR-10):** `assertWorkspaceBrandingModuleAccess` — resolves `workspace_branding` from tenant manifest; **urban** (module absent) → `404 SETTINGS_MODULE_UNKNOWN`; unknown module → `404`.

## UI cascade

```text
tenant logo (signed URL)
  → workspace custom mark (codegen component registry — H.e.b; none registered on trunk)
  → first letter of workspace label
```

Shared fallback: `TenantBrandFallbackMark` — used by `TenantBrandMark` and login `LoginTenantBrand`.

### Wave H.e.a (admin shell)

| Rule | Detail |
| ---- | ------ |
| No static Denali mark | `denali-logo-mark.tsx` deleted; shell must not import `@app-tour/workspace-denali/.../denali-logo-mark` |
| No `"denali"` switch | `TenantBrandFallbackMark` must not branch on literal `"denali"` |
| Manifest map | `resolveWizardCustomBrandFallbackMark` (codegen from `wizardCreate.customBrandFallbackMark`; empty on trunk; map private Phase 4e) |
| Future custom marks | H.e.b — generate a **component** binding map from manifest (lazy import), not a string kind switch in shell |

ADR: [`docs/dev/wave-h-brand-fallback-neutral.mdoc`](../dev/wave-h-brand-fallback-neutral.mdoc).

## Web production closure (2026-06-10)

| Concern | Implementation |
|---------|----------------|
| RBAC in settings UI | `canManage` via `isAdminOrOwnerRole` — member read-only |
| Live chrome refresh | `TenantBrandingProvider` refetches logo + displayName on `invalidateBranding(patch?)`; nav reads context (not stale SSR prop only) |
| Client upload validation | `validateTenantBrandLogoFile` before POST |
| Login fallback | `pluginId` from host bootstrap — not hardcoded Denali |
| Module access gate | `assertWorkspaceBrandingModuleAccess` (read/mutate) |
| Urban API (no module in manifest) | `404 SETTINGS_MODULE_UNKNOWN` on `/settings/branding*` |
| Member CASL read | `workspace_branding` in `MEMBER_READABLE_SETTINGS_MODULE_IDS` |
| Cross-shell logo cache | `tenant-branding-logo-cache.ts` — one in-flight fetch; **no** `?v=` on presigned MinIO URLs (breaks signature) |
| API bytes sniff | `tenant-brand-logo-bytes.ts` in workspace-sdk |

## API test matrix

| Test ID | Scenario | Expected |
|---------|----------|----------|
| API-TB-01 | GET branding unauthenticated | 401 |
| API-TB-02 | GET branding member | 200 |
| API-TB-03 | PATCH branding member | 403 |
| API-TB-04 | POST logo without Content-Type | 400 |
| API-TB-05 | POST logo invalid content-type | 400 |
| API-TB-05a | POST valid PNG without MinIO | 503 `MINIO_NOT_CONFIGURED` |
| API-TB-05b | POST valid PNG with MinIO | 201 + `logo/url` 200 |
| API-TB-06 | GET `logo/url` without logo | 404 |
| API-TB-07 | DELETE logo owner | 200, theme cleared |
| API-TB-08 | GET `/public/tenant-branding` | 200 |
| API-TB-09 | PATCH displayName owner | 200 |
| API-TB-10 | urban GET branding | 403 |
| API-TB-11 | POST logo member | 403 |
| API-TB-12 | bytes/content-type mismatch | 400 |
| API-TB-13 | urban PATCH branding | 403 |

MinIO storage round-trip: `apps/api/test/tenant-branding-minio.spec.ts` (skipped when `MINIO_*` unset).

## Verification (targeted)

```bash
# SDK
cd packages/workspace-sdk && NODE_ENV=test node --import tsx --test \
  test/tenant-brand-logo.spec.ts test/tenant-brand-logo-bytes.spec.ts test/operator-ability.spec.ts

# API (memory driver; rebuild workspace-sdk + workspace-denali if manifest exports stale)
cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test --test-force-exit \
  test/tenant-branding.spec.ts test/tenant-branding-minio.spec.ts \
  test/settings-modules.spec.ts test/settings-urban-regression.spec.ts

# OpenAPI parity
cd apps/api && node scripts/guard-openapi-dispatch-parity.mjs

# Web
cd apps/web && NODE_ENV=test node --import tsx --import ./test/register-dom.mjs --test \
  test/settings-branding-rbac.spec.ts test/login-tenant-brand.spec.ts test/tenant-branding-contract.spec.ts

# Doc pack
pnpm run phase-9:guard
```

## Production closure (2026-06-10)

Phases 1–7 are implemented and covered by automated specs above. Phase 8 manual QA remains the only human sign-off step before merge.

| Gate | Status |
|------|--------|
| RBAC + settings UI parity | closed — `settings-branding-rbac.spec.ts` |
| Live chrome + logo cache | closed — `TenantBrandingProvider` + `tenant-branding-logo-cache.ts` |
| API workspace guard + module access | closed — `tenant-branding.spec.ts` API-TB-10/13 |
| API + MinIO storage tests | closed — `tenant-branding-minio.spec.ts` (skip without env) |
| Login plugin fallback | closed — `login-tenant-brand.spec.ts` |
| CASL + registry + OpenAPI | closed — `phase-9:guard` + `guard-openapi-dispatch-parity` |
| Manual QA on `denali.localhost` | pending Architect run |

## Marketing chrome (guest surfaces)

- Public branding via `GET /public/tenant-branding` — logo + `displayName` only (no workspace jargon).
- **Display name:** Admin must click **Save** on `/settings/branding` after editing the name — logo upload alone does not persist `displayName`.
- **Header vs nav:** `data-marketing-brand-title` uses `displayName` (fallback `nav.defaultSiteName`, not `nav.tours`). The nav link «تورها» / «Tours» is the catalog route label — it stays fixed even when the club name is customized.
- **Marketing refresh:** Production caches branding ~60s (`GUEST_BRANDING_REVALIDATE_SECONDS`). Development uses `cache: no-store` — hard refresh marketing after admin save.
- **Logo URL:** Presigned MinIO URLs use `MINIO_ENDPOINT` — the browser must reach that host (e.g. `127.0.0.1:9002` locally). If marketing loads but the logo is broken, check MinIO is running and the presigned URL returns 200 in Network tab.
- **BFF host forwarding:** Next.js server fetch to `127.0.0.1:3001` cannot override the HTTP `Host` header; web BFF and SSR login branding send `x-forwarded-host: {label}.localhost`. API `readIngressHost` prefers that header for subdomain resolution.
- Login shows **organization name** when set in settings; no generic «workspace شما» fallback.
- Card title is «ورود» / «Sign in» — not «operator» or multi-tenant copy.
- Showing `displayName` on login is intentional branding (same as Slack/Notion); security gate remains OTP + authorized membership.

## Manual QA

1. denali admin → `/settings/branding` → upload PNG → sidebar + wizard reflect without F5
2. remove logo → plugin fallback mark
3. save displayName → nav title updates
4. member → read-only UI (no upload/save)
5. logout → login shows tenant logo + displayName
6. urban tenant → branding module hidden + API `404 SETTINGS_MODULE_UNKNOWN`
7. oversized / wrong file type → localized client error before POST
