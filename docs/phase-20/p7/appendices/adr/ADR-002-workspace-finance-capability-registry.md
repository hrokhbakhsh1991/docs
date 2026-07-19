# ADR-002 — Workspace finance capability registry

```yaml
adr_id: ADR-002
title: Workspace finance capability registry
status: Accepted
date: "2026-07-19"
supersedes: []
related:
  - FINANCE_CAPABILITY_SYSTEM_MATURITY
  - phase-14.0-surface-registry-codegen
  - PAYMENT-LEDGER-BOUNDARY
```

## Status

Accepted.

## Context

The host API and web app must remain workspace-agnostic. Hand-maintained registries that hardcode workspace ids blocked drop-in finance products and violated import-boundary rules.

## Decision

1. **Source of truth:** each workspace `workspace.manifest.json` → `workspaceFinance` block.
2. **Codegen:** `pnpm run generate:workspace-registry` emits host bindings (dependency factories, CoA, event reaction, capability/nav, optional ops).
3. **Enablement:** `workspaceFinance.supported` drives API capability gate + web finance nav. `registryOnly: true` must not combine with `supported: true` (architecture-proof packages such as finance-ws2).
4. **Required together when declaring ledger:** `ledgerPolicy` + `receiptDefaults` (+ `chartOfAccounts` when ledger declared).
5. **Optional:** `eventReaction` (with `requiresHostIo`), `opsManifest`.
6. Runtime unsupported workspace → `FINANCE_WORKSPACE_UNSUPPORTED`. Missing reaction when invoked → `FINANCE_EVENT_REACTION_UNSUPPORTED`.
7. Booking payment adapter remains **platform-owned** (not declared in the finance manifest).

## Consequences

- New finance workspace = package + manifest + adapters + regenerate; no hand-edited id lists in gates.
- Ops/reaction omissions yield API-capable but uneven product parity (documented in multi-product cert).
- Host composition resolves deps by `workspaceType` (`resolveFinanceWorkspaceDependencies`).

## Evidence

- [`../FINANCE_CAPABILITY_SYSTEM_MATURITY.md`](../FINANCE_CAPABILITY_SYSTEM_MATURITY.md)
- `scripts/codegen/workspace-registry/domains/finance.mjs`
- `apps/api/src/workspace-finance/workspace-finance-*-bindings.generated.ts`
- `apps/web/src/bootstrap/workspace-finance-{nav,ops}-bindings.generated.ts`
- `packages/workspaces/*/workspace.manifest.json`
