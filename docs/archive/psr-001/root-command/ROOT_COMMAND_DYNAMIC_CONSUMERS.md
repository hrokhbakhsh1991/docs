# Root Command Dynamic Consumer Register

**Status:** Active — Phase 0 evidence  
**Captured:** 2026-07-29  
**Parent baseline:** [`ROOT_COMMAND_BASELINE.md`](../../../platform/ROOT_COMMAND_BASELINE.md)

## Purpose

This register supplements textual command-reference counts. A root command
listed here must not be considered unused merely because a search finds no
literal `pnpm run <name>` invocation.

## Root lifecycle hooks

| Command     | Trigger                          | Classification |
| ----------- | -------------------------------- | -------------- |
| `prepare`   | pnpm install/package lifecycle   | `LIFECYCLE`    |
| `postbuild` | automatically after root `build` | `LIFECYCLE`    |

Both are live without explicit `pnpm run` references.

## Workspace onboarding

`scripts/workspace-onboard.mjs` builds command strings dynamically. Its
protected root commands are:

- `workspace:create`;
- `generate:workspace-registry`;
- `guard:workspace-registry-domain-core-registry`;
- `guard:workspace-registry-domain-tour-api`;
- `guard:workspace-registry-domain-wizard-admin`;
- `guard:workspace-registry-domain-theme`;
- `guard:workspace-registry-domain-guest-catalog`;
- `guard:workspace-registry-domain-registration`;
- `guard:workspace-registry-domain-member`;
- `guard:workspace-registry-domain-http`;
- `guard:workspace-registry-domain-settings-api`;
- `guard:workspace-registry-domain-dev`;
- `guard:workspace-registry-domain-operator`;
- `guard:workspace-registry-fresh`;
- `guard:workspace-onboard-contract`;
- `guard:workspace-plugin-surface`;
- `guard:workspace-peer-import`;
- `guard:guest-plugin-conformance` for guest onboarding;
- `guard:workspace-certification` for guest onboarding.

The workspace `build` and `test` steps use package filters. They are not
additional root-command consumers.

## Web prebuild

`apps/web/scripts/run-prebuild-guards.mjs` selects root commands from an array
and invokes them using `pnpm run <script>`:

- `guard:import-boundary`;
- `audit-boundary`;
- `guard:no-raw-wizard-input`.

## File-oriented family runners

| Root family            | Direct guard files |
| ---------------------- | -----------------: |
| `guard:marketing`      |                 23 |
| `guard:workspace`      |                  9 |
| `guard:field-exposure` |                 12 |
| `guard:guest`          |                 12 |

These families invoke guard files directly rather than invoking their leaf root
aliases. Family membership proves that the implementation is live. It does not
prove every corresponding root leaf alias must remain public: leaf alias
removal still requires CI, path-gating, documentation, and diagnostic parity
review.

## Package-local exclusion

Dynamic `pnpm run <step>` calls whose working directory is an application or
package are package-local consumers. They must be evaluated against that
package's `package.json`, not counted as root-command references.

This distinction prevents false retention of a root command merely because a
package happens to use the same script name.

## Phase 0 conclusion

The known root lifecycle and dynamic consumers are now represented. This
register is protection evidence, not a removal-candidate list. New dynamic
command construction must be added here or to a successor machine-readable
inventory before command-surface review.
