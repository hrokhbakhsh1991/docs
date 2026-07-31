# Root Command Classification — Field and Data Guards

**Status:** Active — Phase 0 classification ledger, cohort 3D  
**Captured:** 2026-07-29  
**Parent ledger:** [`ROOT_COMMAND_CLASSIFICATION.md`](./ROOT_COMMAND_CLASSIFICATION.md)

## Cohort result

**Reviewed commands:** 19  
**Previously reviewed:** 163  
**Total reviewed:** 182  
**Remaining:** 123

This cohort covers field-exposure evolution and API data-access quality. No
command is a removal candidate.

## Field exposure

All phase leaves are owned by **Field Exposure Architecture** and classified
`LEAF`.

| Command                         | Primary class | Protection reason                          |
| ------------------------------- | ------------- | ------------------------------------------ |
| `guard:field-exposure-phase-0`  | `LEAF`        | Path-gated pre-commit and family runner    |
| `guard:field-exposure-phase-1`  | `LEAF`        | Path-gated pre-commit and family runner    |
| `guard:field-exposure-phase-2`  | `LEAF`        | Path-gated pre-commit and family runner    |
| `guard:field-exposure-phase-3`  | `LEAF`        | Path-gated pre-commit and family runner    |
| `guard:field-exposure-phase-4`  | `LEAF`        | Path-gated pre-commit and family runner    |
| `guard:field-exposure-phase-5`  | `LEAF`        | Path-gated pre-commit and family runner    |
| `guard:field-exposure-phase-6`  | `LEAF`        | Path-gated pre-commit and family runner    |
| `guard:field-exposure-phase-7`  | `LEAF`        | Path-gated pre-commit and family runner    |
| `guard:field-exposure-phase-8`  | `LEAF`        | Path-gated pre-commit and family runner    |
| `guard:field-exposure-phase-9`  | `LEAF`        | Path-gated pre-commit and family runner    |
| `guard:field-exposure-phase-10` | `LEAF`        | Path-gated pre-commit and family runner    |
| `guard:field-exposure-phase-11` | `LEAF`        | Path-gated pre-commit and family runner    |
| `guard:field-policy-boundary`   | `LEAF`        | Defensive guard bundle and policy boundary |

The `guard:field-exposure` family invokes the twelve implementation files
directly. The individual root entries remain a public diagnostic surface until
path-gated usage and phase-specific documentation are migrated.

## Data-access quality

All commands in this section are `LEAF`, owned by **API Data Quality**.

| Command                         | Protection reason                          |
| ------------------------------- | ------------------------------------------ |
| `guard:catch-error-leak`        | Direct Phase 6 CI and defensive bundle     |
| `guard:list-projection-openapi` | List projection and OpenAPI consistency    |
| `guard:repository-n-plus-one`   | Repository query-shape budget              |
| `guard:repository-rls`          | Repository tenant/RLS boundary             |
| `guard:service-n-plus-one`      | Service-layer fan-out budget               |
| `guard:unbounded-list`          | Pagination and unbounded-query prohibition |

These guards protect distinct failure modes. Similar implementation mechanics
do not make them aliases.

## Consolidation posture

1. Field phase leaves may eventually use one parameterized runner, but named
   phase entry points require a compatibility map.
2. The family runner cannot replace the path-gated pre-commit behavior without
   runtime and failure-parity evidence.
3. Data-quality leaves should remain independently runnable even if a defensive
   bundle becomes the preferred discovery entry.
4. CI consumers must migrate before any leaf entry point is retired.

## Cohort decision

- All 19 names exist in the current root `package.json`.
- No name overlaps earlier cohorts.
- All 19 commands are protected leaves.
- Pre-commit, family-runner, defensive-bundle, and CI consumers are represented.
- No command body, workflow, assertion, or product implementation changed.
- The final guard subcohort should cover platform architecture, design-system,
  release-boundary, and governance guards.
