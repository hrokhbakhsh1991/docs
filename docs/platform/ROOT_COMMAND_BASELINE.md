# Root Command Surface Baseline

**Status:** Active — Phase 0 baseline and growth freeze  
**Captured:** 2026-07-29  
**Last compacted:** 2026-07-31 (PSR-2c)  
**Last front-door wave:** 2026-07-31 (PSR-3a)  
**Initiative:** Platform Simplification  
**Scope:** Root `package.json` command surface only  
**Authority:** Complements [`COMMAND_OWNERSHIP_MAP.md`](./COMMAND_OWNERSHIP_MAP.md)  
**Active analysis trio:** baseline · [`CLASSIFICATION`](./ROOT_COMMAND_CLASSIFICATION.md) · [`REMEDIATION_PLAN`](./ROOT_COMMAND_REMEDIATION_PLAN.md)  
**Public front doors:** [`ROOT_COMMAND_FRONT_DOORS.mdoc`](./ROOT_COMMAND_FRONT_DOORS.mdoc) + [`.yaml`](./ROOT_COMMAND_FRONT_DOORS.yaml)

## Purpose

This is the living baseline for root command growth. Classification worksheets
remain three active analysis artifacts. PSR-3a adds a separate **public front
door** contract without merging `verify:*` tiers or renaming required CI checks.

## Current baseline (post PSR-3a)

| Metric                                         | Current |
| ---------------------------------------------- | ------: |
| Root `scripts` entries                         |     316 |
| Executable root commands                       |     310 |
| Deprecation comment keys (`//...`)             |       6 |
| Public front doors (discoverable)              |      12 |
| `guard:*` commands, including `audit-boundary` |     117 |
| Phase/release commands (`phase-*`, `pN:*`)     |     106 |
| Test commands                                  |      19 |
| Smoke commands                                 |       6 |
| Ops/deploy/seed/database/infra commands        |      14 |
| Verify/control/CI commands                     |       8 |
| Generate/workspace commands                    |       7 |
| Other commands                                 |      31 |
| Exact one-command wrappers                     |       7 |
| GitHub Actions workflows                       |      27 |
| Top-level shell scripts under `scripts/`       |     112 |
| Direct guard files under `scripts/guards/`     |     165 |

### PSR-3a delta vs HEAD `c2e63013`

| Change | Names |
| --- | --- |
| Added (`CANONICAL` front doors) | `dev`, `typecheck`, `generate`, `db:migrate`, `release:verify` |
| Removed (docs-only deprecated aliases) | `contract:test`, `test:contract:foundation` |
| Net executable | **+3** |

`db:migrate` is a **database side-effect** front door (alias of
`db:migrate:deploy`). `release:verify` points at `verify:product` only — not
`verify:full`, adversarial, or live smoke.

Guard and phase/release commands remain the majority of the executable surface.
The primary problem is still lifecycle and discoverability, not merely
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
