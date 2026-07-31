# Root Command Classification — Architecture and Governance Guards

**Status:** Active — Phase 0 classification ledger, cohort 3E  
**Captured:** 2026-07-29  
**Parent ledger:** [`ROOT_COMMAND_CLASSIFICATION.md`](../../../platform/ROOT_COMMAND_CLASSIFICATION.md)

## Cohort result

**Reviewed commands:** 21  
**Previously reviewed:** 182  
**Total reviewed:** 203  
**Remaining:** 102

This final guard cohort covers shell architecture, design-system integrity,
release boundaries, and repository governance. No command is a removal
candidate.

## Platform and shell architecture

| Command                           | Primary class | Owner                 | Protection reason                                       |
| --------------------------------- | ------------- | --------------------- | ------------------------------------------------------- |
| `guard:architecture-truth`        | `COMPOSITE`   | Platform Architecture | Cross-surface architecture truth and direct CI consumer |
| `guard:no-app-cloud-imports`      | `LEAF`        | Platform Architecture | Canonical namespace closure                             |
| `guard:thin-shell`                | `LEAF`        | Platform Architecture | Product-import firewall and generated budget            |
| `guard:shell-product-tokens`      | `LEAF`        | Platform Architecture | Branded token ratchet                                   |
| `guard:transpile-product-ceiling` | `LEAF`        | Platform Build        | Product transpile-package ceiling                       |
| `guard:deploy-profile-plan`       | `LEAF`        | Platform Deployment   | Deploy-profile coherence                                |
| `guard:bundle-profile-isolation`  | `LEAF`        | Platform Deployment   | Sample profile product isolation                        |
| `guard:symlink`                   | `LEAF`        | Platform Architecture | Import-boundary evasion protection                      |

`guard:architecture-truth` is composite because it validates multiple
cross-surface architectural assertions. The remaining entries isolate distinct
ratchets and remain independently diagnosable.

## Design system and UI integrity

| Command                         | Primary class | Owner           | Protection reason                              |
| ------------------------------- | ------------- | --------------- | ---------------------------------------------- |
| `guard:admin-inline-color`      | `LEAF`        | Design System   | Admin semantic-color boundary                  |
| `guard:css-bootstrap-integrity` | `LEAF`        | Design System   | Cross-app CSS bootstrap contract               |
| `guard:css-globals`             | `LEAF`        | Design System   | Path-gated globals import-only rule            |
| `guard:theme-import-budget`     | `COMPOSITE`   | Theme Platform  | Loader guards and dynamic theme-import budgets |
| `guard:token-parity`            | `LEAF`        | Design System   | Shared semantic-token parity                   |
| `guard:wizard-post-submit`      | `LEAF`        | Wizard Platform | Path-gated post-submit contract                |

`guard:theme-import-budget` delegates multiple theme-loader and layout checks,
so it is a composite rather than a single-purpose leaf.

## Product and release boundaries

| Command                     | Primary class | Owner                | Protection reason                       |
| --------------------------- | ------------- | -------------------- | --------------------------------------- |
| `guard:p3-denali-covenant`  | `LEAF`        | Denali Architecture  | Product metadata and contract ratchet   |
| `guard:p4-cold-path-fan-in` | `LEAF`        | Platform Performance | Cold-path static import budget          |
| `guard:p8-boundary-diff`    | `CI_ONLY`     | Phase 8 Release      | Direct PR workflow boundary enforcement |
| `guard:p9-boundary-diff`    | `LEAF`        | Phase 9 Release      | Phase 9 write-boundary enforcement      |
| `guard:p9-surface-boundary` | `LEAF`        | Phase 9 Release      | P9 package/surface boundary             |

Phase-labelled guards may become historical only after their protected release
contracts and active docs are reviewed. A phase number alone is not evidence
that the command is obsolete.

## Governance

| Command                      | Primary class | Owner                  | Protection reason              |
| ---------------------------- | ------------- | ---------------------- | ------------------------------ |
| `guard:required-check-names` | `CI_ONLY`     | Release Engineering CI | Required-check name continuity |
| `guard:todo-debt-budget`     | `LEAF`        | Platform Quality       | Explicit debt budget           |

## Cohort decision

- All 21 names exist in the current root `package.json`.
- No name overlaps earlier cohorts.
- Two composite, two CI-only, and seventeen leaf guards are classified.
- All 117 root guard entries are now represented across the classification
  ledgers.
- No command body, workflow, assertion, or product implementation changed.
- The next phase-zero work is classification of the remaining 102 non-guard
  commands, primarily tests, phase gates, control packs, generators, and smoke
  commands.
