# CW8-05 — Urban pipeline migration

**Verdict:** Implementation  
**Ledger task:** CW8-05  
**Status:** Urban validation mapped to pipeline stages; urban golden parity under flag  
**Prepared:** 2026-08-23

---

## Migration witness

Urban persist validation routes through `runWorkspaceValidationPipeline` when `WORKSPACE_VALIDATION_PIPELINE=1` and `WORKSPACE_VALIDATION_PIPELINE_URBAN_POLICY=1`:

1. **sharedValidation** — `validateCanonical` + `filterEngineValidationResult`
2. **capabilityValidation** — no urban capability validators (skip)
3. **workspacePolicyValidation** — Urban flat hooks via manifest `workspacePolicy` module

Legacy default path unchanged until CW8-06.

**Preserved Urban behavior:** confirmed/waitlist registration policy, publish/archive labels, no booking model, no Denali dong/personal-car rules, no itinerary/transportModes on persist.

**Not wired (parity):** `validateUrbanCatalogFieldValue` remains off persist path — same as legacy.

## Flag

| Env | Role |
| --- | --- |
| `WORKSPACE_VALIDATION_PIPELINE=1` | Enable staged pipeline |
| `WORKSPACE_VALIDATION_PIPELINE_URBAN_POLICY=1` | Urban policy module supersedes flat hooks |

## Tests

| Spec | Coverage |
| ---- | -------- |
| `cw8-05-urban-pipeline-parity.spec.ts` | publish-ready + capacity + itinerary + transport goldens |
| `cw8-02-flag-parity.spec.ts` | baseline Urban capacity parity (existing) |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw8-05-urban-pipeline-migration.md`.*
