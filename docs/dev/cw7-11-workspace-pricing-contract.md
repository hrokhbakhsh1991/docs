# CW7-11 — Workspace Pricing capability contract (design + codegen)

**Verdict:** **PASS**  
**Ledger task:** CW7-11  
**Status:** Contract frozen; codegen + Denali adapter bindings; **no finance / display-policy migration**  
**Prepared:** 2026-08-24 (Wave 7C1)  
**Deps satisfied:** CW5-11, DEC-CW-06 (`catalogPresentation.priceDisplay`), CW2-02/03  

**Mandatory inputs (not re-audited):**

- `docs/dev/composable-workspace-refactor-plan.md` — CW7 per-capability six artifacts
- `docs/dev/cw7-10-workspace-itinerary-contract.md` — top-level capability block pattern
- `docs/dev/decisions/DEC-CW-06-evidence.md` — price display ownership boundary
- `packages/workspace-sdk/src/catalog/resolve-catalog-price-display.ts` — presentation resolver (out of scope for field module)

---

## 1. Executive summary

Pricing becomes a **reusable Tour capability** with manifest block `workspacePricing`, following `workspaceItinerary` / `workspaceTransport`. **Price display (IRR/toman labels) remains on `catalogPresentation.priceDisplay`** (DEC-CW-06 Option E); the capability block owns **enablement**, optional **base-price field-module** registration, optional **wizard composite** binding for the pricing-payment widget anchor, and the **neutral monetary canonical path** (`pricing.basePricePerPerson`).

Denali remains the reference adapter. **Prepayment rules, membership-discount gate, finance quotes/obligations, and payment-mode defaults stay Denali-owned** (finance boundary; CW7-12 scopes `allowMembershipDiscount` separately).

---

## 2. Current state (baseline)

| Concern | Today | Owner |
|---------|-------|-------|
| Marketing/operator price labels | `catalogPresentation.priceDisplay` → `resolveCatalogPriceDisplay` | Manifest + guest-catalog codegen (DEC-CW-06) |
| Wizard base-price input | `pricing.basePricePerPerson` inside `denali.pricing-payment` composite | Denali field registry + composite |
| Finance quote / obligation | `resolveDenaliRegistrationObligationMinor`, commercial-quote service | Finance-core + Denali adapter |
| Membership discount gate | `pricing.allowMembershipDiscount` composite dependent | Denali + finance-core (CW7-12) |
| Urban / guest-club | No paid-tour pricing wizard surface | Manifest absence |

**Gap:** no unified capability master switch for base-price field mechanics; Denali pricing field semantics scattered across field registry and composite anchors; workspaces without pricing lack formal “off” contract.

---

## 3. Manifest block — `workspacePricing`

### 3.1 Shape (Zod + codegen)

```ts
workspacePricing: {
  supported: boolean;
  capabilities?: {
    wizardTourField?: boolean;   // optional field-module fragment + wizard composite
  };
  fieldModule?: { module: string; export: string };
  wizardComposite?: { module: string; export: string };
}
```

**`supported` vs surface flags:** `supported: false` (or absent block) is the **capability master switch**. `capabilities.wizardTourField` gates field-module / wizard-composite seams only when `supported: true`. Unset capability flags default **false** at codegen (opt-in surfaces).

**Display policy authority:** `catalogPresentation.priceDisplay` (DEC-CW-06) remains the sole source for IRR/toman presentation. `workspacePricing` MUST NOT duplicate or override `priceDisplay`.

**Wizard composite:** When `capabilities.wizardTourField` is true, codegen requires both `fieldModule` and `wizardComposite`. Base price renders inside the workspace-owned pricing-payment composite (`denali.pricing-payment` for Denali); binding exports composite renderer id + anchor + base-price canonical path metadata only.

### 3.2 Example — Denali (adapter binding, not registry migration)

```json
"workspacePricing": {
  "supported": true,
  "capabilities": {
    "wizardTourField": true
  },
  "fieldModule": {
    "module": "./field-registry/denali-pricing-field-module",
    "export": "denaliPricingFieldRegistryFragment"
  },
  "wizardComposite": {
    "module": "./composites/denali-pricing-composite-binding",
    "export": "denaliPricingWizardCompositeBinding"
  }
}
```

### 3.3 Enabled / disabled semantics

| Layer | Signal | Effect when off |
|-------|--------|-----------------|
| **Manifest capability** | `workspacePricing` absent or `supported: false` | No codegen capability row; no field-module / wizard-composite bindings |
| **Per-surface flags** | `capabilities.wizardTourField` | Wizard seams omitted even if `supported: true` |
| **Display** | `catalogPresentation.priceDisplay` | Unchanged — marketing/operator formatters use `resolveCatalogPriceDisplay` |
| **Finance** | `workspaceFinance` | Quotes/obligations unchanged |
| **Isolation** | starter / urban / guest-club / policy-cert | Absent block → zero generated bindings |

---

## 4. Generic capability behavior

When `workspacePricing.supported: true`, the platform provides:

1. **Codegen capability flags** — `workspace-pricing-capabilities.generated.ts` projects manifest → boolean gates.
2. **Optional field-module dispatch** — `resolveWorkspacePricingFieldRegistryFragment(workspaceType)` when `wizardTourField` + `fieldModule` bound.
3. **Optional wizard-composite dispatch** — `resolveWorkspacePricingWizardCompositeBinding(workspaceType)` when `wizardTourField` + `wizardComposite` bound.
4. **Neutral canonical path** — `WORKSPACE_PRICING_BASE_PRICE_CANONICAL_PATH` (`pricing.basePricePerPerson`).
5. **Capability validation registry row** — `workspacePricing` id in `WORKSPACE_CAPABILITY_VALIDATORS`.
6. **Isolation default** — absent block or `supported: false` → none of the above.

**Explicit non-goals (generic layer MUST NOT):**

- Ship IRR/toman defaults or currency formatters
- Own finance quote / obligation / discount business rules
- Replace `resolveCatalogPriceDisplay` or duplicate `catalogPresentation.priceDisplay`
- Migrate full Denali `denaliFieldRegistryData` pricing rows in this slice
- Implement `pricing.allowMembershipDiscount` capability flag (CW7-12)

---

## 5. Denali policy and data ownership

| Concern | Generic / host | Denali-owned (adapter) |
|---------|----------------|------------------------|
| Base-price canonical path | `WORKSPACE_PRICING_BASE_PRICE_CANONICAL_PATH` | Contextual visibility under `pricing.requiresPayment` |
| Wizard field | Fragment merge seam | `denali.pricing-payment` composite + dependent leaves |
| Price display labels | `catalogPresentation.priceDisplay` codegen | `irrDisplayUnit: "toman"` manifest row |
| Finance | `workspaceFinance` bindings | Quote multiply, obligation resolver, prepayment rules |
| Membership discount | CW7-12 (future) | `pricing.allowMembershipDiscount` composite dependent |

---

## 6. Verification matrix

| Check | Spec / command |
|-------|----------------|
| Capability present (Denali) | `workspace-pricing-codegen.spec.mjs` |
| Capability absent isolation | `cw7-11-pricing-isolation.spec.mjs` |
| Denali field parity | `denali-pricing-field-parity.spec.ts`, `denali-pricing-parity.golden.spec.ts` |
| Catalog price display (DEC-CW-06) | `resolve-catalog-price-display.spec.ts`, `tour-price-display-policy.spec.ts` |
| Finance regression | `pricing-finance.golden.spec.mjs`, `finance-obligation.spec.ts` |
| Registry check | `pnpm run generate:workspace-registry --check` |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-11-workspace-pricing-contract.md`.*
