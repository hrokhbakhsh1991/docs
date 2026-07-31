# Root Command Classification — Guest, Member, and Routing Guards

**Status:** Active — Phase 0 classification ledger, cohort 3B  
**Captured:** 2026-07-29  
**Parent ledger:** [`ROOT_COMMAND_CLASSIFICATION.md`](./ROOT_COMMAND_CLASSIFICATION.md)

## Cohort result

**Reviewed commands:** 21  
**Previously reviewed:** 119  
**Total reviewed:** 140  
**Remaining:** 165

This cohort covers guest surfaces, member/portal authority, cross-surface
cohesion, and tenant-routing invariants. No command is a removal candidate.

## Guest platform

| Command                            | Primary class | Owner          | Protection reason                               |
| ---------------------------------- | ------------- | -------------- | ----------------------------------------------- |
| `guard:guest-api-shell`            | `LEAF`        | Guest Platform | Generated API dispatch and guest shell contract |
| `guard:guest-consumer-deps`        | `LEAF`        | Guest Platform | Consumer dependency boundary                    |
| `guard:guest-cross-surface-nav`    | `LEAF`        | Guest Platform | Marketing/portal navigation contract            |
| `guard:guest-extension-schema`     | `LEAF`        | Guest Platform | Guest extension schema invariant                |
| `guard:guest-runtime-product-deps` | `LEAF`        | Guest Platform | Manifest sync and product-dependency ceiling    |

These implementations also participate in `guard:guest` or other composite
paths. Their root leaf entry points remain useful for focused remediation and
path-gated checks.

## Member portal

| Command                         | Primary class | Owner           | Protection reason                   |
| ------------------------------- | ------------- | --------------- | ----------------------------------- |
| `guard:member-portal-contract`  | `LEAF`        | Member Platform | Generated member contract alignment |
| `guard:member-portal-registry`  | `LEAF`        | Member Platform | Member registry integrity           |
| `guard:member-shell`            | `LEAF`        | Member Platform | Member shell contract               |
| `guard:member-url-builder`      | `LEAF`        | Member Platform | Cross-surface member URL authority  |
| `guard:member-seo`              | `LEAF`        | Member Platform | Member crawl/SEO boundary           |
| `guard:workspace-member-egress` | `LEAF`        | Member Platform | Workspace-to-member egress boundary |
| `guard:member-portal-shell`     | `COMPOSITE`   | Member Platform | Seven-guard closure bundle          |

`guard:member-portal-shell` is not an alias for a single leaf. It executes:

1. member shell;
2. member portal contract;
3. member portal registry;
4. member URL builder;
5. guest cross-surface navigation;
6. workspace member egress;
7. member SEO.

## Portal surface

| Command                                | Primary class | Owner          | Protection reason                           |
| -------------------------------------- | ------------- | -------------- | ------------------------------------------- |
| `guard:portal-guest-theme-loader`      | `LEAF`        | Portal Surface | Guest theme loading contract                |
| `guard:portal-member-profile-boundary` | `LEAF`        | Portal Surface | Direct CI and product-gate profile boundary |

## Routing and authority

| Command                            | Primary class | Owner                    | Protection reason                                   |
| ---------------------------------- | ------------- | ------------------------ | --------------------------------------------------- |
| `guard:wrs-routing`                | `LEAF`        | Tenant Routing           | WRS-001 cross-app routing authority                 |
| `guard:wrs-stale-docs`             | `LEAF`        | Tenant Routing           | Prevents regression in docs and Playwright defaults |
| `guard:pcms-authority`             | `LEAF`        | Member Session Authority | PCMS-001 portal-centric session invariant           |
| `guard:api-host-allowlist-ratchet` | `LEAF`        | Host Architecture        | Prevents API host allowlist growth                  |
| `guard:surface-cohesion`           | `COMPOSITE`   | Surface Architecture     | Cross-surface bootstrap, branding, and host parity  |

`guard:surface-cohesion` has warn and strict modes and spans marketing, portal,
web, shared host packages, and smoke-matrix contracts. It must not be collapsed
into one routing or member leaf.

## Cohort decision

- All 21 names exist in the current root `package.json`.
- No name overlaps earlier cohorts.
- Two composites and 19 leaf guards are classified.
- Direct workflow, product-gate, defensive-guard, and runbook consumers are
  protected.
- No command body, assertion, workflow, or product implementation changed.
- The next guard subcohort should cover workspace registry and plugin-surface
  guards.
