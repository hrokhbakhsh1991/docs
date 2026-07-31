# Root Command R3 Family Assessment

**Status:** Complete — existing consolidation accepted; no refactor proposed  
**Captured:** 2026-07-29  
**Parent plan:** [`ROOT_COMMAND_REMEDIATION_PLAN.md`](./ROOT_COMMAND_REMEDIATION_PLAN.md)

## Outcome

The family-runner consolidation proposed by R3 already exists in the current
repository. Additional merging would mostly remove small explicit adapters,
not duplicated orchestration.

## Guard families

The four public family commands already share one implementation:

| Public command         | Shared runner                         | Selector         |
| ---------------------- | ------------------------------------- | ---------------- |
| `guard:marketing`      | `scripts/guards/run-guard-family.mjs` | `marketing`      |
| `guard:workspace`      | `scripts/guards/run-guard-family.mjs` | `workspace`      |
| `guard:field-exposure` | `scripts/guards/run-guard-family.mjs` | `field-exposure` |
| `guard:guest`          | `scripts/guards/run-guard-family.mjs` | `guest`          |

The runner preserves:

- ordered execution;
- direct source-path diagnostics;
- inherited environment;
- fail-fast behavior;
- the failing leaf exit code.

The leaf commands remain useful for path-gated CI and diagnosis and therefore
must not be removed merely because the family runner exists.

## Control packs

Admin, marketing, and portal adapters are each 26 lines and already delegate to:

- `scripts/guards/lib/run-control-pack.mjs`;
- a surface-specific step registry;
- the shared `exitCodeForPackResult` policy.

Their `--ci` variants intentionally change exit/reporting semantics. The
adapters preserve explicit surface ownership and stable command names.

`control:authority` is not a duplicate pack. It aggregates the surface results,
computes global `SAFE`/`DEGRADED`/`BLOCKED` state, evaluates critical detector
coverage, and owns cross-surface authority behavior.

## Decision

R3 closes with no code change.

Do not:

- merge the three 26-line adapters into a dynamic root command;
- remove leaf commands consumed by targeted workflows or diagnostics;
- treat local and `--ci` variants as aliases;
- fold `control:authority` into a surface pack.

Reopen R3 only if measured maintenance cost appears in the shared runner or
step registries. Command-count reduction alone is insufficient justification.

## Verification boundary

This assessment is based on current command bodies and runner sources. It
changes no command, workflow, exit code, guard assertion, or product code.
