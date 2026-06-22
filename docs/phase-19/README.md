# Phase 19 — P6 Denali first customer

```yaml
pack_version: "2.2"
nanos: 58
status: REOPEN_BEHAVIORAL
doc_pack: COMPLETE
code_integration: PARTIAL
execution_order: [P6-0, P6-1, P6-2, P6-3, P6-4]
milestone_guest_slice: P6-1-N-014
gate_static: pnpm run p6:gate
gate_live: node scripts/smoke-p6-host-bind.mjs
navigator: AGENT-NAVIGATOR.md
p7_blocked: true
```

## Start

→ [p6/AGENT-START.md](p6/AGENT-START.md) · **status:** REOPEN_BEHAVIORAL · current `P6-0-N-007`

## Umbrella

→ [platform-denali-first-customer.mdoc](platform-denali-first-customer.mdoc)

## Addressing (mandatory before host work)

→ [p6-host-addressing-architecture.mdoc](p6-host-addressing-architecture.mdoc) · [p6/runbooks/host-subdomain-map.md](p6/runbooks/host-subdomain-map.md)

## Theming (mandatory before guest UI)

→ [p6-enterprise-theming-architecture.mdoc](p6-enterprise-theming-architecture.mdoc) · [p6-implementation-standards.mdoc](p6-implementation-standards.mdoc) · [p6/p6-theming-file-tree.md](p6/p6-theming-file-tree.md)

## Prerequisite

P5 complete (`P5-B-N-016`). P6 does not change P5.

## Three apps (dev canonical)

| App | Host | Legacy smoke |
| --- | ---- | ------------ |
| `apps/marketing` | `{club}.localhost:3002` | `shop.{club}.localhost:3002` |
| `apps/portal` | `{club}.portal.localhost:3003` | `{club}.localhost:3003` |
| `apps/web` admin | `{club}.admin.localhost:3000` | `{club}.localhost:3000` |

Prod platform: `{club}.{root}` · `{club}.portal.{root}` · `{club}.admin.{root}`.

Custom apex (per tenant): `denali.club` · `portal.denali.club` · `admin.denali.club`.

## EPICs (order)

| EPIC | Doc | Nanos | Priority |
| ---- | --- | ----- | -------- |
| P6-0 | [p6-0-host-subdomain.md](p6/p6-0-host-subdomain.md) | 9 | Dual host + tenant parity |
| P6-1 | [p6-1-guest-slice.md](p6/p6-1-guest-slice.md) | 15 | **Browse → register** |
| P6-2 | [p6-2-operator-admin.md](p6/p6-2-operator-admin.md) | 16 | Full admin |
| P6-3 | [p6-3-member-portal.md](p6/p6-3-member-portal.md) | 10 | `/me` + receipt |
| P6-4 | [p6-4-exit-gate.md](p6/p6-4-exit-gate.md) | 8 | Gate + staging |

## Progress & appendices

→ [p6/DOC-SYNC-INDEX.md](p6/DOC-SYNC-INDEX.md) · [p6/p6-exit-checklist.md](p6/p6-exit-checklist.md)

| Appendix | Role |
| -------- | ---- |
| [p6/appendices/IMPLEMENTATION-TRUTH-P6.md](p6/appendices/IMPLEMENTATION-TRUTH-P6.md) | Repo truth — read before any P6 code change |
| [p6/appendices/TRACEABILITY-MATRIX-P6.md](p6/appendices/TRACEABILITY-MATRIX-P6.md) | 58 nanos → files → specs |
| [p6/appendices/SMOKE-SCENARIO-MAP-P6.md](p6/appendices/SMOKE-SCENARIO-MAP-P6.md) | SMK-P6 scenarios |
| [p6/runbooks/p6-e2e-smoke.md](p6/runbooks/p6-e2e-smoke.md) | T2 browser E2E (Architect YES) |
| [p6/appendices/FINANCE-OPS-P6-NOTE.md](p6/appendices/FINANCE-OPS-P6-NOTE.md) | finance-ops when Postgres |
| [p6/appendices/OTP-SCOPE-P6.md](p6/appendices/OTP-SCOPE-P6.md) | OTP share scope |
| [p6/FILE-MAP.md](p6/FILE-MAP.md) | Full file index |

## Superseded (v1.0)

Old EPIC ids `P6-A` … `P6-D` replaced in v2.0 — see `DOC-SYNC-INDEX.yaml` `deprecated_epics`.
