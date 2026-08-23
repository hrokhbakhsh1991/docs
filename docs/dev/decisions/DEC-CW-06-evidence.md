# DEC-CW-06 — Currency / locale display config shape (evidence packet)

**Ledger task:** CW2-01  
**Decision id:** DEC-CW-06  
**Status:** Evidence complete — **PROPOSAL for Architect** (no product semantics selected)  
**Date:** 2026-08-23  
**Baseline commit:** `7d3daac6` (`main`)  
**Constraint:** No behavior changes in this packet. Do not treat IRR/toman as platform defaults.

---

## Executive summary

Audit cited `pluginId === "denali"` in marketing and operator tour-list formatters. **At baseline, those branches are already removed.** Display policy is interim-bound through workspace-owned **`irrDisplayUnit: "toman"`** objects loaded per **`pluginId`** (not tenant). Configuration still lives in **TypeScript plugin surfaces**, not manifest JSON or tenant runtime — CW2-02/CW2-03 closure requires formalizing the seam.

**Pricing ISO currency** (`commerce.currency`, tour `priceCurrency`, finance `amountMinor` + `currency`) and **display unit/label** (toman vs `Intl` riyal) are **distinct concerns** today and must stay separable in the contract.

**Recommendation (PROPOSAL):** **Option C** — workspace manifest default + optional tenant override for **presentation-only** fields, mirroring existing `commerce` resolution, with `commercePresentation` (or codegen-bound `tourCommercial` manifest block) **not** folded into frozen payment `commerce` or platform-core.

---

## Question

How should currency/locale presentation currently hard-coded through Denali identity be configured?

Compare:

| Option | Summary |
|--------|---------|
| **A** | Workspace manifest configuration (+ codegen → generated bindings) |
| **B** | Tenant / runtime configuration (API, metadata binding, bootstrap) |
| **C** | Workspace default + tenant override (merge semantics) |

---

## Current runtime architecture (inspected)

### 1. Interim display policy (post–partial CW2-02/03)

| Surface | Formatter | Policy input | Loader |
|---------|-----------|--------------|--------|
| Operator web tour list / edit header | `apps/web/src/features/tours/tour-list-formatters.ts` → `formatTourPrice` | `commercialPolicy?.irrDisplayUnit` | `readCachedTourCommercialCapability(pluginId)` → `plugin.capabilities.tourCommercial` |
| Marketing catalog / home cards | `apps/marketing/src/catalog/format-catalog-display.ts` → `formatCatalogPrice` | `priceDisplayPolicy?.irrDisplayUnit` | `resolveMarketingCatalogSurface(pluginId)` (generated lazy import) |
| Denali wizard review (workspace UI) | `packages/workspaces/denali/src/ui/adapters/i18n-format.ts` | Always toman label in workspace package | Not host-configured |
| Finance panels (operator) | `apps/web/src/finance/finance-prepayments-logic.ts` → `formatMinorAmount` | Invoice/payment `currency` ISO only | No toman branch |
| Portal member receipt | `apps/portal/app/me/registrations/[id]/member-receipt-upload-form.tsx` | Hardcoded `IRR` → `ریال` | No workspace policy |

**Invariant preserved:** when `irrDisplayUnit === "toman"` and stored currency is `IRR`, formatters use grouped digits + تومان/toman label with **no ×10**.

```13:39:apps/web/src/features/tours/tour-list-formatters.ts
export function formatTourPrice(
  amount: number | null,
  currency: string | null,
  locale: AppLocale = "en",
  commercialPolicy?: Pick<WorkspaceTourCommercialCapability, "irrDisplayUnit"> | null
): string | null {
  // ...
  if (code === "IRR" && commercialPolicy?.irrDisplayUnit === "toman") {
    const unit = locale === "fa" ? "تومان" : "toman";
    return `${formatLocalizedNumber(amount, locale)} ${unit}`;
  }
  // ...
}
```

```66:104:apps/marketing/src/catalog/format-catalog-display.ts
export function catalogIrrUsesTomanLabel(
  priceDisplayPolicy: CatalogPriceDisplayPolicy | null | undefined
): boolean {
  return priceDisplayPolicy?.irrDisplayUnit === "toman";
}
// ...
  if (code === "IRR" && catalogIrrUsesTomanLabel(priceDisplayPolicy)) {
    const unit = isFa ? "تومان" : "toman";
    return `${formatLocalizedNumber(amount, isFa ? "fa" : "en", { maximumFractionDigits: 0 })} ${unit}`;
  }
```

**No `pluginId === "denali"`** remains in these formatter files (verified grep at baseline).

### 2. Where `irrDisplayUnit` is defined today (not manifest)

| Path | Symbol | Value |
|------|--------|-------|
| `packages/workspaces/denali/src/denali.plugin.ts` | `capabilities.tourCommercial` | `irrDisplayUnit: "toman"` |
| `packages/workspaces/denali/src/marketing/marketing-catalog-surface.ts` | `denaliMarketingCatalogSurface` | `irrDisplayUnit: "toman"` |
| `packages/workspace-sdk/src/plugin/workspace-plugin-capabilities.ts` | `WorkspaceTourCommercialCapability` | `irrDisplayUnit?: "toman"` (type only) |
| `packages/guest-workspace-runtime/src/marketing-catalog-surface-types.ts` | `MarketingCatalogSurface` | `irrDisplayUnit?: "toman"` (type only) |

Manifest `workspace.manifest.json` for Denali has **`marketingCatalog`** module binding but **no `irrDisplayUnit` field** in JSON. `commerce` block has ISO `currency: "IRR"` only.

### 3. Commerce / pricing currency (separate from display)

| Layer | Contract | Denali today |
|-------|----------|--------------|
| Manifest | `commerce.paymentMode`, `gatewayProvider`, `currency`, optional `frozen` | `offline_receipt`, `currency: "IRR"`, `frozen: true` |
| Zod schema | `packages/workspace-sdk/src/metadata/commerce-schema.ts` → `workspaceCommerceConfigSchema` | `currency` string; **no display unit** |
| Codegen freeze | `packages/workspace-sdk/src/metadata/workspace-commerce-freeze.generated.ts` | Denali frozen map → `{ paymentMode, gatewayProvider, currency: "IRR" }` |
| Tour canonical | `priceAmount` (number), `priceCurrency` (ISO string) | Stored as operator-entered integers + `IRR` |
| Finance | `amountMinor` (digit string), `currency` (ISO) | From invoice/payment rows |

Tenant resolution (`apps/api/src/workspace-metadata/resolve-workspace-commerce-for-tenant.ts`):

1. If `resolveFrozenWorkspaceCommerce(workspaceType)` → **return frozen** (Denali always).
2. Else if workspace metadata enabled + binding → merge `commerce` from published definition payload.
3. Else → `DEFAULT_WORKSPACE_COMMERCE_CONFIG` (`currency: ""`).

**Frozen commerce blocks tenant payment-mode/currency override for Denali** (test: `workspace-metadata-commerce-inherit.spec.ts`).

### 4. Locale sources (not currency display)

| Surface | Locale source | Workspace manifest touchpoints |
|---------|---------------|-------------------------------|
| Operator `apps/web` | `next-intl`; `routing.defaultLocale: "fa"`; `useLocale()` / `useLocale()` client; cookie-less URL prefix | No per-workspace locale in operator routing |
| Marketing `apps/marketing` | Cookie → tenant branding `defaultLocale` → app default (`resolve-app-locale.ts`) | `guestLanding.i18nProfile` (`full`/`minimal`), `shellChrome.localeSwitcher` |
| Tenant branding API | `/public/tenant-branding` → `defaultLocale` | `tenantBrandingDefaults` in codegen `workspace-manifest-bindings.generated.ts` (Urban `en`; Denali no defaultLocale) |
| Public bootstrap | `/public/tenant-context` → `tenantId`, `pluginId`, `workspaceType`, `siteSurfaces` only | **No locale or display config** |

```287:311:apps/api/src/tenant/tenant-branding.service.ts
export async function resolvePublicTenantContextBySubdomain(subdomain: string): Promise<{
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly pluginId: string;
  readonly siteSurfaces: TenantSiteSurfaces;
}> {
  // ...
  return {
    tenantId: tenant.id,
    workspaceType: tenant.workspaceType,
    pluginId,
    siteSurfaces,
  };
}
```

### 5. Minor-unit semantics

| Context | Field | Semantics | Display |
|---------|-------|-----------|---------|
| Tour list / catalog | `priceAmount` | Integer as entered in wizard (Denali: toman-scale digits) | `formatTourPrice` / `formatCatalogPrice` |
| Finance | `amountMinor` | String of minor-unit digits (no decimal) | `formatMinorAmount` → grouped digits + ISO currency code |
| Denali review UI | canonical string values | ASCII integer strings | `formatTomanGroupedLabel` in workspace package |

**No platform rule converts IRR minor ↔ toman display digits** (explicit comments: do not ×10). Product stores **ISO `IRR`** while some surfaces **label** those digits as toman.

### 6. One workspace, multiple customer identities

| Question | Evidence |
|----------|----------|
| One workspace type, many tenants? | **Yes.** `workspaceType` → single `pluginId` via registry; many `tenantId` rows share plugin (e.g. Denali `devBootstrap.pluginTenantIds` lists two UUIDs). |
| Currency ISO varies per tenant on same workspace? | **Only if not frozen** and workspace metadata overrides `commerce.currency` (Starter tests). **Denali frozen → all tenants `IRR`.** |
| Display unit varies per tenant today? | **No.** `irrDisplayUnit` is on plugin object keyed by `pluginId`; operator cache is `Map<pluginId, WorkspacePlugin>`. |
| Change display without rebuild/codegen? | **No** for current TS-defined surfaces. Tenant metadata path could allow runtime for non-frozen workspaces if presentation fields added to binding payload. |

### 7. SSR / client / cache

| Surface | Server | Client | Cache key |
|---------|--------|--------|-----------|
| Operator tour list price | Plugin warmed in layout (`warm-operator-wizard-shell.ts` → `writeCachedTourPlugin`) | `TourCard` client calls `readCachedTourCommercialCapability(pluginId)` | **pluginId** (in-memory module cache) |
| Marketing catalog price | RSC: `await resolveMarketingCatalogSurface(pluginId)` per request | Price strings rendered on server | **pluginId**; dynamic `import()` of workspace module |
| Marketing bootstrap | `resolveMarketingBootstrapForHost` → tenantId + pluginId | — | Host → tenant API revalidate |
| Finance amounts | Mixed SSR/client | `useLocale()` for digit shaping | Per invoice `currency` |

Changing tenant-only display would require either tenant-keyed cache or bootstrap payload extension.

### 8. Generated-registry implications

| Generated artifact | Role for currency/display |
|--------------------|---------------------------|
| `workspace-commerce-freeze.generated.ts` | Frozen payment `commerce` per workspaceType |
| `workspace-marketing-catalog-bindings.generated.ts` | `switch(pluginId)` lazy load `marketingCatalog` export |
| `workspace-manifest-bindings.generated.ts` | `tenantBrandingDefaults` (locale/colors), not display unit |
| `workspace-guest-landing.generated.ts` | `i18nProfile`, `localeSwitcher` |
| Future (proposed) | Codegen from manifest `commercePresentation` or `tourCommercial` block → SDK types + plugin warm defaults |

Pattern precedent: `catalogPresentation` → `workspace-catalog-list-features.generated.ts` (manifest → codegen → host resolver).

---

## DEC-CW-06 OPTIONS (detailed)

### Option A — Workspace manifest configuration

**Shape:** Declare presentation in `workspace.manifest.json`; codegen emits types, generated bindings, and/or seeds `capabilities.tourCommercial` / `marketingCatalogSurface` defaults.

Example (illustrative — not implemented):

```json
{
  "commercePresentation": {
    "irrDisplayUnit": "toman"
  }
}
```

Or extend existing blocks:

```json
{
  "marketingCatalog": { "module": "./marketing/marketing-catalog-surface", "export": "denaliMarketingCatalogSurface", "irrDisplayUnit": "toman" },
  "tourCommercial": { "irrDisplayUnit": "toman" }
}
```

| Pros | Cons |
|------|------|
| Aligns with `catalogPresentation`, `guestLanding`, `commerce` manifest patterns | Package publish + registry regen to change defaults |
| Guards can enforce manifest ↔ codegen parity | All tenants on workspaceType share manifest default |
| Keeps apps thin; no workspace id in formatters | Denali TS surfaces still duplicate until CW2-02/03 formalize |
| Versioned with workspace package | Does not alone enable ops runtime edit |

### Option B — Tenant / runtime configuration

**Shape:** Extend tenant workspace metadata payload, `/public/tenant-context`, or bootstrap with `commercePresentation`; surfaces read tenant-resolved display policy at request time.

| Pros | Cons |
|------|------|
| Per-tenant display without code deploy (when metadata enabled) | New API/bootstrap fields; SSR cache must key on tenant |
| Ops can trial labels/currency presentation per club | Denali `commerce.frozen` today blocks commerce merge — need **presentation-only** channel |
| Matches branding `defaultLocale` tenant override model | Risk conflating payment currency with display if dumped into `commerce` |
| | Marketing/operator need consistent BFF or shared resolver |

### Option C — Workspace default + tenant override

**Shape:** Manifest declares workspace-default `commercePresentation`; `resolveWorkspaceCommercePresentationForTenant` mirrors `resolveWorkspaceCommerceConfigForTenant`:

1. Frozen workspace → workspace manifest default only (presentation locked with workspace product).
2. Metadata binding → merge tenant published definition `commercePresentation` over default.
3. Fallback → workspace default from codegen.

| Pros | Cons |
|------|------|
| Reuses proven merge pattern (`resolve-workspace-commerce-for-tenant.ts`) | Two sources of truth unless codegen default === manifest |
| Starter/non-frozen tenants can override; Denali can stay workspace-locked | Must explicitly separate **presentation** from **payment commerce** |
| Single resolver for API + future bootstrap extension | Frozen semantics need Architect sign-off for display-only exceptions |
| Enables B without losing A | More schema/guard surface |

---

## Tradeoffs table

| Criterion | A Manifest | B Tenant/runtime | C Default + override |
|-----------|------------|------------------|----------------------|
| Matches existing codegen seams | **High** | Low | **High** |
| Per-tenant display variance | No | **Yes** | **Yes** (non-frozen / if allowed) |
| Denali frozen compatibility | **High** (workspace-locked) | Needs carve-out | **High** (lock presentation at workspace) |
| No platform IRR/toman default | **High** (workspace-scoped) | **High** | **High** |
| Runtime change without deploy | No | **Yes** | Partial |
| SSR complexity | Low | **Higher** | Medium |
| CW2-02/03 implementation fit | **Strong** | Medium | **Strong** |
| Risk of conflating storage currency vs label | Low if separate block | **Higher** | Low if separate block |

---

## Recommended option (PROPOSAL for Architect)

**Adopt Option C** with a **presentation-only contract** separate from `workspaceCommerceConfig`:

1. **Workspace default** from manifest + codegen (Option A mechanics).
2. **Tenant override** via workspace metadata published definition when workspace metadata enabled and workspace not frozen for *presentation* (or explicit Architect rule for frozen display-only lock).
3. **Do not** add `irrDisplayUnit` to `workspaceCommerceConfigSchema` or platform-core.
4. **Do not** default `irrDisplayUnit: "toman"` at SDK/platform level — only workspace packages/manifests.

Rationale: codebase already split **payment commerce** (tenant-resolvable, Denali frozen) from **display policy** (`tourCommercial` / marketing surface). Option C extends the existing merge architecture without forcing display into payment fields or platform defaults.

---

## Exact contract shape proposal

### Type (SDK — workspace-scoped, not platform default)

```typescript
/** Workspace-owned catalog/operator price **label** policy. Storage currency stays ISO on tour/finance rows. */
export type WorkspaceCommercePresentation = {
  /**
   * When tour/catalog `priceCurrency` is IRR, label grouped digits as toman/تومان without ×10.
   * Absent → Intl currency style (e.g. Harbor IRR → riyal).
   */
  readonly irrDisplayUnit?: "toman";
};
```

### Manifest (workspace.manifest.json)

```json
{
  "commercePresentation": {
    "irrDisplayUnit": "toman"
  }
}
```

Validation rules (proposed):

- `irrDisplayUnit` enum: only `"toman"` at CW-2 (future values require new DEC).
- Optional block; absent ⇒ Intl path.
- Independent of `commerce.currency` (ISO storage).

### Codegen outputs (CW2-02 / CW2-03)

| Emitter | Target |
|---------|--------|
| `workspace-registry` domain (new or `wizard-admin.mjs`) | `WORKSPACE_COMMERCE_PRESENTATION_BY_PLUGIN_ID` frozen map |
| Plugin warm / marketing catalog bindings | Seed `irrDisplayUnit` from manifest instead of hand TS |
| Optional metadata strip | Include `commercePresentation` in `stripWorkspacePluginToDefinitionPayload` for tenant override |

### Tenant override payload (metadata definition)

```json
{
  "commercePresentation": {
    "irrDisplayUnit": "toman"
  }
}
```

Resolver sketch (API):

```typescript
async function resolveCommercePresentationForTenant(input: {
  workspaceType: string;
  tenantId?: string;
  metadataBinding?: TenantWorkspaceMetadataBinding | null;
}): Promise<WorkspaceCommercePresentation> {
  const workspaceDefault = resolveWorkspaceCommercePresentationFromManifest(input.workspaceType);
  if (isWorkspaceCommercePresentationFrozen(input.workspaceType)) {
    return workspaceDefault; // Denali: workspace-locked
  }
  // ... merge from published metadata payload when enabled (mirror commerce resolver)
  return workspaceDefault;
}
```

### Surface consumption (no new host branches)

| Consumer | Change when approved |
|----------|----------------------|
| `formatTourPrice` | Already accepts `commercialPolicy`; bind from resolved presentation |
| `formatCatalogPrice` | Already accepts `priceDisplayPolicy`; bind from marketing surface seeded from manifest |
| Bootstrap (optional phase) | Add `commercePresentation` to guest bootstrap only if tenant override required on marketing SSR without plugin warm |

---

## Evidence paths / symbols (grep index)

| Topic | Paths / symbols |
|-------|-----------------|
| Operator price formatter | `apps/web/src/features/tours/tour-list-formatters.ts` — `formatTourPrice` |
| Marketing price formatter | `apps/marketing/src/catalog/format-catalog-display.ts` — `formatCatalogPrice`, `catalogIrrUsesTomanLabel` |
| Plugin commercial capability | `packages/workspaces/denali/src/denali.plugin.ts` — `tourCommercial.irrDisplayUnit` |
| Marketing catalog surface | `packages/workspaces/denali/src/marketing/marketing-catalog-surface.ts` — `denaliMarketingCatalogSurface` |
| SDK types | `packages/workspace-sdk/src/plugin/workspace-plugin-capabilities.ts` — `WorkspaceTourCommercialCapability`, `resolveTourCommercialCapability` |
| Operator cache | `apps/web/src/features/tours/tour-route-cache.ts` — `readCachedTourCommercialCapability` |
| Generated marketing loader | `packages/guest-workspace-runtime/src/workspace-marketing-catalog-bindings.generated.ts` — `resolveMarketingCatalogSurface` |
| Commerce schema | `packages/workspace-sdk/src/metadata/commerce-schema.ts` — `workspaceCommerceConfigSchema` |
| Commerce freeze | `packages/workspace-sdk/src/metadata/workspace-commerce-freeze.generated.ts` — `resolveFrozenWorkspaceCommerce` |
| Tenant commerce resolver | `apps/api/src/workspace-metadata/resolve-workspace-commerce-for-tenant.ts` |
| Denali manifest commerce | `packages/workspaces/denali/workspace.manifest.json` — `commerce`, `marketingCatalog` |
| Finance minor formatting | `apps/web/src/finance/finance-prepayments-logic.ts` — `formatMinorAmount` |
| Denali review toman | `packages/workspaces/denali/src/ui/adapters/i18n-format.ts` — `formatTomanGroupedLabel` |
| Portal receipt display | `apps/portal/app/me/registrations/[id]/member-receipt-upload-form.tsx` — `formatMinorAmount` (IRR → ریال) |
| Locale operator | `apps/web/src/i18n/routing.ts` — `defaultLocale: "fa"` |
| Locale marketing | `apps/marketing/src/i18n/resolve-app-locale.ts`, `resolve-locale.ts` |
| Guest landing i18n | `packages/workspace-sdk/src/catalog/workspace-guest-landing.generated.ts` — `i18nProfile` |
| Tenant context | `apps/api/src/tenant/tenant-branding.service.ts` — `resolvePublicTenantContextBySubdomain` |
| Audit baseline (stale on formatters) | `.architecture-analysis/COMPOSABLE-WORKSPACE-ARCHITECTURE-AUDIT.md` §8 |
| Ledger blocked tasks | `docs/dev/composable-workspace-refactor-plan.md` — CW2-02, CW2-03, CW2-07, CW7-11 |

**Grep patterns used:** `pluginId === "denali"`, `irrDisplayUnit`, `formatTourPrice`, `formatCatalogPrice`, `OPERATOR_IRR`, `toman`, `workspaceCommerce`, `priceCurrency`, `formatMinorAmount`.

---

## Implications for marketing and operator web

| App | Current | After approved contract |
|-----|---------|-------------------------|
| **apps/web** | `formatTourPrice(amount, currency, locale, readCachedTourCommercialCapability(pluginId))` | Bind presentation from manifest/codegen-resolved policy; cache keyed on pluginId unless tenant override added |
| **apps/marketing** | `formatCatalogPrice(..., catalogSurface)` where surface includes `irrDisplayUnit` | Surface values from manifest/codegen; optional tenant resolver if bootstrap extended |
| Finance / portal | Unchanged by CW2-02/03; separate DEC if portal receipt should follow workspace presentation |

Marketing JSON-LD and wire contracts should continue **`priceCurrency: "IRR"`** (ISO) regardless of display label.

---

## Tasks unblocked if approved

| Task | Unblocked work |
|------|----------------|
| **CW2-02** | Move `irrDisplayUnit` from Denali TS into manifest `commercePresentation` / marketingCatalog codegen; remove duplicate hand constants |
| **CW2-03** | Codegen `tourCommercial` default from manifest; operator warm reads generated map |
| **CW2-07** | Guard lock: no `pluginId === "denali"` in formatters; assert presentation comes from generated/manifest resolver only |
| **CW7-11** | Base-price field module contract references workspace `commercePresentation` for wizard/list label consistency |

**Transitively:** CW7-12 (membership discount field) after CW7-11.

---

## Open questions for Product + Architect

1. Should **frozen** Denali tenants ever override display unit per tenant (presentation-only), or is workspace lock mandatory?
2. Should portal member receipt (`ریال` for IRR) align with operator/marketing presentation or stay finance-ISO?
3. Is runtime metadata edit of presentation required for non-Denali workspaces at CW-9, or manifest-only sufficient?

---

## Verification

- Static inspection of listed paths at `7d3daac6`.
- Grep confirms formatter `pluginId === "denali"` removal; audit §8 partially stale.
- **No code or behavior changes** in this packet.
