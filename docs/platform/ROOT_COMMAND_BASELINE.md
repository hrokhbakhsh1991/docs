# Root Command Surface Baseline

**Status:** Active — Phase 0 baseline and growth freeze  
**Captured:** 2026-07-29  
**Initiative:** Platform Simplification  
**Scope:** Root `package.json` command surface only  
**Authority:** Complements [`COMMAND_OWNERSHIP_MAP.md`](./COMMAND_OWNERSHIP_MAP.md)

## Purpose

This is the current baseline before alias removal, CI retargeting, phase-gate
flattening, or runner consolidation. Phase 0 changes no command behavior, CI
workflow, required-check name, or product code.

## Current baseline

| Metric                                         | Current |
| ---------------------------------------------- | ------: |
| Root `scripts` entries                         |     311 |
| Executable root commands                       |     305 |
| Deprecation comment keys (`//...`)             |       6 |
| `guard:*` commands, including `audit-boundary` |     117 |
| Phase/release commands (`phase-*`, `pN:*`)     |     106 |
| Test commands                                  |      21 |
| Smoke commands                                 |       6 |
| Ops/deploy/seed/database/infra commands        |      13 |
| Verify/control/CI commands                     |       7 |
| Generate/workspace commands                    |       6 |
| Other commands                                 |      29 |
| Exact one-command wrappers                     |       9 |
| GitHub Actions workflows                       |      27 |
| Top-level shell scripts under `scripts/`       |     112 |
| Direct guard files under `scripts/guards/`     |     165 |

Guard and phase/release commands are 223 of 305 executable entries (about
73%). The primary problem is lifecycle and discoverability, not merely
duplicate bodies.

## Previous-baseline drift

`TEMP/PLATFORM_SIMPLIFICATION_BASELINE.md` recorded 297 root scripts and 26
workflows. It remains historical evidence, not current authority. Its explicit
text-reference model can produce unsafe removal candidates because it misses:

- pnpm lifecycle hooks such as `prepare` and `postbuild`;
- dynamically constructed workspace-onboarding commands;
- family runners that invoke files rather than root command names;
- manual operations and production runbook entry points;
- leaf commands retained for path-gated CI or diagnosis.

Zero direct textual references is therefore a discovery signal, not removal
proof.

## Primary command classes

Every executable root command must ultimately receive one primary class.

| Class               | Meaning                                            | Removal posture                     |
| ------------------- | -------------------------------------------------- | ----------------------------------- |
| `CANONICAL`         | Supported public developer entry point             | Keep                                |
| `FAMILY`            | Public command-family orchestrator                 | Keep                                |
| `LEAF`              | Targeted CI, path-gated, or diagnostic entry       | Keep until parity is proven         |
| `COMPOSITE`         | Intentional multi-step proof bundle                | Keep while proof is active          |
| `LIFECYCLE`         | Invoked implicitly by pnpm/npm                     | Keep unless deliberately redesigned |
| `DYNAMIC`           | Constructed or selected programmatically           | Keep until callers are modelled     |
| `CI_ONLY`           | Workflow or required-check contract                | Keep until CI/protection migrate    |
| `OPS_ONLY`          | Manual staging, production, DB, or infra operation | Review through runbooks             |
| `COMPAT_ALIAS`      | Old name with a canonical replacement              | Migrate, then retain for one window |
| `HISTORICAL`        | Inactive phase evidence                            | Archive only after approval         |
| `REMOVAL_CANDIDATE` | Every removal gate has passed                      | Eligible for explicit approval      |

## Known exact wrappers

| Wrapper                    | Target                     | Current class                      |
| -------------------------- | -------------------------- | ---------------------------------- |
| `postbuild`                | `guard:artifact-surface`   | `LIFECYCLE`                        |
| `guard:documentation-sync` | `guard:doc-sync`           | `COMPAT_ALIAS`                     |
| `phase-3:doc-scaffold`     | `doc-gate`                 | `COMPAT_ALIAS`                     |
| `test:contract`            | `test:phase-0`             | `COMPAT_ALIAS`                     |
| `test:contract:foundation` | `test:phase-0`             | `COMPAT_ALIAS`                     |
| `contract:test`            | `test:contract`            | `COMPAT_ALIAS`; wrapper chain      |
| `phase-0:covenant-gate`    | `test:phase-0`             | `COMPAT_ALIAS`; domain terminology |
| `phase-0:trunk-gate`       | `phase-0:integration-gate` | `COMPAT_ALIAS`; domain terminology |
| `phase-0:foundation-gate`  | `test:phase-0`             | `CI_ONLY` compatibility contract   |

This is not a deletion list. `postbuild` is implicit and
`phase-0:foundation-gate` is still a CI contract.

## Growth freeze

Until Phase 1 command architecture is approved, a new root command should be
added only when the same change records:

1. primary class and owner;
2. intended consumers;
3. why an existing canonical/family command is insufficient;
4. permanent status or expiry condition;
5. CI and required-check implications.

New compatibility aliases and wrapper chains are frozen unless an explicit
compatibility reason and removal gate are added to the ownership map. This is a
governance freeze, not yet an automated failing guard.

## Removal proof

A command becomes `REMOVAL_CANDIDATE` only after:

1. a replacement exists or the capability is explicitly retired;
2. static references in code, scripts, workflows, hooks, and active docs are zero;
3. lifecycle and dynamic invocation are ruled out;
4. manual operations and runbooks are reviewed;
5. required-check and branch-protection impact is ruled out;
6. the compatibility window has elapsed;
7. rollback and architecture approval are recorded.

## First migration pilot

```text
phase-3:doc-scaffold -> doc-gate
```

It is behavior-identical, absent from CI, has one active execution example in
`AGENTS.md`, and is already deprecated in the ownership map. Removal remains
deferred until consumer migration and the compatibility window complete.

## Phase 0 exit checklist

- [x] Current aggregate baseline captured in tracked documentation.
- [x] Stale local baseline demoted from current authority.
- [x] Unsafe zero-reference inference documented.
- [x] Command taxonomy, growth freeze, and removal proof defined.
- [ ] All 305 executable commands assigned a class and owner.
- [ ] Dynamic and lifecycle consumers represented in the inventory.
- [ ] Active versus historical phase/release commands reviewed by owners.
- [ ] Inventory approved before pilot migration.

Phase 0 remains open until the unchecked items are complete.
