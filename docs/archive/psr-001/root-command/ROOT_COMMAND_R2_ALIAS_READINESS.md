# Root Command R2 Alias Readiness

**Status:** Read-only analysis complete; execution blocked by workspace patch
infrastructure  
**Captured:** 2026-07-29  
**Parent plan:** [`ROOT_COMMAND_REMEDIATION_PLAN.md`](../../../platform/ROOT_COMMAND_REMEDIATION_PLAN.md)

## Decision

After the R1 documentation-alias pilot, the safest root-only candidates are:

1. `contract:test`;
2. root `test:contract:foundation`.

Neither root command has an active invocation outside its definition,
deprecation metadata, and ownership documentation.

## Candidate matrix

| Root command               | Resolves to                      | Active root invocation | Decision                                     |
| -------------------------- | -------------------------------- | ---------------------: | -------------------------------------------- |
| `contract:test`            | `test:contract` → `test:phase-0` |                      0 | Next candidate after R1                      |
| `test:contract:foundation` | `test:phase-0`                   |                      0 | Candidate, root scope only                   |
| `guard:documentation-sync` | `guard:doc-sync`                 |                     1+ | Retain; assertion/docs migration required    |
| `test:contract`            | `test:phase-0`                   |               Multiple | Retain; active phase/docs/assertion contract |
| `phase-0:covenant-gate`    | `test:phase-0`                   |               Multiple | Retain; operational terminology active       |
| `phase-0:trunk-gate`       | `phase-0:integration-gate`       |               Multiple | Retain; branch-protection evidence active    |
| `phase-0:foundation-gate`  | `test:phase-0`                   |     CI + guards + docs | Retain; protected CI contract                |

## Package-local boundary

`packages/workspace-sdk/package.json` independently defines:

- `test:contract`;
- `test:contract:foundation`.

Removing a root alias does not authorize removal or renaming of the
package-local command. Validation must address root and filtered package
execution separately.

## Required execution sequence

For each candidate:

1. reconfirm zero active root invocations;
2. record the start and end of a compatibility window;
3. retain the alias during that window;
4. run the canonical target and the alias and compare exit behavior;
5. obtain explicit removal approval;
6. remove only the root script and its adjacent `//...` metadata key;
7. rerun the 305-command inventory with the expected count adjusted;
8. run Doc-Gate, architecture, import-boundary, and the Phase 0 contract suite;
9. leave package-local scripts unchanged.

## Non-candidates

Static reference counts alone must not demote the retained aliases. In
particular, `phase-0:foundation-gate` is invoked by
`.github/workflows/phase-0-gate.yml` and participates in guard configuration
and branch-protection evidence. It requires a separate high-risk CI migration,
not alias cleanup.
