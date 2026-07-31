# Root Command Classification — Final Tools

**Status:** Active — Phase 0 classification ledger, cohort 6  
**Captured:** 2026-07-29  
**Parent ledger:** [`ROOT_COMMAND_CLASSIFICATION.md`](../../../platform/ROOT_COMMAND_CLASSIFICATION.md)

## Cohort result

**Reviewed commands:** 5  
**Previously reviewed:** 241  
**Total reviewed:** 246  
**Remaining:** 59

This cohort closes the non-phase remainder: one CI bootstrap, one documentation
validator, two local closure bundles, and one intake guard. No command is a
removal candidate.

## Classification

| Command                          | Primary class | Owner                   | Contract                                   |
| -------------------------------- | ------------- | ----------------------- | ------------------------------------------ |
| `build:workspace-sdk-for-guards` | `CI_ONLY`     | Workspace Platform CI   | Fresh-checkout SDK bootstrap before guards |
| `doc:markdoc:validate`           | `LEAF`        | Documentation           | Targeted Markdoc source validation         |
| `gap-closure:exit-local`         | `COMPOSITE`   | Platform Closure        | Local closure evidence bundle              |
| `gap-closure:exit-local:full`    | `COMPOSITE`   | Platform Closure        | Expanded local closure bundle              |
| `guard-intake-plugin-registry`   | `LEAF`        | Workspace Plugin Intake | Plugin-registry intake invariant           |

## Decisions

- The two gap-closure commands are not aliases: `:full` passes a behavior-changing
  option and must remain distinct until parity is modeled and tested.
- `build:workspace-sdk-for-guards` is protected as a fresh-checkout/CI bootstrap,
  even if it has little local interactive usage.
- `guard-intake-plugin-registry` uses a legacy naming shape without `guard:`.
  Naming inconsistency alone is not removal proof.
- `doc:markdoc:validate` is a useful targeted diagnostic beneath the broader
  documentation gate.

## Cohort decision

- All five names exist in the current root `package.json`.
- No name overlaps the first 241 classified executable commands.
- No command body, workflow, hook, or product implementation changed.
- The remaining 59 commands are phase, product-gate, closure, or release
  orchestration commands.
