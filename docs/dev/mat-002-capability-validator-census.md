# MAT-002 — Capability validator census (M1)

**Program:** Enterprise Maturity MAT-M1  
**Date:** 2026-08-24  
**Verdict:** **INVALID_STUB remediated** — 5 active tour-capability validators implemented; 2 legitimate no-ops retained.

---

## Census summary

| Capability ID | Classification | wizardTourField / gate | Remediation |
|---------------|----------------|------------------------|-------------|
| `workspaceBooking` | **LEGITIMATE_NOOP** | Booking validation on registration path via `validationPolicy` adapters | Documented noop — not tour canonical |
| `workspaceDifficultyFitness` | **INVALID_STUB → FIXED** | `denali` `wizardTourField: true` | Structural scalar validation |
| `workspaceEquipment` | **INVALID_STUB → FIXED** | `denali` `wizardTourField: true` | `participants.gearItems` shape |
| `workspaceFinance` | **LEGITIMATE_NOOP** | Finance on registration/finance HTTP paths | Documented noop — not tour canonical |
| `workspaceItinerary` | **INVALID_STUB → FIXED** | `denali` `wizardTourField: true` | `program.itinerary` tree shape |
| `workspacePricing` | **INVALID_STUB → FIXED** | `denali` `wizardTourField: true` | `pricing.basePricePerPerson` |
| `workspaceTransport` | **INVALID_STUB → FIXED** | `denali` `wizardTourField: true` | `transport.*` structural shape |

**Test-only / future:** none in registry — all seven rows correspond to at least one manifest with `supported: true`.

**cert-club:** equipment + transport `supported: true` but `wizardTourField: false` — validators correctly no-op (surface-gated).

**Urban / starter:** absent capability blocks — validators no-op via generated capability getters.

---

## Implementation map

| Validator | Module | Codes |
|-----------|--------|-------|
| Equipment | `apps/api/src/tours/capability-validators/workspace-equipment-capability-validator.ts` | `WORKSPACE_EQUIPMENT_INVALID` |
| Transport | `workspace-transport-capability-validator.ts` | `WORKSPACE_TRANSPORT_INVALID` |
| Pricing | `workspace-pricing-capability-validator.ts` | `WORKSPACE_PRICING_INVALID` |
| Difficulty/Fitness | `workspace-difficulty-fitness-capability-validator.ts` | `WORKSPACE_DIFFICULTY_FITNESS_INVALID` |
| Itinerary | `workspace-itinerary-capability-validator.ts` | `WORKSPACE_ITINERARY_INVALID` |
| Booking | `workspace-booking-capability-validator.ts` | noop |
| Finance | `workspace-finance-capability-validator.ts` | noop |

**Codegen:** `scripts/codegen/workspace-registry/domains/validation-pipeline.mjs` → `workspace-capability-validation-bindings.generated.ts`

**Tests:** `apps/api/src/tours/capability-validators/capability-validators.spec.ts`

---

## Invariants preserved

- Generic validators — no Denali product rules (dong eligibility, fitness enum vocabulary, gear catalog membership).
- Tenant catalog membership for equipment ids remains publish-mode `assertCatalogRefIntegrity` + workspace policy.
- Pipeline order unchanged: shared → capability → workspacePolicy.
- Absent capability / disabled surface → null (no-op).

*Architect, documentation status: Updated. Link to docs: `docs/dev/mat-002-capability-validator-census.md`.*
