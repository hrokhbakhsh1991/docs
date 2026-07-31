# Root Command R4 CI Assessment

**Status:** Analysis complete — migration expansion requires parity evidence  
**Captured:** 2026-07-29  
**Parent plan:** [`ROOT_COMMAND_REMEDIATION_PLAN.md`](../../../platform/ROOT_COMMAND_REMEDIATION_PLAN.md)  
**Existing design:** [`CI_COMPOSITE_SETUP.md`](./CI_COMPOSITE_SETUP.md)

## Current state

The existing design document reports Stage A only, but repository state has
advanced beyond it:

- `.github/actions/setup-platform/action.yml` exists;
- `finance-integrity.yml` uses it in both jobs;
- `api-nightly.yml`, `doc-gate.yml`, `phase-2-gate.yml`, and
  `phase-3-gate.yml` also use it.

This is documentation drift. It does not prove that before/after Actions-run
parity was recorded for every migration.

## Composite contract

The current composite owns:

- pnpm setup;
- Node setup from `.nvmrc` or an explicit version;
- optional pnpm cache;
- optional Node-engine verification;
- optional frozen-lockfile installation.

Checkout, permissions, business steps, artifacts, and job names remain with the
caller. This separation matches the intended safety boundary.

## Remaining direct full-stack workflows

Eighteen workflows still contain all three direct setup elements:

- `pnpm/action-setup@v4`;
- `actions/setup-node@v4`;
- `pnpm install --frozen-lockfile`.

This count is a discovery metric, not a migration target. The set includes
required checks, multi-job phase gates, retired/compatibility finance
workflows, database gates, and monthly operations.

## Required deferrals

Do not use as the next pilot:

- `phase-0-gate.yml`;
- `phase-1-gate.yml`;
- `booking-postgres-gate.yml`;
- deploy, remote-staging, PR-creation, or restore-drill workflows;
- legacy finance workflows retained for rollback/compatibility.

The first three participate in explicit main-branch required-check contracts.

## Recommended next pilot

**Workflow:** `.github/workflows/portal-control-guard.yml`  
**Risk:** Low to medium  
**Reason:** Narrow path filter, canonical frozen install, no deployment or
database authority, and absent from the explicit required-main-check registry.

The migration must preserve current behavior:

```yaml
- uses: actions/checkout@v4
- uses: ./.github/actions/setup-platform
  with:
    engine-check-enabled: "false"
- run: pnpm run control:ci
```

The explicit `false` is required because the current workflow does not execute
the engine guard. Enabling it silently would strengthen and change failure
semantics during a consolidation-only migration.

## Pilot acceptance

Before merge:

1. workflow and job names are byte-for-byte unchanged;
2. triggers, path filters, permissions, and concurrency are unchanged;
3. checkout remains explicit and first;
4. `control:ci` command is unchanged;
5. cache and frozen-lockfile install behavior are unchanged;
6. engine checking remains disabled for parity;
7. YAML/action syntax is validated locally where possible;
8. a `workflow_dispatch` or equivalent before/after Actions run is recorded;
9. the failure behavior of install and `control:ci` remains fail-closed;
10. rollback is the single workflow patch.

Expansion beyond this pilot requires external Actions-run evidence; static
repository inspection cannot establish cache-hit behavior or hosted-runner
parity.

## R4 decision

R4 architecture is already partially implemented. The next safe action is not
to create another abstraction, but to:

1. reconcile `CI_COMPOSITE_SETUP.md` with repository reality;
2. collect parity evidence for existing callers;
3. migrate `portal-control-guard.yml` as one isolated pilot;
4. expand only to matching non-required workflows;
5. leave required-check workflows for a separately approved wave.

No workflow was changed by this assessment.
