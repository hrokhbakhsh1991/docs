# Root Command Classification — Control and Smoke

**Status:** Active — Phase 0 classification ledger, cohort 5  
**Captured:** 2026-07-29  
**Parent ledger:** [`ROOT_COMMAND_CLASSIFICATION.md`](./ROOT_COMMAND_CLASSIFICATION.md)

## Cohort result

**Reviewed commands:** 17  
**Previously reviewed:** 224  
**Total reviewed:** 241  
**Remaining:** 64

This cohort covers control packs, targeted smoke entry points, and three
specialized audit/crawl/documentation tools. No command is a removal candidate.

## Control packs

| Command                | Primary class | Owner                | Contract                               |
| ---------------------- | ------------- | -------------------- | -------------------------------------- |
| `admin:control`        | `COMPOSITE`   | Admin Surface        | Six-step admin control pack            |
| `admin:control:ci`     | `CI_ONLY`     | Admin Surface CI     | Admin pack with CI semantics           |
| `marketing:control`    | `COMPOSITE`   | Marketing Surface    | Twenty-one-step marketing control pack |
| `marketing:control:ci` | `CI_ONLY`     | Marketing Surface CI | Marketing pack with CI semantics       |
| `portal:control`       | `COMPOSITE`   | Portal Surface       | Five-step portal control pack          |
| `portal:control:ci`    | `CI_ONLY`     | Portal Surface CI    | Portal pack with CI semantics          |
| `control:authority`    | `COMPOSITE`   | Platform Control     | Cross-pack global authority decision   |
| `control:ci`           | `CI_ONLY`     | Platform Control CI  | CI authority and report behavior       |

The `:ci` variants are not compatibility aliases. They enable different exit
and reporting behavior. `control:ci` is invoked by three workflows; this is a
future reusable-workflow/consolidation opportunity, not proof that two calls
can be deleted.

## Smoke entry points

All commands in this section are `LEAF`. They remain independently runnable
because their environment, feature mode, and failure diagnostics differ.

| Command                                        | Owner                    | Contract                         |
| ---------------------------------------------- | ------------------------ | -------------------------------- |
| `smoke:denali-draft-unification`               | Denali Wizard            | Host-integrated draft smoke      |
| `smoke:denali-draft-unification:on`            | Denali Wizard            | Host-integrated feature-on smoke |
| `smoke:denali-draft-unification:standalone`    | Denali Wizard            | Standalone draft smoke           |
| `smoke:denali-draft-unification:standalone:on` | Denali Wizard            | Standalone feature-on smoke      |
| `smoke:pcms-custom-apex`                       | Member Session Authority | Custom-apex member-session smoke |
| `smoke:wrs-custom-apex`                        | Tenant Routing           | Custom-apex routing/tenant smoke |

The four Denali draft commands form a mode matrix, not four aliases. Any future
parameterized dispatcher must preserve all four combinations and compatibility
names for a migration window.

## Specialized tools

| Command                        | Primary class | Owner                      | Safety note                      |
| ------------------------------ | ------------- | -------------------------- | -------------------------------- |
| `audit:findmany-scan`          | `LEAF`        | API Data Quality           | Defensive bundle consumer        |
| `crawl:marketing-sitemap`      | `OPS_ONLY`    | Marketing Operations       | Requires a target host           |
| `docs:check-architecture-sync` | `LEAF`        | Documentation Architecture | Architecture-doc synchronization |

## Consolidation posture

1. Control packs may share one runner implementation while retaining distinct
   owners and CI semantics.
2. `control:ci` workflow duplication requires a check-name and coverage review.
3. Smoke mode matrices are good dispatcher candidates only after argument and
   environment parity tests exist.
4. Host-dependent crawl/smoke commands must not be classified from local usage
   counts alone.

## Cohort decision

- All 17 names exist in the current root `package.json`.
- No name overlaps earlier cohorts.
- Four composite, four CI-only, six leaf smoke, two leaf tool, and one
  operations command are classified.
- Workflow, defensive-bundle, runbook, and phase-gate consumers are protected.
- No command body, workflow, assertion, or product implementation changed.
- The remaining 64 commands are predominantly phase/release gates and their
  fast-track/closure helpers.
