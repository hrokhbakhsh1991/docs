# P6 Agent — start here

```yaml
phase: P6
pack_version: "2.0"
current_task: P6-0-N-001
nano_done: 0
exit_nano: P6-4-N-008
milestone_guest_slice: P6-1-N-014
prerequisite: P5-B-N-016 complete
doc_sot: docs/phase-19/platform-denali-first-customer.mdoc
```

## What P6 is

**First Denali club customer** — three separate apps, guest journey first.

| Priority | EPIC | Goal |
| -------- | ---- | ---- |
| 1 | P6-0 | Subdomain + same tenant across apps |
| 2 | P6-1 | **Guest: browse → register** (`GUEST_SLICE_OK`) |
| 3 | P6-2 | Full admin Denali (bookings · finance · wizard fixes) |
| 4 | P6-3 | Member `/me` + receipt upload |
| 5 | P6-4 | Full vertical slice + `p6:gate` |

## Three apps + hosts

| App | Role | Dev example |
| --- | ---- | ----------- |
| `apps/marketing` | Public catalog | `shop.operator.localhost:3002` |
| `apps/portal` | User register (+ later `/me`) | `operator.localhost:3003` |
| `apps/web` | Admin operator | `operator.localhost:3000` |

Prod: `shop.{club}` · `{club}.portal` · `{club}.admin`

## Read order (before UI code)

1. [platform-denali-first-customer.mdoc](../platform-denali-first-customer.mdoc)
2. **[p6-implementation-standards.mdoc](../p6-implementation-standards.mdoc)** — same stack as admin Denali
3. [AGENT-CONTEXT.md](AGENT-CONTEXT.md) · [p6-denali-safety.md](p6-denali-safety.md)
4. [DOC-SYNC-INDEX.md](DOC-SYNC-INDEX.md) · current EPIC spec

## Loop

```text
DOC-SYNC current_task
  → doc-first (phase-19 mdoc)
  → ONE nano
  → guard:p3-denali-covenant
  → nano Verify
  → update DOC-SYNC + p6-exit-checklist.md
```

## EPIC order (strict)

```text
P6-0 → P6-1 → P6-2 ──┐
              P6-3 ──┴→ P6-4
```

Do **not** start P6-2 admin polish until **P6-1-N-014** (`GUEST_SLICE_OK`).

First task: **P6-0-N-001** — host/subdomain map doc.

Spec: [p6-0-host-subdomain.md](p6-0-host-subdomain.md)
