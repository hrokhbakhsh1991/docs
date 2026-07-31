# Root Command Classification — Operations Cohort

**Status:** Active — Phase 0 classification ledger, cohort 2  
**Captured:** 2026-07-29  
**Parent ledger:** [`ROOT_COMMAND_CLASSIFICATION.md`](./ROOT_COMMAND_CLASSIFICATION.md)

## Cohort result

**Reviewed commands:** 64  
**Previously reviewed:** 39  
**Total reviewed:** 103  
**Remaining:** 202

Low textual usage is expected for manual operations. No command in this cohort
is a removal candidate. Classification reflects the command's primary contract;
CI and runbook use are retained as secondary consumer tags.

## Environment and database

| Command                     | Primary class | Owner                  | Safety note                                                   |
| --------------------------- | ------------- | ---------------------- | ------------------------------------------------------------- |
| `infra:up`                  | `OPS_ONLY`    | Platform Operations    | Starts local shared services                                  |
| `infra:down`                | `OPS_ONLY`    | Platform Operations    | Stops local shared services                                   |
| `infra:minio:up`            | `OPS_ONLY`    | Platform Operations    | Starts local object storage                                   |
| `infra:minio:ensure-bucket` | `CI_ONLY`     | Platform Operations CI | Used by Phase 6 CI and local bootstrap                        |
| `db:migrate:deploy`         | `OPS_ONLY`    | Database Operations    | Requires admin migration authority                            |
| `db:test-reset`             | `OPS_ONLY`    | Database Operations    | Destructive tenant-data truncate; never classify by low usage |

## Branch protection and release coordination

| Command                         | Primary class | Owner                  | Safety note                              |
| ------------------------------- | ------------- | ---------------------- | ---------------------------------------- |
| `ops:branch-protection:main`    | `OPS_ONLY`    | Release Engineering    | Mutates live repository protection       |
| `ops:branch-protection:phase-1` | `OPS_ONLY`    | Release Engineering    | Compatibility entry for protection apply |
| `ops:branch-protection:verify`  | `CI_ONLY`     | Release Engineering CI | Booking gate verifies required checks    |
| `ops:branch-protection:dry-run` | `OPS_ONLY`    | Release Engineering    | Non-mutating preview                     |
| `ops:branch-protection:print`   | `OPS_ONLY`    | Release Engineering    | Non-network plan output                  |
| `ops:phase-f-gates`             | `OPS_ONLY`    | Release Engineering    | Manual phase bundle                      |
| `ops:wait-required-checks`      | `OPS_ONLY`    | Release Engineering    | Deployment coordination                  |

## Deployment profiles and build preparation

| Command                             | Primary class | Owner                     | Safety note                                       |
| ----------------------------------- | ------------- | ------------------------- | ------------------------------------------------- |
| `print:deploy-profile-plan`         | `OPS_ONLY`    | Platform Deployment       | Read-only plan                                    |
| `print:deploy-profile-env`          | `OPS_ONLY`    | Platform Deployment       | Read-only environment output                      |
| `apply:deploy-profile`              | `OPS_ONLY`    | Platform Deployment       | May write with explicit `--write`                 |
| `sync:guest-runtime-deploy-profile` | `OPS_ONLY`    | Platform Deployment       | Deploy-only package rewrite; do not commit output |
| `build:operator-vps`                | `OPS_ONLY`    | Platform Deployment       | VPS artifact build                                |
| `stage:p4`                          | `OPS_ONLY`    | Product Release           | Phase 4 staging preparation                       |
| `seed:wrs-denali-club-domains`      | `OPS_ONLY`    | Tenant Routing Operations | Mutates development tenant-domain rows            |

## Phase 6 staging

| Command                    | Primary class | Owner          |
| -------------------------- | ------------- | -------------- |
| `p6:staging-preflight`     | `OPS_ONLY`    | Denali Release |
| `p6:staging-deploy-verify` | `OPS_ONLY`    | Denali Release |
| `p6:staging-gate`          | `OPS_ONLY`    | Denali Release |

`p6:staging-gate` also has a workflow consumer. Its primary contract remains a
staging operation because it requires an environment and database context.

## Phase 7 delivery operations

All commands in this section are `OPS_ONLY`, owned by **Denali Delivery**.
They are referenced by active Phase 20 runbooks, verification manifests,
evidence packs, or customer sign-off procedures.

| Command                                       | Operational role                      |
| --------------------------------------------- | ------------------------------------- |
| `p7:configure-staging-revalidate`             | Mutating staging configuration        |
| `p7:evidence-pack-verify`                     | Evidence validation                   |
| `p7:staging-approve-booking-probe`            | Booking staging probe                 |
| `p7:staging-catalog-probe`                    | Catalog staging probe                 |
| `p7:staging-draft-refresh-probe`              | Draft refresh staging probe           |
| `p7:staging-e2e-probe`                        | Staging browser probe                 |
| `p7:staging-finance-hub-probe`                | Finance hub staging probe             |
| `p7:staging-finance-ops-probe`                | Finance operations staging probe      |
| `p7:staging-gate`                             | Full staging gate                     |
| `p7:staging-operator-login`                   | Operator login probe                  |
| `p7:staging-picker-probe`                     | Picker staging probe                  |
| `p7:staging-portal-pending-probe`             | Portal pending-state probe            |
| `p7:staging-publish-violations-probe`         | Publish validation probe              |
| `p7:staging-remote-smoke`                     | Remote VPS smoke                      |
| `p7:staging-seed-bundle`                      | Mutating staging seed                 |
| `p7:staging-sync-platform-core`               | Staging platform-core synchronization |
| `p7:staging-terms-probe`                      | Terms staging probe                   |
| `p7:staging-verify`                           | Staging verification subset           |
| `p7:staging-vs01-probe`                       | Vertical-slice 01 probe               |
| `p7:staging-vs06-runbook-probe`               | Vertical-slice 06 runbook probe       |
| `p7:staging-waitlist-promote-probe`           | Waitlist promotion probe              |
| `p7:staging-wizard-probe`                     | Wizard staging probe                  |
| `p7:staging-workspace-registrations-probe`    | Registration staging probe            |
| `p7:sync-staging-terms-vps`                   | Mutating VPS terms synchronization    |
| `p7:sync-staging-web`                         | Mutating VPS web synchronization      |
| `p7:sync-staging-web-rsync`                   | Mutating VPS rsync path               |
| `p7:sync-staging-web-vps-build`               | Mutating VPS-build synchronization    |
| `p7:sync-staging-workspace-registrations-vps` | Mutating VPS registration sync        |
| `p7:t4-architect-dry-run`                     | Sign-off rehearsal                    |
| `p7:t4-closeout`                              | Customer sign-off closeout            |
| `p7:t4-day`                                   | Customer sign-off orchestration       |
| `p7:t4-prep`                                  | Sign-off environment preparation      |
| `p7:t4-ready`                                 | Sign-off readiness decision           |
| `p7:t4-session-brief`                         | Sign-off session output               |

## Phase 8 remote smoke

| Command                      | Primary class | Owner                    |
| ---------------------------- | ------------- | ------------------------ |
| `p8:staging-remote-smoke`    | `OPS_ONLY`    | Platform Surface Release |
| `p8:production-remote-smoke` | `OPS_ONLY`    | Platform Surface Release |

## Phase 10 production operations

| Command                       | Primary class | Owner                  | Safety note               |
| ----------------------------- | ------------- | ---------------------- | ------------------------- |
| `p10:staging-remote-smoke`    | `OPS_ONLY`    | Production Engineering | Remote staging check      |
| `p10:production-remote-smoke` | `OPS_ONLY`    | Production Engineering | Production remote check   |
| `p10:staging-gate`            | `OPS_ONLY`    | Production Engineering | Four-process staging gate |
| `p10:ops-drill`               | `OPS_ONLY`    | Production Engineering | Operational drill         |
| `p10:vps-smoke`               | `OPS_ONLY`    | Production Engineering | VPS health verification   |

## Risk controls for later consolidation

1. `db:test-reset` must remain visibly destructive and must never be inferred
   unused from CI counts.
2. Branch-protection apply and verify commands have different side effects and
   must not be merged.
3. Read-only deploy-profile printers must remain separate from write-capable
   apply/sync commands.
4. Remote sync, seed, configuration, closeout, and drill commands require
   runbook review before rename or dispatch consolidation.
5. Phase 7 command count is a runbook-surface problem, not evidence of dead
   code. Consolidation requires a stable operation dispatcher plus compatibility
   mapping.
6. Production and staging commands must remain distinct even if their bodies
   appear similar.

## Cohort decision

- All 64 names exist in the current root `package.json`.
- No command overlaps cohort 1.
- Active CI and runbook consumers are documented.
- Destructive and remote side effects are explicitly protected.
- No command is approved for migration or removal.
- The next safe cohort is product/domain guard leaves; historical phase-gate
  review remains deferred.
