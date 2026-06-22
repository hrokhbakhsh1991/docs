# P6 Agent — start here

```yaml
phase: P6
pack_version: "2.1"
status: COMPLETE
current_task: null
nano_done: 58
nano_total: 58
exit_nano: P6-4-N-008
milestone_guest_slice: P6-1-N-014
prerequisite: P5-B-N-016 complete
gate: pnpm run p6:gate
machine_snapshot: AGENT-CURRENT-PHASE.yaml
navigator: ../AGENT-NAVIGATOR.md
doc_sot: docs/phase-19/platform-denali-first-customer.mdoc
addressing_sot: docs/phase-19/p6-host-addressing-architecture.mdoc
```

## Status: P6 closed ✅

All **58 nanos** complete · **VS-08** green. **Do not** re-implement closed work unless `p6:gate` regresses.

```bash
pnpm run p6:gate   # must print P6_DENALI_PRODUCT_GATE_OK
```

For **next step** logic → [../AGENT-NAVIGATOR.md](../AGENT-NAVIGATOR.md) · machine state → [AGENT-CURRENT-PHASE.yaml](AGENT-CURRENT-PHASE.yaml).

---

## What P6 delivered

**First Denali club customer** — three separate apps, full vertical slice.

| EPIC | Outcome |
| ---- | ------- |
| P6-0 | Canonical hosts + same `tenantId` across marketing · portal · admin |
| P6-1 | Guest browse → OTP register (`GUEST_SLICE_OK`) |
| P6-2 | Operator approve booking + receipt (VS-06 · VS-07) |
| P6-3 | Member `/me/registrations` + receipt upload (VS-04 · VS-05) |
| P6-4 | `p6:gate` + exit specs |

## Three apps + hosts

**Runbook:** [runbooks/host-subdomain-map.md](runbooks/host-subdomain-map.md)

| App | Role | Dev (canonical) | Legacy smoke |
| --- | ---- | --------------- | ------------ |
| `apps/marketing` | Public catalog | `operator.localhost:3002` | `shop.operator.localhost:3002` |
| `apps/portal` | User register + `/me` | `operator.portal.localhost:3003` | `operator.localhost:3003` |
| `apps/web` | Admin operator | `operator.admin.localhost:3000` | `operator.localhost:3000` |

**CTA bridge:** `buildDevPortalPublicBaseUrl` in `@app-tour/tenant-kernel` (not per-app duplicate).

## Read order (maintenance / regression)

1. [appendices/IMPLEMENTATION-TRUTH-P6.md](appendices/IMPLEMENTATION-TRUTH-P6.md) — **repo truth first**
2. [platform-denali-vertical-slice.mdoc](../platform-denali-vertical-slice.mdoc) — VS-01..08 steps
3. [AGENT-STATE-MAP-P6.md](AGENT-STATE-MAP-P6.md) — triggers · guards · prove specs
4. [appendices/TRACEABILITY-MATRIX-P6.md](appendices/TRACEABILITY-MATRIX-P6.md) — nano → file → spec
5. [platform-denali-first-customer.mdoc](../platform-denali-first-customer.mdoc) — umbrella
6. [p6-host-addressing-architecture.mdoc](../p6-host-addressing-architecture.mdoc) — host SoT
7. [DOC-SYNC-INDEX.md](DOC-SYNC-INDEX.md) · [p6-exit-checklist.md](p6-exit-checklist.md)

## Agent loop (regression only)

```text
pnpm run p6:gate fails
  → read failing spec name in gate script
  → read matching EPIC nano in p6-{0..4}-*.md
  → doc-first if core change
  → fix · re-run p6:gate
  → do NOT tick checklist backward
```

## EPIC specs (reference)

| EPIC | Doc |
| ---- | --- |
| P6-0 | [p6-0-host-subdomain.md](p6-0-host-subdomain.md) |
| P6-1 | [p6-1-guest-slice.md](p6-1-guest-slice.md) |
| P6-2 | [p6-2-operator-admin.md](p6-2-operator-admin.md) |
| P6-3 | [p6-3-member-portal.md](p6-3-member-portal.md) |
| P6-4 | [p6-4-exit-gate.md](p6-4-exit-gate.md) |
