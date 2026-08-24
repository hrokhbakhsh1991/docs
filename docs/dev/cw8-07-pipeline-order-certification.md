# CW8-07 — Pipeline order certification + policy module guardrails

**Verdict:** Implementation  
**Ledger task:** CW8-07  
**Status:** Order certification spec + no-core-branching lint for policy modules  
**Prepared:** 2026-08-24 (Wave 7A)  
**Design contract:** [`cw8-01-validation-pipeline-contract.md`](cw8-01-validation-pipeline-contract.md) §11

---

## Certification

`cw8-07-pipeline-order-cert.spec.ts` asserts:

1. `PIPELINE_STAGES` order is `sharedValidation → capabilityValidation → workspacePolicyValidation`.
2. Short-circuit: first stage violation prevents later stages (mocked).
3. `WORKSPACE_CAPABILITY_VALIDATORS` manifest order is lexicographically stable.

## No-core-branching lint

`scripts/guards/guard-workspace-policy-no-core-branching.mjs`:

- Scans `packages/workspaces/*/src/**/*policy*.ts` (and manifest-bound policy modules).
- Fails when policy module calls `validateCanonical` directly (shared stage only).
- Fails when policy module imports `apps/*` host paths.

Wired into `pnpm run guard:architecture` via existing defensive guard chain.

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw8-07-pipeline-order-certification.md`.*
