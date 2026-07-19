# ADR-003 — finance-core freeze and monorepo retention

```yaml
adr_id: ADR-003
title: finance-core freeze and monorepo retention
status: Accepted
date: "2026-07-19"
supersedes: []
related:
  - FINANCE_CORE_INTERNAL_FREEZE
  - FINANCE_CORE_EXTRACTION_DECISION
  - FINANCE_HOST_INTEGRATION_KIT
  - FINANCE_CORE_EXTRACTION_READINESS
```

## Status

Accepted.

**Note:** Extraction decision uses labels A/B/C where **C = separate repository**. That “Option C” is **not** ADR-001 approve Option C.

## Context

Domain/application finance engine was extracted to `@app-tour/finance-core`. Teams asked whether to publish packages or move them to a second repository for external hosts.

## Decision

1. Treat finance-core as a **frozen internal** API: `private: true`, explicit public barrel, required ctor ports (`createFinanceService`).
2. **Extraction verdict A — keep inside the monorepo.** Do not publish (B) and do not extract to a separate repository (C) on current evidence.
3. finance-core **must not** import: Prisma, `apps/api`, `@app-tour/workspace-*`, `*.generated.*`, `process.env`, or HostIo symbols (enforced by guards).
4. Hosts adopt via the Host Integration Kit: implement ports; keep DB/RLS/outbox/booking on the host.
5. Reopen publish/extract only if a second host cannot consume monorepo workspace packages (documented reopen criteria in the extraction decision).

## Consequences

- Internal platform reuse is certified; Reference Platform / published packs are **not**.
- Second-host install still needs pack/semver rewrite path before any future publish (`FINANCE_DEPS_WORKSPACE_TO_REGISTRY`).
- Semver policy treats Option C order and identity formulas as breaking when changed.

## Evidence

- [`../FINANCE_CORE_INTERNAL_FREEZE.md`](../FINANCE_CORE_INTERNAL_FREEZE.md)
- [`../FINANCE_CORE_EXTRACTION_DECISION.md`](../FINANCE_CORE_EXTRACTION_DECISION.md) (verdict **A**)
- [`../FINANCE_HOST_INTEGRATION_KIT.md`](../FINANCE_HOST_INTEGRATION_KIT.md)
- `packages/finance-core/README.md`
