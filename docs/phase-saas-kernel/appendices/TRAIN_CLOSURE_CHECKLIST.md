# Stabilization → Kernel train closure checklist

```yaml
doc_id: STABILIZATION_KERNEL_TRAIN_CLOSURE
as_of: 2026-07-20
tip_at_authoring: 92bf78be
```

## Stabilization

- [x] WP0 DEV reconcile filed (no blind merge)
- [x] WP1–WP3 hostile P0 train landed
- [x] WP4 deferred_clear (no blocker)
- [x] WP5 import-boundary green
- [x] WP-GATE ACCEPTED
- [x] Capacity postgres proof re-run PASS (close train)

## Kernel

- [x] `docs/phase-saas-kernel/` opened
- [x] SK0 maturity inventory
- [x] SK1 CLOSED (design + README + freeze spec + guards)
- [x] SK2 design filed + outbox README
- [x] SK3 design filed (flags / modules / portal entitlements)
- [ ] SK2.C first notification adapter (demand-driven — **not** hollow)
- [ ] SK3 implementation (BP-7 plans / new flag fields) — demand-driven
- [ ] SK4 Audit + File design/impl — demand-driven

## Explicitly parked (not forgotten)

| Item | Why parked |
| ---- | ---------- |
| Push tip | **Done** — `origin/booking/capacity-concurrency-cert` @ `d66682de`+ |
| Portal login modal WIP | Product ticket on `wip/portal-psc-20260718` |
| API `tenant-kernel` rename | High churn; SK1 deferred |
| Empty `packages/notification-*` | Forbidden until SK2.C |

---

*Use this as the “nothing left behind” ledger for the Stabilization→Kernel handoff.*

## Remote

- [x] Pushed to `origin/booking/capacity-concurrency-cert`

