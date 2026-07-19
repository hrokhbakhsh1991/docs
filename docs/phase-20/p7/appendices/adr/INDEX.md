# Finance Architecture Decision Records — Index

```yaml
index_id: FINANCE_ADR_INDEX
version: "1.0"
date: "2026-07-19"
scope: phase-20 / p7 finance platform
status: accepted
authority: existing P7 appendices + Phase 5 DEC-086 (no new product semantics)
```

Formal ADRs for finance platform decisions already enforced in code and appendices. These records **do not** change behavior; they cite normative sources.

| ADR | Title | Status |
| --- | ----- | ------ |
| [ADR-001](./ADR-001-option-c-approve-atomicity.md) | Option C — approve / ledger capture atomicity | Accepted |
| [ADR-002](./ADR-002-workspace-finance-capability-registry.md) | Workspace finance capability registry | Accepted |
| [ADR-003](./ADR-003-finance-core-monorepo-boundary.md) | finance-core freeze and monorepo retention | Accepted |
| [ADR-004](./ADR-004-hostio-event-reaction.md) | HostIo injection for finance event reactions | Accepted |
| [ADR-005](./ADR-005-event-neutrality.md) | Host event neutrality (TourCreated → reaction port) | Accepted |
| [ADR-006](./ADR-006-repository-boundary.md) | Finance repository port vs Prisma host | Accepted |
| [ADR-007](./ADR-007-outbox-failed-replay.md) | Outbox failed → pending replay | Accepted |
| [ADR-008](./ADR-008-reconciliation-repair.md) | Reconciliation detect + repair engine | Accepted |
| [ADR-009](./ADR-009-finance-slo-framework.md) | Finance money-path SLO framework | Accepted |
| [ADR-010](./ADR-010-duplicate-wallet-credit-xor.md) | TourCreated ∩ capture wallet credit XOR | Accepted |
| [ADR-011](./ADR-011-adapter-identity-stability.md) | Deterministic adapter ledger identities | Accepted |

**Not in this series:** PCMS-001 (portal member session — separate standard). Extraction “Option C” in `FINANCE_CORE_EXTRACTION_DECISION` means *separate repository* and is **rejected**; it is not ADR-001 Option C (approve TX).

**Onboarding:** New engineers start at [`../FINANCE_PLATFORM_DEVELOPER_GUIDE.md`](../FINANCE_PLATFORM_DEVELOPER_GUIDE.md).

**Golden tests:** [`../FINANCE_GOLDEN_ARCHITECTURE_TESTS.md`](../FINANCE_GOLDEN_ARCHITECTURE_TESTS.md) — `pnpm run guard:finance-golden`.
