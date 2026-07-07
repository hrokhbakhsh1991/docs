# P5 — Denali operator preservation (gate every PR)

**Score impact:** failure here blocks P5-core exit (EX-B-02).

## Surfaces (PC-01..10)

| ID | Surface | Package / app anchor | Verify spec |
|----|---------|----------------------|-------------|
| PC-01 | Create wizard | `denali.plugin.ts` · `use-denali-create-tour-wizard.ts` | golden + wizard specs |
| PC-02 | Clone tour | `tourClone` · Phase 11 docs | clone hydrate specs |
| PC-03 | Template/preset | `settings/tour_wizard_template` | template gate specs |
| PC-04 | Tour list | `tourList.extractTourListProjection` | operator list specs |
| PC-05 | Settings ×9 | `denali-settings.manifest.ts` | settings-manifest spec |
| PC-06 | Finance receipts | `POST/PATCH /finance/receipts` | finance-admin.spec |
| PC-07 | offline_receipt | `denaliCore.schema.ts` · golden | schedule-fields spec |
| PC-08 | Drafts | `operator.wizard` namespace | draft binding specs |
| PC-09 | Composites UI | `src/ui/` · composite registry | composites.contract |
| PC-10 | Catalog hooks | `publicCatalog` | P4 catalog specs |

## Gate commands

```bash
pnpm run guard:p3-denali-covenant
pnpm run guard:import-boundary
pnpm --filter @apps/api exec node --import tsx --test test/p5-preservation-gate.spec.ts
```

## Anti-drift

See [`ANTI-DRIFT.md`](./ANTI-DRIFT.md) AD-S0-* before any Denali package edit.
