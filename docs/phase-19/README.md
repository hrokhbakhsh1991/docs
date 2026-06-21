# Phase 19 — P6 Denali first customer

```yaml
pack_version: "2.0"
nanos: 56
execution_order: [P6-0, P6-1, P6-2, P6-3, P6-4]
milestone_guest_slice: P6-1-N-014
```

## Start

→ [p6/AGENT-START.md](p6/AGENT-START.md) · **first task:** `P6-0-N-001`

## Umbrella

→ [platform-denali-first-customer.mdoc](platform-denali-first-customer.mdoc)

## Prerequisite

P5 complete (`P5-B-N-016`). P6 does not change P5.

## Three apps

| App | Host (dev) |
| --- | ---------- |
| `apps/marketing` | `shop.{club}.localhost:3002` |
| `apps/portal` | `{club}.localhost:3003` |
| `apps/web` admin | `{club}.localhost:3000` |

## EPICs (order)

| EPIC | Doc | Nanos | Priority |
| ---- | --- | ----- | -------- |
| P6-0 | [p6-0-host-subdomain.md](p6/p6-0-host-subdomain.md) | 8 | Subdomain + tenant |
| P6-1 | [p6-1-guest-slice.md](p6/p6-1-guest-slice.md) | 14 | **Browse → register** |
| P6-2 | [p6-2-operator-admin.md](p6/p6-2-operator-admin.md) | 16 | Full admin |
| P6-3 | [p6-3-member-portal.md](p6/p6-3-member-portal.md) | 10 | `/me` + receipt |
| P6-4 | [p6-4-exit-gate.md](p6/p6-4-exit-gate.md) | 8 | Gate + staging |

## Progress

→ [p6/DOC-SYNC-INDEX.md](p6/DOC-SYNC-INDEX.md) · [p6/p6-exit-checklist.md](p6/p6-exit-checklist.md)

## Superseded (v1.0)

Old EPIC ids `P6-A` … `P6-D` replaced in v2.0 — see `DOC-SYNC-INDEX.yaml` `deprecated_epics`.
