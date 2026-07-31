# Root Command Classification — Workspace and Registry Guards

**Status:** Active — Phase 0 classification ledger, cohort 3C  
**Captured:** 2026-07-29  
**Parent ledger:** [`ROOT_COMMAND_CLASSIFICATION.md`](../../../platform/ROOT_COMMAND_CLASSIFICATION.md)

## Cohort result

**Reviewed commands:** 25  
**Previously reviewed:** 138  
**Total reviewed:** 163  
**Remaining:** 142

This cohort covers workspace host isolation, plugin/export surfaces, registry
domain generation, and product-neutrality constraints. No command is a removal
candidate.

## Host and plugin boundaries

| Command                               | Primary class | Owner                  | Protection reason                                   |
| ------------------------------------- | ------------- | ---------------------- | --------------------------------------------------- |
| `guard:api-workspace-isolation`       | `LEAF`        | Workspace Architecture | API host-import ratchet and workspace isolation     |
| `guard:api-workspace-settings-import` | `LEAF`        | Workspace Architecture | Focused settings-import boundary                    |
| `guard:host-workspace-deps`           | `LEAF`        | Workspace Architecture | Host dependency classification and orphan detection |
| `guard:plugin-host-neutrality`        | `LEAF`        | Workspace Architecture | Plugin host remains product-neutral                 |
| `guard:no-workspace-type-branches`    | `LEAF`        | Workspace Architecture | Prevents workspace-type branching                   |
| `guard:no-workspace-ids-in-codegen`   | `LEAF`        | Workspace Architecture | Prevents hard-coded workspace IDs in codegen        |

Some active docs describe `guard:api-workspace-settings-import` as an alias for
`guard:api-workspace-isolation`, but the current root commands execute different
guard files. They remain separate leaves until behavioral parity is proven.

## Workspace package surfaces

| Command                             | Primary class | Owner              | Protection reason                         |
| ----------------------------------- | ------------- | ------------------ | ----------------------------------------- |
| `guard:workspace-export-surface`    | `LEAF`        | Workspace Platform | Workspace package export allowlist        |
| `guard:denali-plugin-surface`       | `LEAF`        | Denali Workspace   | Denali plugin symbol allowlist            |
| `guard:urban-plugin-surface`        | `LEAF`        | Urban Workspace    | Urban plugin symbol allowlist             |
| `guard:workspace-master`            | `LEAF`        | Workspace Design   | Required design-language master files     |
| `guard:workspace-plugin-load-cache` | `LEAF`        | Workspace Runtime  | Plugin loader cache and revision contract |

These leaves are called by defensive bundles, Phase I/10 gates, CI, or
workspace documentation. The generic `guard:workspace` family does not make
them redundant because its membership and proof surface differ.

## Registry domain checks

All commands in this section are `LEAF`, owned by **Workspace Registry**.

| Command                                         | Registry domain |
| ----------------------------------------------- | --------------- |
| `guard:workspace-registry-domain-core-registry` | `core-registry` |
| `guard:workspace-registry-domain-dev`           | `dev`           |
| `guard:workspace-registry-domain-exposure`      | `exposure`      |
| `guard:workspace-registry-domain-finance`       | `finance`       |
| `guard:workspace-registry-domain-guest-catalog` | `guest-catalog` |
| `guard:workspace-registry-domain-http`          | `http`          |
| `guard:workspace-registry-domain-integration`   | `integration`   |
| `guard:workspace-registry-domain-member`        | `member`        |
| `guard:workspace-registry-domain-operator`      | `operator`      |
| `guard:workspace-registry-domain-registration`  | `registration`  |
| `guard:workspace-registry-domain-settings-api`  | `settings-api`  |
| `guard:workspace-registry-domain-theme`         | `theme`         |
| `guard:workspace-registry-domain-tour-api`      | `tour-api`      |
| `guard:workspace-registry-domain-wizard-admin`  | `wizard-admin`  |

Eleven of these domain checks are selected dynamically by
`scripts/workspace-onboard.mjs`. The remaining domains are still valid focused
codegen checks and are documented for parallel/local iteration. Zero literal
invocation is not removal proof.

## Consolidation posture

1. Domain checks may eventually be selected through one registry dispatcher,
   but individual domains remain useful for parallel CI and focused failures.
2. Product plugin-surface guards can share implementation mechanics without
   erasing product-specific ownership.
3. `api-workspace-isolation` and `api-workspace-settings-import` require a
   behavioral comparison before either is called an alias.
4. Host, plugin, export, registry, and loader-cache guards enforce distinct
   boundaries and must not be collapsed into one opaque mega-guard.

## Cohort decision

- All 25 names exist in the current root `package.json`.
- No name overlaps earlier cohorts.
- All 25 commands are protected leaves.
- Dynamic onboarding, CI, defensive bundles, and phase-gate consumers are
  represented.
- No command body, workflow, assertion, or product implementation changed.
- The next guard subcohort should cover field exposure, data-access quality,
  and generic platform architecture.
