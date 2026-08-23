# DEC-CW-06 — Currency / locale display config shape (evidence packet)

**Ledger task:** CW2-01  
**Decision id:** DEC-CW-06  
**Status:** Evidence only — **no product semantics chosen**  
**Repository ref:** `7d3daac6` (baseline for this packet)  
**Prepared:** 2026-08-23  
**Decision owners:** Pricing product owner + Architect  

**Mandatory inputs (not re-audited):**

- `.architecture-analysis/COMPOSABLE-WORKSPACE-ARCHITECTURE-AUDIT.md` (AUDIT) §7–8
- `.architecture-analysis/TOUR-DOMAIN-TRUTH-MAP.md` (TRUTH) §25–26, semantic-divergence table
- `.architecture-analysis/SHARED-TOUR-CORE-EXTRACTION-FEASIBILITY.md` (FEAS) §1 UI table
- `docs/dev/composable-workspace-refactor-plan.md` — DEC-CW-06 gate + CW2-02/03/07/7-11

---

## 1. Executive summary

Iranian Rial (ISO `IRR`) is stored everywhere as **ISO currency + integer minor/display digits with no ×10 conversion**. Denali additionally **labels** those same integers as **toman / تومان** in catalog and operator surfaces. Other workspaces with `IRR` (e.g. harbor) keep `Intl` currency formatting (ریال / `IRR`).

**Baseline drift (important):** AUDIT §8 and FEAS §1 still cite `pluginId === "denali"` in marketing/web formatters. At `7d3daac6` those formatters are **already policy-driven** (`irrDisplayUnit === "toman"`). Coupling moved from host `pluginId` branches to **workspace plugin capability + marketing catalog surface module**. The **config source shape is still undeclared** — values live in TypeScript modules, not manifest JSON. DEC-CW-06 must choose whether to codify display policy in manifest/codegen, commerce block, capability module, or hybrid.

**Blocks:** CW2-02, CW2-03, CW2-07 (currency guard clauses), CW7-11, transitively CW7-12.

---

## 2. Current currency / locale display config shapes

### 2.1 Layered model (today)

| Layer | Shape | Owner | Example |
|-------|--------|-------|---------|
| **Canonical storage** | `pricing.basePricePerPerson` (integer), `priceCurrency` / obligation `currency` (ISO string) | Workspace canonical + finance adapters | Denali tours: `IRR` |
| **Manifest `commerce`** | `{ paymentMode, gatewayProvider, currency, frozen? }` | Workspace manifest → codegen freeze | Denali: `{ frozen: true, currency: "IRR", paymentMode: "offline_receipt" }` |
| **Tenant commerce override** | Same `WorkspaceCommerceConfig` via metadata binding | Tenant + published workspace definition | Starter overlay can set `currency: "IRR"` gateway mode (test) |
| **Display unit policy** | `{ irrDisplayUnit?: "toman" }` | Workspace plugin / marketing surface **module** (not manifest JSON) | Denali only |
| **Locale** | `tenant.defaultLocale: "fa" \| "en"` + user cookie | Tenant theme (host) | Marketing `dateLocale`; portal `resolve-locale.ts` |
| **Finance presentation** | Minor-unit strings + workspace finance adapters | `finance-core` + `workspaceFinance` adapters | Denali obligation minor; Alpine `CHF` |

### 2.2 Manifest blocks (workspace-scoped)

| Block | Currency/display fields today | Workspaces |
|-------|------------------------------|------------|
| `commerce` | `currency` (ISO), `paymentMode`, `gatewayProvider`, optional `frozen` | Denali only (`IRR`, frozen) |
| `catalogPresentation` | `listFeatures`, `detailSections` — **no price display** | denali, urban, harbor, guest-club |
| `marketingCatalog` | Module binding only (`module` + `export`) — **irrDisplayUnit lives in exported surface object** | Denali only |
| `tenantBrandingDefaults` | Colors/CSS — no currency | All guest-capable |
| Plugin `capabilities.tourCommercial` | **Not manifest-declared** — hardcoded in `denali.plugin.ts` | Denali only |

**Codegen outputs (relevant):**

- `packages/workspace-sdk/src/metadata/workspace-commerce-freeze.generated.ts` — frozen commerce by workspace type
- `packages/workspace-sdk/src/catalog/workspace-catalog-list-features.generated.ts` — from `catalogPresentation.listFeatures`
- `packages/guest-workspace-runtime/src/workspace-marketing-catalog-bindings.generated.ts` — lazy `resolveMarketingCatalogSurface` dispatch

### 2.3 Host formatter contracts (neutral code)

Marketing (`apps/marketing/src/catalog/format-catalog-display.ts`):

```ts
export type CatalogPriceDisplayPolicy = Pick<MarketingCatalogSurface, "irrDisplayUnit">;

// IRR + irrDisplayUnit === "toman" → grouped digits + تومان/toman (no ×10)
// Otherwise → Intl.NumberFormat(dateLocale, { style: "currency", currency })
```

Operator web (`apps/web/src/features/tours/tour-list-formatters.ts`):

```ts
formatTourPrice(amount, currency, locale, commercialPolicy?: Pick<WorkspaceTourCommercialCapability, "irrDisplayUnit">)
```

SDK capability type (`packages/workspace-sdk/src/plugin/workspace-plugin-capabilities.ts`):

```ts
export type WorkspaceTourCommercialCapability = {
  readonly irrDisplayUnit?: "toman";
  readonly resolveSuggestedPrepaymentMinor?: (...) => string | null;
};
```

### 2.4 Workspace-local formatters (not host)

| Location | Behavior |
|----------|----------|
| `packages/workspaces/denali/src/ui/adapters/i18n-format.ts` | `formatIrrAsTomanLabel` — wizard/review grouping |
| `packages/workspaces/denali/src/ui/logic/denali-review-format-logic.ts` | Review rows use Denali toman formatter (ED-REV-CURR-01) |
| `packages/workspaces/denali/messages/fa/wizard.json` | Field labels say تومان explicitly |

### 2.5 Tenant vs workspace ownership

| Concern | Workspace-owned | Tenant-overridable today | Host-owned |
|---------|-----------------|--------------------------|------------|
| ISO currency for commerce/finance | Manifest `commerce.currency` (frozen for Denali) | Yes — metadata binding can override published definition `commerce` block when `WORKSPACE_METADATA_ENABLED` | Resolution in `apps/api/src/workspace-metadata/resolve-workspace-commerce-for-tenant.ts` |
| IRR display unit (toman vs rials) | Denali plugin + marketing surface module | **No** — not in tenant theme or metadata | Formatters in apps/marketing, apps/web |
| UI locale (fa/en) | `guestLanding.i18nProfile` hints | `tenant.defaultLocale` on theme | Cookie + `resolve-locale` |
| Date/number shaping | — | — | `formatLocalizedNumber`, `Intl` with `fa-IR` / persian calendar |

**Evidence:** Tenant commerce inheritance — `apps/api/test/workspace-metadata-commerce-inherit.spec.ts` (P5-C-N-004). Display policy has **no tenant seam**.

---

## 3. Where IRR / toman / USD appear today

### 3.1 IRR + toman display (same stored integer, no ×10)

| Surface | File(s) | Policy source | Notes |
|---------|---------|---------------|-------|
| Marketing catalog cards/detail | `format-catalog-display.ts`, `catalog-commercial-pricing.tsx` | `resolveMarketingCatalogSurface(pluginId)` → `irrDisplayUnit: "toman"` | Spec: `MKT-CURR-01` |
| Operator tour list/edit header | `tour-list-formatters.ts`, `tour-card.tsx`, edit clients | `readCachedTourCommercialCapability(pluginId)` from loaded plugin | Spec: `ED-CURR-01` in `tours-list.spec.ts` |
| Denali wizard review | `denali-review-format-logic.ts`, `i18n-format.ts` | Workspace-local | Must not import `apps/web` formatters |
| Denali wizard field labels | `messages/fa/wizard.json` | Static copy | Product copy, not runtime config |

### 3.2 IRR without toman (Intl / ریال)

| Surface | File(s) | When |
|---------|---------|------|
| Harbor / Urban / guest-club marketing | `formatCatalogPrice` without `irrDisplayUnit` | `Intl` paints ریال or `IRR` |
| Operator list for non-Denali IRR | `formatTourPrice` without `commercialPolicy` | `tours-list.spec.ts` harbor case |
| Portal member receipt upload | `apps/portal/app/me/registrations/[id]/member-receipt-upload-form.tsx` | **Hardcoded `ریال` for IRR** — inconsistent with Denali toman elsewhere |

### 3.3 USD / CHF / other ISO

| Surface | Currency | Evidence |
|---------|----------|----------|
| Alpine finance adapters | `CHF` | `packages/workspaces/alpine/src/finance/receipt-defaults.adapter.ts` |
| Finance WS2 / certification fixtures | `USD` | `apps/api/src/workspace-finance/finance-ws2-engine.spec.ts` |
| Generic formatter fallback | Any ISO | `Intl.NumberFormat` in marketing/web formatters |
| Platform currency boundary guard | Forbids host `IRR`/`USD` fallbacks | `apps/api/test/platform-currency-boundary.spec.ts` |

### 3.4 Storage / API / JSON-LD (always ISO)

- Denali manifest: `commerce.currency: "IRR"`
- Parity fixtures: `test/parity/fixtures/pricing-finance/denali-obligation-cases.json`
- Marketing JSON-LD: `priceCurrency` stays `IRR` (documented in `docs/workspaces/denali/marketing-catalog-ui.md`)
- TRUTH §25: Denali IRR/toman **presentation**; Urban `priceAmount: null` in list projection

### 3.5 Classification (TRUTH)

| Rule | TRUTH classification |
|------|---------------------|
| IRR/toman price display rules | **WORKSPACE_SPECIFIC** / **ACCIDENTALLY_COUPLED** |
| Finance obligation formulas (Denali minor units, IRR) | **CAPABILITY_SPECIFIC** adapter |
| Pricing linkage (`pricing.basePricePerPerson`) | **OUTDOOR_VERTICAL_GENERIC** + finance quote |

Non-goal (ledger): platform must **not** add global IRR/toman rules in neutral core (AUDIT §8; plan non-goal #8).

---

## 4. Baseline vs code reality (AUDIT §8 drift)

| AUDIT / FEAS claim | Code at `7d3daac6` |
|--------------------|-------------------|
| `pluginId === "denali"` in `format-catalog-display.ts` | **Absent** — uses `priceDisplayPolicy?.irrDisplayUnit` |
| `OPERATOR_IRR_TOMAN_PLUGIN_IDS = ["denali"]` in `tour-list-formatters.ts` | **Absent** — uses `commercialPolicy?.irrDisplayUnit` |
| P1 host coupling | **Partially retired** — policy injection remains; **source of policy is workspace TS modules** |

Denali still encodes toman in:

- `packages/workspaces/denali/src/denali.plugin.ts` — `capabilities.tourCommercial.irrDisplayUnit`
- `packages/workspaces/denali/src/marketing/marketing-catalog-surface.ts` — `irrDisplayUnit: "toman"`

**CW2-02/03 ledger text** still describes `pluginId` replacement — execution should be reframed as **manifest/codegen binding for existing policy seam**, not a formatter rewrite.

---

## 5. Codegen / binding opportunities vs risks

### 5.1 Existing patterns to extend

| Pattern | Precedent | Applicability |
|---------|-----------|---------------|
| `catalogPresentation` → generated constants | `workspace-catalog-list-features.generated.ts` | Add optional `priceDisplay` sub-object |
| `marketingCatalog` → lazy dispatch | `workspace-marketing-catalog-bindings.generated.ts` | Already loads Denali surface; could inject manifest-derived flags |
| `commerce.frozen` → codegen freeze | `workspace-commerce-freeze.generated.ts` | Could add `displayUnit` but mixes payment + presentation |
| Plugin capability bag | `tourCommercial` on `denali.plugin.ts` | Could be generated from manifest snapshot at registry build |

### 5.2 Opportunities

1. **Declarative manifest field** — inspect workspace without loading plugin bundle.
2. **Registry `--check` determinism** — display policy in generated tables (matches CW-3/CW-6 profile style).
3. **Single binding for CW2-02 + CW2-03** — marketing and operator read same generated `priceDisplay` row.
4. **CW7-11 pricing-fields capability** — manifest block for base-price field + display policy together.
5. **Guard closure (CW2-07)** — fail on reintroduced `pluginId` currency branches **and** on hardcoded `["denali"]` allowlists.

### 5.3 Risks

| Risk | Detail |
|------|--------|
| **×10 conversion** | Product invariant: storage is ISO IRR integers; toman is label only. Any schema implying Rial↔Toman conversion is forbidden. |
| **Commerce vs display conflation** | `commerce.currency` drives finance/gateway; `irrDisplayUnit` is presentation-only. Merging risks tenant override applying to wrong layer. |
| **Portal inconsistency** | Portal receipt form uses `ریال`; marketing/operator use تومان for same tenant. DEC-CW-06 should address **member-facing** display or explicitly defer to DEC-CW-04 scope. |
| **Tenant override ambiguity** | Commerce can be tenant-overridden via metadata; display policy cannot today. If tenants can rebrand, can they change display unit? |
| **Locale split** | `dateLocale` from tenant theme vs `AppLocale` in operator shell — formatting already branches `fa` vs `en` for unit strings. |
| **Urban null prices** | TRUTH §25 — Urban list `priceAmount: null`; display config must not force price chips. |
| **Stale docs** | Denali workspace docs still describe `pluginId === "denali"` / `OPERATOR_IRR_TOMAN_PLUGIN_IDS` — doc sync needed after decision (not CW2-01 scope). |

---

## 6. Options for DEC-CW-06

### Option A — Extend `catalogPresentation.priceDisplay` (manifest + codegen)

**Shape:**

```json
"catalogPresentation": {
  "listFeatures": { ... },
  "detailSections": { ... },
  "priceDisplay": {
    "irrDisplayUnit": "toman"
  }
}
```

Codegen emits row in `workspace-catalog-price-display.generated.ts` (new); marketing reads generated constant or snapshot; operator `tourCommercial` snapshot generated alongside.

| Pros | Cons |
|------|------|
| Matches existing `catalogPresentation` codegen (CW7-09 precedent) | Splits from `commerce.currency` — two manifest places |
| Declarative, diffable in PRs | Requires schema + guard + registry domain work |
| Natural home for CW7-11 pricing **presentation** gates | Operator web still needs binding into `tourCommercial` cache |

### Option B — Extend manifest `commerce` block

**Shape:** add optional `irrDisplayUnit?: "toman"` (and future `minorUnitScale?`) to `WorkspaceCommerceConfig`.

| Pros | Cons |
|------|------|
| Single commerce config next to `currency: "IRR"` | Presentation mixed with payment mode / gateway |
| Tenant metadata override path already exists | Tenant could override display unintentionally when editing commerce |
| Frozen commerce codegen already exists | Urban/Harbor lack `commerce` block today |

### Option C — Retain runtime-only plugin/marketing surface (status quo+)

Keep `irrDisplayUnit` in `denali.plugin.ts` + `marketing-catalog-surface.ts`; CW2-02/03 close as **verification + documentation** only.

| Pros | Cons |
|------|------|
| Zero behavior change; formatters already policy-driven | Not manifest-declarative; AUDIT “generic debt” goal partially unmet |
| No codegen/schema churn | New workspace must edit TS modules, not manifest data |
| Lowest implementation risk | CW7-11 harder — no manifest contract for pricing display |

### Option D — New composable capability `workspaceCatalogPriceDisplay` (CW-7 style)

Formal capability block: manifest + validation + UI seam + isolation test (per CW-7 artifact list).

| Pros | Cons |
|------|------|
| Aligns with CW7-11 pricing-fields module | Heavier than CW-2 needs; delays host decoupling |
| Clean boundary for certification | Overkill if only Denali needs IRR/toman for years |

### Option E — Hybrid (manifest snapshot + runtime capability)

Manifest declares `priceDisplay`; codegen validates and **projects** into generated `tourCommercial` / marketing surface stubs; runtime plugin may still export functions (prepayment resolver).

| Pros | Cons |
|------|------|
| Declarative source of truth + rich runtime hooks | Two layers to keep in sync; needs parity test |
| Best fit for existing capability bag pattern | Most design work upfront |

---

## 7. Affected downstream tasks

| Task | Dependency on DEC-CW-06 | Impact |
|------|-------------------------|--------|
| **CW2-02** | Direct | Wire marketing `priceDisplayPolicy` to chosen config source (not Denali TS module). Formatter logic **already neutral**. |
| **CW2-03** | Direct | Wire operator `commercialPolicy` to same source. `readCachedTourCommercialCapability` may read generated snapshot instead of plugin bag. |
| **CW2-07** | Direct | Extend `guard-no-workspace-type-branches.mjs` with currency-specific patterns (`pluginId` + IRR, `OPERATOR_IRR_TOMAN`, hardcoded workspace sets). |
| **CW7-11** | Direct | Base-price field module needs manifest contract for currency **display** + field paths; blocked until shape fixed. |
| **CW7-12** | Transitive | Membership discount UI reads pricing presentation; follows CW7-11. |
| **CW2-04..06** | None | Already closed. |
| **DEC-CW-04** | Related | Portal member status/display — portal `ریال` vs toman may need aligned vocabulary (separate gate). |

---

## 8. Open questions for decision owners

1. **Tenant override:** Can a tenant on Denali workspace ever display IRR as rials (`Intl`) instead of toman, or is display strictly workspace-level?
2. **Portal alignment:** Should member receipt amounts use تومان (match catalog) or ریال (current `member-receipt-upload-form.tsx`)?
3. **Scale contract:** Is `irrDisplayUnit: "toman"` sufficient, or do we need explicit `minorUnitScale` / `displayDivisor` for future currencies?
4. **Localization ownership:** Are unit strings (`تومان` / `toman`) workspace copy, i18n messages, or generated from manifest enum labels?
5. **Runtime configurability:** Must display policy be changeable without redeploying workspace package (manifest-only), or is codegen-at-build acceptable?
6. **Harbor/guest-club IRR:** If they keep `IRR` storage, is `Intl` rials the intended default for all non-Denali workspaces?

---

## 9. Recommended choice (PROPOSAL — Architect approval required)

**Recommend Option E (hybrid), implemented in two steps:**

1. **Manifest:** Add optional `catalogPresentation.priceDisplay.irrDisplayUnit` (`"toman"` | absent) to workspace manifest schema.
2. **Codegen:** New registry domain projecting a read-only snapshot consumed by:
   - marketing catalog surface resolver (CW2-02)
   - operator `tourCommercial` display fields (CW2-03), keeping `resolveSuggestedPrepaymentMinor` in plugin runtime

**Rationale:**

- Formatters are **already** policy-driven — decision is **where policy is declared**, not how amounts render.
- `catalogPresentation` is the established declarative seam for marketing catalog behavior; price display is catalog presentation, not payment routing.
- Keeps `commerce.currency` focused on finance/gateway (TRUTH §25–26 capability boundary).
- Enables CW7-11 to attach pricing-field modules to the same manifest row without a second decision.
- Avoids Option C leaving manifest opacity that blocks composable workspace onboarding metrics (plan: zero host edits per new workspace).

**Explicitly not recommended:** Platform-level IRR/toman rules in `tour-core` or `platform-core` (non-goal #8).

---

## 10. Evidence index (file paths)

### Host formatters (neutral)

- `apps/marketing/src/catalog/format-catalog-display.ts`
- `apps/marketing/src/catalog/catalog-commercial-pricing.tsx`
- `apps/web/src/features/tours/tour-list-formatters.ts`
- `apps/web/src/features/tours/tour-route-cache.ts`
- `apps/web/app/(app)/tours/tour-card.tsx`

### Workspace policy sources

- `packages/workspaces/denali/src/denali.plugin.ts` (`capabilities.tourCommercial`)
- `packages/workspaces/denali/src/marketing/marketing-catalog-surface.ts`
- `packages/workspaces/denali/workspace.manifest.json` (`commerce`, `catalogPresentation`, `marketingCatalog`)

### SDK / codegen

- `packages/workspace-sdk/src/plugin/workspace-plugin-capabilities.ts`
- `packages/workspace-sdk/src/metadata/commerce-schema.ts`
- `packages/workspace-sdk/src/metadata/workspace-commerce-freeze.generated.ts`
- `packages/workspace-sdk/src/catalog/workspace-catalog-list-features.generated.ts`
- `packages/guest-workspace-runtime/src/workspace-marketing-catalog-bindings.generated.ts`
- `scripts/codegen/workspace-registry/domains/guest-catalog.mjs`
- `scripts/codegen/workspace-registry/domains/operator.mjs`

### Finance / API

- `apps/api/src/workspace-metadata/resolve-workspace-commerce-for-tenant.ts`
- `apps/api/test/workspace-metadata-commerce-inherit.spec.ts`
- `apps/api/test/platform-currency-boundary.spec.ts`

### Portal / locale

- `apps/portal/app/me/registrations/[id]/member-receipt-upload-form.tsx`
- `packages/workspace-sdk/src/theme/tenant-theme.contract.ts`
- `apps/portal/src/i18n/resolve-locale.ts`

### Workspace-local Denali

- `packages/workspaces/denali/src/ui/adapters/i18n-format.ts`
- `packages/workspaces/denali/src/ui/logic/denali-review-format-logic.ts`

### Tests

- `apps/marketing/test/marketing-catalog-display.spec.ts` (`MKT-CURR-01`)
- `apps/web/test/tours-list.spec.ts` (`ED-CURR-01`)
- `packages/workspaces/denali/test/denali-review-catalog-name.spec.ts` (`ED-REV-CURR-01`)

### Architecture inputs

- AUDIT §8 — customer-name coupling table
- TRUTH §25–26, semantic-divergence row “IRR/toman price display rules”
- FEAS §1 — UI coupling table (stale re: pluginId; see §4 above)

---

## 11. Verification performed (CW2-01 scope)

- Static enumeration via repository grep and file reads (codebase-memory-mcp unavailable in Cloud Agent runtime).
- Confirmed absence of `pluginId === "denali"` in formatter implementations at HEAD.
- Confirmed Denali-only `irrDisplayUnit: "toman"` in plugin + marketing surface modules.
- No production or codegen changes in this task.

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/decisions/DEC-CW-06-evidence.md`.*
