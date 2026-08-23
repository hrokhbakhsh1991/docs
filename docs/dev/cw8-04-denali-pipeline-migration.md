# CW8-04 — Denali pipeline migration

**Verdict:** Implementation  
**Ledger task:** CW8-04  
**Status:** Denali validation mapped to pipeline stages; CW0-07 golden parity under flag  
**Prepared:** 2026-08-23

---

## Migration witness

Denali persist validation routes through `runWorkspaceValidationPipeline` when `WORKSPACE_VALIDATION_PIPELINE=1`:

1. **sharedValidation** — `validateCanonical` + `filterEngineValidationResult`
2. **capabilityValidation** — catalog ref integrity (publish mode)
3. **workspacePolicyValidation** — flat hooks + `validatePublishReadiness`

Legacy default path unchanged until CW8-06.

## Tests

| Spec | Coverage |
| ---- | -------- |
| `cw8-04-denali-pipeline-parity.spec.ts` | CW0-07 publish-ready + tour-minimal active goldens; stage metadata |
| `cw8-02-flag-parity.spec.ts` | baseline Denali/Urban/starter parity (existing) |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw8-04-denali-pipeline-migration.md`.*
