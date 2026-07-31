# Root Command Classification

**Status:** Active — Phase 0 classification ledger  
**Captured:** 2026-07-29  
**Baseline:** [`ROOT_COMMAND_BASELINE.md`](./ROOT_COMMAND_BASELINE.md)  
**Dynamic evidence:** [`ROOT_COMMAND_DYNAMIC_CONSUMERS.md`](./ROOT_COMMAND_DYNAMIC_CONSUMERS.md)

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
| `build`                       | `CANONICAL`   | Platform Build       | Monorepo build entry                   |
| `test`                        | `CANONICAL`   | Platform Quality     | Root test aggregation                  |
| `lint`                        | `CANONICAL`   | Platform Quality     | Root lint aggregation                  |
| `verify:fast`                 | `CANONICAL`   | Platform Quality     | Daily invariant loop                   |
| `verify:product`              | `CANONICAL`   | Platform Quality     | Product/workspace static bundle        |
| `verify:full`                 | `CANONICAL`   | Platform Quality     | Explicit heavy verification            |
| `pre-commit:fast`             | `CANONICAL`   | Developer Experience | Husky fast path                        |
| `test:phase-0`                | `CANONICAL`   | Workspace SDK        | Foundation contract suite              |
| `doc-gate`                    | `CANONICAL`   | Documentation        | Full docs-as-code gate                 |
| `guard:doc-sync`              | `CANONICAL`   | Documentation        | Documentation synchronization guard    |
| `ci:integrity`                | `CANONICAL`   | Platform CI          | Heavy CI integrity chain               |
| `generate:workspace-registry` | `CANONICAL`   | Workspace Platform   | Registry code generation               |
| `workspace:onboard`           | `CANONICAL`   | Workspace Platform   | Post-scaffold onboarding orchestration |

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
| `test:contract:foundation` | `COMPAT_ALIAS` | Workspace SDK       | `test:phase-0`                     | No known active execution reference  |
| `contract:test`            | `COMPAT_ALIAS` | Workspace SDK       | `test:phase-0` via `test:contract` | Wrapper chain; migration candidate   |
| `phase-0:covenant-gate`    | `COMPAT_ALIAS` | Platform Foundation | `test:phase-0`                     | Domain terminology in phase docs     |
| `phase-0:trunk-gate`       | `COMPAT_ALIAS` | Platform Foundation | `phase-0:integration-gate`         | Domain terminology in phase docs     |

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

- All 39 names exist in the current root `package.json`.
- No name has more than one primary classification in this cohort.
- No command body, workflow, hook, or product implementation changed.
- No row is a removal approval.
- The next cohort should classify operations and environment commands before
  historical phase commands, because low textual usage is expected for manual
  operations.
