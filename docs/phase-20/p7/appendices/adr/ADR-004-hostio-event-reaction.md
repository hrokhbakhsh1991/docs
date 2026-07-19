# ADR-004 — HostIo injection for finance event reactions

```yaml
adr_id: ADR-004
title: HostIo for finance event reactions
status: Accepted
date: "2026-07-18"
supersedes: []
related:
  - FINANCE_PLATFORM_EVOLUTION_PLAN (Phase 1.13)
  - FINANCE_CAPABILITY_SYSTEM_MATURITY
  - ADR-005
```

## Status

Accepted.

## Context

Denali TourCreated → ledger side effects need claim, outbox write, processed-event store, and failure logging. A module singleton registrar (`register-workspace-finance-deps`) coupled boot to workspace packages and blocked neutral host composition.

## Decision

1. Manifest field `workspaceFinance.eventReaction.requiresHostIo` declares whether the reaction needs platform I/O.
2. When `requiresHostIo: true`, the host registry injects `PlatformFinanceEventReactionHostIo` (claim + writer + processed store + `logReactionFailed`) at `resolveWorkspaceFinanceEventReaction`.
3. Denali reaction adapters receive HostIo deps and pass them into `runTourCreatedFinanceSideEffect(row, deps)` — no Denali boot registrar.
4. Fixture workspaces typically set `requiresHostIo: false` and ship stub/no-op reactions.
5. Deleted pattern: `register-workspace-finance-deps.ts` singleton registration for production composition.

## Consequences

- Production Denali path is richer than fixture reactions (multi-product parity gap).
- Structural HostIo typing cast debt may remain (documented P2); behavior contract is injection-at-resolve.
- Codegen emits `requiresHostIo` on event-reaction bindings.

## Evidence

- [`../FINANCE_PLATFORM_EVOLUTION_PLAN.md`](../FINANCE_PLATFORM_EVOLUTION_PLAN.md) Phase 1.13
- [`../FINANCE_CAPABILITY_SYSTEM_MATURITY.md`](../FINANCE_CAPABILITY_SYSTEM_MATURITY.md)
- `apps/api/src/workspace-finance/finance-event-reaction-registry.ts` (or equivalent resolve path)
- `packages/workspaces/denali/workspace.manifest.json` (`requiresHostIo: true`)
