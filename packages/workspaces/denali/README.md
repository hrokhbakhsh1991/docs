# @app-tour/workspace-denali

> **Maintenance mode (P3-D)** — product workspace plugin; metadata cutover complete on trunk.

**Phase 6.2–6.3 — registry, rules, composites + theme** (product workspace; not a guard probe).

Denali is the first full `WorkspacePlugin` product workspace on trunk. P0 domain files from `legacy/packages/denali-domain/` are ported under `src/` with `types/legacy/` shims (no runtime `legacy/` imports).

## Layout

| Path                               | Role                                                          |
| ---------------------------------- | ------------------------------------------------------------- |
| `src/field-registry/`              | Field registry + matrix recipes (P0 port)                     |
| `src/rules/`                       | `evaluateFormRules` + generated rule set                      |
| `src/composites/`                  | `denali.*` widget registry + platform renderer id map         |
| `src/denali-plugin-adapter.ts`     | Maps registry → `WorkspaceFieldRegistry` / `WorkspaceRuleSet` |
| `src/denali.plugin.ts`             | `getDenaliWorkspacePlugin()`                                  |
| `src/booking/`                     | Booking **domain policy** — lifecycle, capacity, validation, HTTP adapters |
| `src/bookings/`                    | Booking **operator ops** — registration command-center manifest |
| `src/finance/`                     | Finance **ledger / outbox / obligation** + Phase 2 verification helpers |
| `src/acl/`                         | `normalizeLegacyTripDetails`, `toCanonicalDocument`           |
| `scripts/denali-codegen.mjs`       | Regenerates `src/rules/generated/`                            |
| `test/registry-parity.spec.ts`     | Legacy parity + `validateCanonical` gate                      |
| `test/composites.contract.spec.ts` | Widget registry + theme ingress (6.3)                         |
| `test/fixtures/golden/`            | 3 golden wizard JSON fixtures                                 |
| `theme/tokens.css`                 | `--ws-*` workspace brand tokens                               |

### Booking ownership (Phase 1)

| Concern | Home | Notes |
| --- | --- | --- |
| Status transitions / history | `src/booking/lifecycle.ts` | Pure state machine; aligned with ops `statusPipeline` |
| Capacity / availability | `src/booking/availability.ts` + `capacity-rule.ts` | Booking-owned; host supplies occupancy via HTTP contracts |
| Create validation | `src/booking/validation.ts` | Base-shape + Denali party/departure limits |
| Participants | `src/booking/participant.ts` | Seat contribution → partySize |
| Operator decisions | `src/booking/operator-decisions.ts` + `ops-actions.ts` | Domain helpers + ops action key map; persistence remains host |
| HTTP adapters | `src/booking/adapters.ts` | Manifest `workspaceBooking.*` module `./booking` |
| Guest registration glue | `src/http/registration.service.ts` | Calls `assertDenaliCreateValid` before host `createPendingBooking` |
| Ops UI contract | `src/bookings/ops-manifest.ts` | `bookingOps` capability — presentation only |

Do **not** put transition rules in `bookings/` or Denali-specific booking logic in `apps/web`.

### Finance ownership (Phase 2)

| Concern | Home | Notes |
| --- | --- | --- |
| Obligation (offline receipt) | `resolve-denali-registration-obligation.ts` | Pure pricing × partySize |
| TourCreated → ledger payload | `build-tour-created-finance-payload.ts` | Aligns commercial obligation to outbox payload |
| Outbox consumer / idempotency | `finance-outbox-consumer.ts` | Duplicate domainEventId skipped |
| Chain verification / visibility | `verify-tour-created-finance-chain.ts` | Package proof: event → ledger visible |
| Ops panels | `finance-ops-manifest.ts` | `financeOps` capability; ledger panel gates visibility |
| HTTP adapters | `adapters/*` | Manifest `workspaceFinance.*` |

Do **not** move Denali finance side effects into handwritten `apps/web`.

## Metadata export (P3-D)

Workspace metadata definitions are exported from the live Denali plugin for seed parity:

```bash
pnpm --filter @apps/api run export:workspace-definition -- --workspace denali --out scripts/seed/definitions/denali-v1.json
```

Regenerate `denali-v1.json` after field-registry or composite changes; DP/RP parity specs compare the export to the package strip.

## Commands

```bash
pnpm --filter @app-tour/workspace-denali build
pnpm --filter @app-tour/workspace-denali run denali:codegen
git diff --exit-code packages/workspaces/denali/src/rules/generated
pnpm --filter @app-tour/workspace-denali test test/registry-parity.spec.ts
pnpm --filter @app-tour/workspace-denali test test/composites.contract.spec.ts
```

## Policy

| Rule                                                                | Detail                                                           |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Product code lives here only                                        | No Denali-specific logic in `platform-core` / generic `apps/api` |
| No runtime `legacy/` imports in `src/` (except `src/acl/` boundary) | Port is manual copy + shims                                      |
| API resolver binding                                                | Subphase **6.5** wires `resolveWorkspacePluginForType('denali')` |
