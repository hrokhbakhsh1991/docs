# CW7-11 — Pricing field module seam

**Verdict:** Implementation  
**Ledger task:** CW7-11  
**Status:** Generic `workspacePricing.tourField` fragment + Denali adapter  
**Prepared:** 2026-08-24

---

## Generic types (`workspace-sdk/pricing`)

| Type | Role |
|------|------|
| `WorkspacePricingTourFieldConfig` | Neutral tour-field row shape for base-price |
| `WorkspacePricingFieldFragment` | `moduleId: "workspacePricing.tourField"` + fields array |
| `WorkspacePricingFieldRegistryFragment` | Registry slice (`version` + `fields`) for codegen merge |
| `WorkspacePricingWizardCompositeBinding` | Composite renderer id + anchor + base-price path metadata |
| `WORKSPACE_PRICING_BASE_PRICE_CANONICAL_PATH` | `"pricing.basePricePerPerson"` |

## Denali adapter

| Export | Path |
|--------|------|
| `denaliPricingFieldModule` | `denali-pricing-tour-field-module.ts` — tour-field config |
| `denaliPricingFieldRegistryFragment` | `denali-pricing-field-module.ts` — registry slice (pricing-payment composite anchor) |
| `denaliPricingWizardCompositeBinding` | `denali-pricing-composite-binding.ts` |

Base price (`pricing.basePricePerPerson`) is a **composite dependent** of `pricing.requiresPayment` (INV-WIZ-002). The field-registry fragment exposes the composite anchor row (`denali.pricing-payment`); the tour-field module declares the base-price canonical path for capability census.

## Merge seam

`mergeWorkspaceFieldRegistryWithPricingFragments(registry, fragment)` — same id-replace semantics as itinerary/transport fragments.

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-11-pricing-field-module.md`.*
