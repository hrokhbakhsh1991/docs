# Root Command Classification

**Status:** Active — classification ledger (PSR-2c compacted; PSR-3a front doors)  
**Captured:** 2026-07-29  
**Last compacted:** 2026-07-31 (PSR-2c)  
**Last front-door wave:** 2026-07-31 (PSR-3a)  
**Baseline:** [`ROOT_COMMAND_BASELINE.md`](./ROOT_COMMAND_BASELINE.md)  
**Remediation / status:** [`ROOT_COMMAND_REMEDIATION_PLAN.md`](./ROOT_COMMAND_REMEDIATION_PLAN.md)  
**Public front doors:** [`ROOT_COMMAND_FRONT_DOORS.mdoc`](./ROOT_COMMAND_FRONT_DOORS.mdoc)  
**Dynamic evidence (archived):** [`ROOT_COMMAND_DYNAMIC_CONSUMERS.md`](../archive/psr-001/root-command/ROOT_COMMAND_DYNAMIC_CONSUMERS.md)

## Active surface (≤3 artifacts)

| Artifact | Role |
| --- | --- |
| [`ROOT_COMMAND_BASELINE.md`](./ROOT_COMMAND_BASELINE.md) | Metric baseline / growth freeze |
| [`ROOT_COMMAND_CLASSIFICATION.md`](./ROOT_COMMAND_CLASSIFICATION.md) | This ledger — machine-oriented cohort state |
| [`ROOT_COMMAND_REMEDIATION_PLAN.md`](./ROOT_COMMAND_REMEDIATION_PLAN.md) | Remediation + status decisions |

Detailed cohort worksheets live under
[`docs/archive/psr-001/root-command/`](../archive/psr-001/root-command/) and are
**not** active authority.

### Archived cohort worksheets

| File | Topic |
| --- | --- |
| `ROOT_COMMAND_CLASSIFICATION_GUARDS_A.md` … `_E.md` + erratum | Guard cohorts |
| `ROOT_COMMAND_CLASSIFICATION_OPS.md` | Ops commands |
| `ROOT_COMMAND_CLASSIFICATION_PHASE_GATES.md` | Phase gates |
| `ROOT_COMMAND_CLASSIFICATION_TESTS_TOOLS.md` | Tests/tools |
| `ROOT_COMMAND_CLASSIFICATION_CONTROL_SMOKE.md` | Control smoke |
| `ROOT_COMMAND_CLASSIFICATION_FINAL_TOOLS.md` | Final tools |
| `ROOT_COMMAND_R2_ALIAS_READINESS.md` | Alias readiness |
| `ROOT_COMMAND_R3_FAMILY_ASSESSMENT.md` | Family runners |
| `ROOT_COMMAND_R4_CI_ASSESSMENT.md` | CI assessment |
| `ROOT_COMMAND_DYNAMIC_CONSUMERS.md` | Dynamic consumers |

## Classification policy

Commands are classified in reviewed cohorts. Every row is checked against the
current root `package.json`; missing names and duplicate primary assignments
block a cohort from being accepted.

Owners describe responsibility for the command contract, not exclusive
ownership of every implementation invoked by it.

## Cohort 1 — public core and compatibility surface

**Reviewed commands:** 39  
**Remaining commands:** 266

### Canonical commands

| Command                       | Primary class | Owner                | Contract                               |
| ----------------------------- | ------------- | -------------------- | -------------------------------------- |
| `dev`                         | `CANONICAL`   | Developer Experience | Surface picker (usage printer; exit 1) |
| `build`                       | `CANONICAL`   | Platform Build       | Monorepo build entry                   |
| `test`                        | `CANONICAL`   | Platform Quality     | Root test aggregation                  |
| `lint`                        | `CANONICAL`   | Platform Quality     | Root lint aggregation                  |
| `typecheck`                   | `CANONICAL`   | Platform Quality     | Alias of `lint` (tsc --noEmit path)    |
| `verify:fast`                 | `CANONICAL`   | Platform Quality     | Daily invariant loop                   |
| `verify:product`              | `CANONICAL`   | Platform Quality     | Product/workspace static bundle        |
| `verify:full`                 | `CANONICAL`   | Platform Quality     | Explicit heavy verification            |
| `release:verify`              | `CANONICAL`   | Platform Quality     | Release static bar → `verify:product`  |
| `pre-commit:fast`             | `CANONICAL`   | Developer Experience | Husky fast path                        |
| `test:phase-0`                | `CANONICAL`   | Workspace SDK        | Foundation contract suite              |
| `doc-gate`                    | `CANONICAL`   | Documentation        | Full docs-as-code gate                 |
| `guard:doc-sync`              | `CANONICAL`   | Documentation        | Documentation synchronization guard    |
| `ci:integrity`                | `CANONICAL`   | Platform CI          | Heavy CI integrity chain               |
| `generate`                    | `CANONICAL`   | Workspace Platform   | Front door → `generate:workspace-registry` |
| `generate:workspace-registry` | `CANONICAL`   | Workspace Platform   | Registry code generation               |
| `workspace:create`            | `CANONICAL`   | Workspace Platform   | Scaffold `packages/workspaces/<id>`    |
| `workspace:onboard`           | `CANONICAL`   | Workspace Platform   | Post-scaffold onboarding orchestration |
| `db:migrate`                  | `CANONICAL`   | Platform Data        | Front door → `db:migrate:deploy` (**DB mutate**) |

### Family entry points

| Command                | Primary class | Owner                 | Contract                        |
| ---------------------- | ------------- | --------------------- | ------------------------------- |
| `guard:marketing`      | `FAMILY`      | Marketing Surface     | Full marketing guard family     |
| `guard:workspace`      | `FAMILY`      | Workspace Platform    | Workspace contract guard family |
| `guard:field-exposure` | `FAMILY`      | Platform Architecture | Field-exposure guard family     |
| `guard:guest`          | `FAMILY`      | Guest Platform        | Guest-surface guard family      |

### Lifecycle commands

| Command     | Primary class | Owner                | Trigger                        |
| ----------- | ------------- | -------------------- | ------------------------------ |
| `prepare`   | `LIFECYCLE`   | Developer Experience | pnpm package/install lifecycle |
| `postbuild` | `LIFECYCLE`   | Platform Build       | Automatic root post-build hook |

### Compatibility aliases

| Command                    | Primary class  | Owner               | Canonical target                   | Risk note                            |
| -------------------------- | -------------- | ------------------- | ---------------------------------- | ------------------------------------ |
| `guard:documentation-sync` | `COMPAT_ALIAS` | Documentation       | `guard:doc-sync`                   | Active docs still reference old name |
| `phase-3:doc-scaffold`     | `COMPAT_ALIAS` | Documentation       | `doc-gate`                         | First migration pilot                |
| `test:contract`            | `COMPAT_ALIAS` | Workspace SDK       | `test:phase-0`                     | Historical contract terminology      |
| `phase-0:covenant-gate`    | `COMPAT_ALIAS` | Platform Foundation | `test:phase-0`                     | Domain terminology in phase docs     |
| `phase-0:trunk-gate`       | `COMPAT_ALIAS` | Platform Foundation | `phase-0:integration-gate`         | Domain terminology in phase docs     |

### Removed in PSR-3a (comment markers only)

| Former command             | Replacement        | Proof |
| -------------------------- | ------------------ | --- |
| `test:contract:foundation` | `test:phase-0`     | Zero CI/workflow refs; `//test:contract:foundation` retained |
| `contract:test`            | `test:phase-0`     | Zero CI/workflow refs; `//contract:test` retained |

### CI compatibility contract

| Command                   | Primary class | Owner                  | Canonical target | Constraint                              |
| ------------------------- | ------------- | ---------------------- | ---------------- | --------------------------------------- |
| `phase-0:foundation-gate` | `CI_ONLY`     | Platform Foundation CI | `test:phase-0`   | Workflow migration must precede removal |

### Protected leaf commands

| Command                            | Primary class | Owner                 | Protection reason                          |
| ---------------------------------- | ------------- | --------------------- | ------------------------------------------ |
| `guard:architecture`               | `LEAF`        | Platform Architecture | Direct CI and composite-gate consumer      |
| `guard:import-boundary`            | `LEAF`        | Platform Architecture | CI, verify, phase guards, and web prebuild |
| `guard:artifact-surface`           | `LEAF`        | Platform Build        | `postbuild` lifecycle target               |
| `check:node-engine`                | `LEAF`        | Developer Experience  | Verify and CI environment invariant        |
| `audit-boundary`                   | `LEAF`        | Design System         | Doc-Gate, phase gates, and web prebuild    |
| `guard:workspace-registry-fresh`   | `LEAF`        | Workspace Platform    | Verify and onboarding consumer             |
| `guard:workspace-manifests`        | `LEAF`        | Workspace Platform    | Product verification and phase integration |
| `guard:workspace-onboard-contract` | `LEAF`        | Workspace Platform    | Dynamic onboarding consumer                |
| `guard:workspace-plugin-surface`   | `LEAF`        | Workspace Platform    | Product verification and onboarding        |
| `guard:workspace-peer-import`      | `LEAF`        | Workspace Platform    | Product verification and onboarding        |
| `guard:guest-plugin-conformance`   | `LEAF`        | Guest Platform        | Guest onboarding and CI conformance        |
| `guard:workspace-certification`    | `LEAF`        | Workspace Platform    | Guest onboarding and CI certification      |

## Root versus package-local correction

`guard:no-raw-wizard-input` is not a root command. It belongs to
`apps/web/package.json` and is invoked from the web prebuild working directory.
It is therefore excluded from the 305-command root inventory. This correction
supersedes any interpretation of the web-prebuild evidence that treats it as a
root leaf.

## Cohort decision

- Cohort 1 names that remain executable exist in the current root `package.json`.
- PSR-3a added public front doors and removed two docs-only exact aliases
  (`contract:test`, `test:contract:foundation`) with zero workflow callers.
- No name has more than one primary classification in this cohort.
- Required CI check names and `verify:fast` / `verify:product` / `verify:full`
  / adversarial authorities were not merged.
- Next implementation wave: **PSR-3b** family runners / workflow reuse (required
  names frozen). Further alias expiry remains **PSR-3c**.
