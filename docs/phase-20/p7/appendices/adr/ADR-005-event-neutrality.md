# ADR-005 — Host event neutrality (TourCreated → reaction port)

```yaml
adr_id: ADR-005
title: Finance event neutrality
status: Accepted
date: "2026-07-18"
supersedes: []
related:
  - FINANCE_PLATFORM_EVOLUTION_PLAN (1.7–1.9, 2.3.5)
  - FINANCE_HOST_INTEGRATION_KIT
  - FIN-EVENT-NEUTRAL-01
  - ADR-004
```

## Status

Accepted.

## Context

Generic outbox processing and dispatchers historically imported Denali TourCreated finance façades. That violated workspace ownership and blocked additional finance products.

## Decision

1. Production path: outbox relay → TourCreated side-effect dispatch → `processWorkspaceFinanceTourCreatedRow` → `WorkspaceFinanceEventReactionPort` resolved by registry (`workspaceType`).
2. Port surface: `consumePendingForTenant` + `reactToPublishedRow` (contracts in `@app-tour/finance-http-contracts`).
3. Manifest `dispatchVia: "financeEventReaction"` → generated outbox bindings must **not** embed Denali `run*` façades for finance.
4. Unknown / unregistered type when finance reaction is required → `FINANCE_EVENT_REACTION_UNSUPPORTED` (fail-closed). Non-finance tenants skip invoke.
5. Guard **FIN-EVENT-NEUTRAL-01:** generic host finance runtime modules must have **zero** `@app-tour/workspace-*` imports.
6. TourCreated journal math remains **workspace-owned**; finance-core does not own the reaction.

## Consequences

- TourCreated can mint ledgers outside Option C approve guards — product/workspace responsibility (hostile residual documented).
- Host stays product-agnostic; workspaces own CoA/wallet prefixes and reaction behavior.
- Stub reactions on fixture SKUs are valid registry entries but not production peer workflows.

## Evidence

- [`../FINANCE_PLATFORM_EVOLUTION_PLAN.md`](../FINANCE_PLATFORM_EVOLUTION_PLAN.md) Phases 1.7–1.9, 2.3.5
- [`../FINANCE_HOST_INTEGRATION_KIT.md`](../FINANCE_HOST_INTEGRATION_KIT.md) §5.3–5.4
- `apps/api/src/workspace-finance/finance-outbox-ownership.spec.ts`
- `packages/finance-http-contracts` workspace finance ports
