# MAT-M2 Stage 0 — REQ-P7-007 urban digest closure

**Date:** 2026-08-24  
**Verdict:** **STALE EVIDENCE (A) + LEGITIMATE ARTIFACT DRIFT (B)** — not Urban regression

---

## Investigation

| Question | Finding |
|----------|---------|
| Current digest | `d2754778da018c9b9d909891ecf5f10b557ed99832522a862a25ddbff9d92ef9` (105 files) |
| Expected (stale) | `15af23b2861cd7dac01cebd0afaa8cfc93150f627bf01d4983f4a650ed9aa8f4` (103 files) |
| Last matching commit | `0e988120` — Wave A denali token purge |
| First diverging commit | `bb564fd1` — integrationSurface strip + phase-1 contract |
| Current HEAD change | `60552407` — CW5-10 wizard resume Option C |

## Classification

**A + B:** Baseline YAML stale after intentional platform-core changes. Urban package did not modify `packages/platform-core`.

**Not E (Urban regression):** REQ-P7-008 urban branch scan unchanged; no urban imports in platform-core.

## Semantic parity proof

- `packages/platform-core/test/resolve-generic-initial-step-index.spec.ts` — GEN-RESUME-01..06 PASS
- `packages/platform-core/test/platform-wizard-host-hooks.spec.ts` — CW5-10 noop/generic resume PASS
- `packages/workspaces/urban/test/phase-7.contract.spec.ts` — REQ-P7-007 PASS after baseline refresh

## Remediation

Updated `reports/phase-7-genericity-baseline.yaml` and `reports/phase-8-genericity-baseline.yaml` with current tree digest via canonical REQ-P7-007 algorithm (no algorithm change; proof rev 5 unchanged).

*Architect, documentation status: Updated. Link to docs: `docs/dev/mat-m2-stage0-urban-digest-closure.md`.*
