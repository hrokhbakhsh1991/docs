# CW7-12 — Membership discount pricing field (capability-declared)

**Verdict:** **PASS**  
**Ledger task:** CW7-12  
**Status:** `pricing.allowMembershipDiscount` formalized as `workspacePricing` capability surface  
**Prepared:** 2026-08-24 (CW-7 final closure)  
**Deps satisfied:** CW7-11 (`workspacePricing` block), finance gate (`readTourAllowMembershipDiscount`)

---

## 1. Executive summary

`pricing.allowMembershipDiscount` becomes a **capability-declared pricing field** under manifest block `workspacePricing`, following the CW7-11 `workspacePricing` pattern. The generic layer owns **field presence, registration, and neutral canonical-path declaration** only. Finance continues to own discount eligibility, quote/obligation behavior, and monetary effects. Membership owns member/tier/benefit semantics. Each workspace adapter owns whether the field is enabled and how it renders (Denali: composite dependent of `pricing.requiresPayment`).

**Explicit non-goals:** no discount calculation in Pricing, no Finance quote behavior change, no universal membership semantics, no Denali default changes, no currency/display changes.

---

## 2. Ownership boundary

| Concern | Owner | Artifact |
|---------|-------|----------|
| Canonical path | Pricing capability (generic) | `WORKSPACE_PRICING_ALLOW_MEMBERSHIP_DISCOUNT_CANONICAL_PATH` |
| Capability enablement | Manifest `workspacePricing.capabilities.allowMembershipDiscount` | Codegen `WorkspacePricingCapabilities` |
| Field registration | Workspace adapter `fieldModule` | Denali `denaliPricingFieldModule` row |
| Discount eligibility at freeze | Finance-core | `readTourAllowMembershipDiscount` |
| Member/tier benefit facts | Membership / Identity | Identity read port |
| UI composite wiring | Denali adapter | `denali.pricing-payment` dependent leaf |

---

## 3. Manifest extension

```ts
workspacePricing: {
  supported: boolean;
  capabilities?: {
    wizardTourField?: boolean;
    allowMembershipDiscount?: boolean;  // CW7-12
  };
  fieldModule?: { module: string; export: string };
  wizardComposite?: { module: string; export: string };
}
```

**Semantics:**

- `allowMembershipDiscount: true` requires `supported: true`.
- When `false` or absent, codegen emits `allowMembershipDiscount: false`; no membership-discount field row is registered via the capability fragment.
- Does **not** gate `wizardTourField` — base-price and membership-discount surfaces are independent opt-ins.
- Finance reads canonical path regardless of capability; capability controls **wizard field registration** only.

### Denali example

```json
"workspacePricing": {
  "supported": true,
  "capabilities": {
    "wizardTourField": true,
    "allowMembershipDiscount": true
  },
  "fieldModule": { "module": "./field-registry/denali-pricing-field-module", "export": "denaliPricingFieldRegistryFragment" },
  "wizardComposite": { "module": "./composites/denali-pricing-composite-binding", "export": "denaliPricingWizardCompositeBinding" }
}
```

---

## 4. Generic capability behavior

When `workspacePricing.capabilities.allowMembershipDiscount === true`:

1. Codegen projects `allowMembershipDiscount: true` on `WorkspacePricingCapabilities`.
2. Workspace `fieldModule` export may include the membership-discount tour-field row in `denaliPricingFieldModule` (adapter-owned).
3. Neutral path constant exported from `@app-tour/workspace-sdk/pricing`.

When absent or `false`:

- Codegen emits `allowMembershipDiscount: false`.
- Capability fragment omits membership-discount field row.
- Finance gate remains fail-closed (`readTourAllowMembershipDiscount` → `false`).

---

## 5. Verification matrix

| Check | Spec / command |
|-------|----------------|
| Capability flag codegen | `workspace-pricing-codegen.spec.mjs` |
| Membership discount field parity | `denali-pricing-parity.golden.spec.ts` |
| Finance gate regression | `read-tour-membership-discount-gate.spec.ts`, `membership-discount-gate.json` |
| Capability absent isolation | `cw7-12-membership-discount-isolation.spec.mjs` |
| Registry determinism | `pnpm run generate:workspace-registry --check` |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-12-membership-discount-pricing-field.md`.*
