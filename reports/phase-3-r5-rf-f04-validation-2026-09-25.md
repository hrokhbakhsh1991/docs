# Phase 3 R5 — RF-F04 validation — 2026-09-25

## Finding

The archived forensic note describes `data: z.record(z.string(), z.unknown())` as an overly permissive ingress. The current code intentionally keeps this boundary opaque because the API accepts canonical documents from multiple workspace plugins and must not duplicate workspace-specific schemas in `apps/api`.

The opaque input does not bypass validation:

1. `parseCreateTourBody` rejects unknown top-level fields and invalid envelope primitives.
2. `CanonicalTourService` calls `runPreTransactionValidation` before persistence.
3. `validateCanonicalDocumentWithEngine` builds the canonical document, calls `assertCanonicalDocument`, resolves the workspace plugin, and runs the shared/capability/policy validation pipeline.
4. Storage is reached only after that validation returns a canonical document.

## Classification

`false-positive / intentional generic boundary`.

Making `data` workspace-specific in the Zod ingress would duplicate plugin contracts and make `apps/api` workspace-specific. No code change was made.

## Evidence

- `apps/api/src/tours/create-tour.schema.ts`
- `apps/api/src/tours/canonical-validation-sync.ts`
- `apps/api/src/canonical/canonical-tour.service.ts`
- `apps/api/src/tours/create-tour.schema.spec.ts`
- `apps/api/src/tours/run-workspace-validation-pipeline.spec.ts`
- `apps/api/src/tours/validate-before-persist-ordering.spec.ts`

Architect: documentation status Updated. Link: [Phase 3.2 backlog](../docs/backlog/phase-3.2-red-flag-backlog.md).
