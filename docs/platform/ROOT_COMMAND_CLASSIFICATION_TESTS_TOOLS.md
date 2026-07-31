# Root Command Classification — Tests and Tools

**Status:** Active — Phase 0 classification ledger, cohort 4  
**Captured:** 2026-07-29  
**Parent ledger:** [`ROOT_COMMAND_CLASSIFICATION.md`](./ROOT_COMMAND_CLASSIFICATION.md)

## Cohort result

**Reviewed commands:** 21  
**Previously reviewed:** 203  
**Total reviewed:** 224  
**Remaining:** 81

This cohort covers root test entry points, structural metrics, code generators,
and workspace scaffolding. No command is a removal candidate.

## Test orchestration

| Command                       | Primary class | Owner                 | Protection reason                                |
| ----------------------------- | ------------- | --------------------- | ------------------------------------------------ |
| `test:changed`                | `CANONICAL`   | Developer Experience  | Git-aware test selection and pre-commit consumer |
| `test:full`                   | `COMPOSITE`   | Platform Quality      | Full phase/integration closure                   |
| `test:adversarial`            | `COMPOSITE`   | Platform Architecture | SDK and platform-core adversarial suite          |
| `test:nightly`                | `COMPOSITE`   | API Reliability       | Nightly suite plus optional soak path            |
| `test:gap-closure-acceptance` | `COMPOSITE`   | Platform Architecture | Multi-spec scaffold and thin-shell acceptance    |

These commands aggregate different proof surfaces. Similar `test:*` naming does
not make them aliases.

## CI-protected integration tests

| Command                            | Primary class | Owner               | CI contract                      |
| ---------------------------------- | ------------- | ------------------- | -------------------------------- |
| `test:booking-capacity-postgres`   | `CI_ONLY`     | Booking Reliability | Booking PostgreSQL workflow      |
| `test:booking-capacity-stress`     | `CI_ONLY`     | Booking Reliability | Booking stress workflow          |
| `test:booking-approve-concurrency` | `CI_ONLY`     | Booking Reliability | Approval concurrency workflow    |
| `test:booking-http-postgres`       | `CI_ONLY`     | Booking Reliability | Booking HTTP PostgreSQL workflow |
| `test:minio-photo`                 | `CI_ONLY`     | Storage Reliability | Phase 6 MinIO workflow           |

The primary `CI_ONLY` class does not prohibit local execution; it records that
workflow migration must precede rename or removal.

## Focused test leaves

| Command                       | Primary class | Owner                | Protection reason                   |
| ----------------------------- | ------------- | -------------------- | ----------------------------------- |
| `test:contract:monorepo`      | `LEAF`        | Workspace SDK        | Phase 0 integration contract        |
| `test:e2e:urban`              | `LEAF`        | Urban Workspace      | Focused Urban browser suite         |
| `test:exposure:integration`   | `LEAF`        | Field Exposure       | PostgreSQL exposure integration     |
| `test:nightly:cold-start`     | `LEAF`        | API Reliability      | Enforced compiled cold-start path   |
| `test:surface-cohesion-smoke` | `LEAF`        | Surface Architecture | Static cross-surface smoke contract |

## Generators and workspace tools

| Command                            | Primary class | Owner              | Contract                                     |
| ---------------------------------- | ------------- | ------------------ | -------------------------------------------- |
| `generate:denali-semantic-slices`  | `CANONICAL`   | Design Tokens      | Shared semantic-token slice generation/check |
| `generate:denali-settings-modules` | `CANONICAL`   | Field Exposure     | Settings-module generation/check             |
| `workspace:create`                 | `CANONICAL`   | Workspace Platform | Workspace scaffold entry                     |
| `print:workspace-onboard-plan`     | `CANONICAL`   | Workspace Platform | Read-only onboarding plan                    |

`workspace:create` is also dynamically consumed by `workspace:onboard`. The
print command is deliberately separate because it has no install/build side
effects.

## Structural validation

| Command                  | Primary class | Owner                 | Protection reason                     |
| ------------------------ | ------------- | --------------------- | ------------------------------------- |
| `baseline:metrics`       | `LEAF`        | Platform Architecture | Phase 0 structural metrics and report |
| `validate-design-tokens` | `LEAF`        | Design Tokens         | Phase 2 token validation              |

## Cohort decision

- All 21 names exist in the current root `package.json`.
- No name overlaps earlier cohorts.
- Four composite, five CI-only, five canonical, and seven leaf commands are
  classified.
- Hook, CI, generator, onboarding, and active-document consumers are protected.
- No command body, test assertion, workflow, or product implementation changed.
- The next cohort should classify smoke and control-pack commands before phase
  gates.
