# Stabilization → Kernel train closure checklist

```yaml
doc_id: STABILIZATION_KERNEL_TRAIN_CLOSURE
as_of: 2026-07-21
tip_at_authoring: e40dd92a
```

## Stabilization

- [x] WP0 DEV reconcile filed (no blind merge)
- [x] B6 DEV asymmetry **DECIDED** (no merge; tip canonical)
- [x] B7 stash quarantine ledger filed (10 stashes)
- [x] WP1–WP3 hostile P0 train landed
- [x] C8 capacityMax prodlike fail-closed (intake not ceiling)
- [x] C9/C10 parked residuals filed
- [x] WP4 deferred_clear (no blocker)
- [x] WP5 import-boundary green
- [x] WP-GATE ACCEPTED
- [x] Capacity postgres proof re-run PASS (close train)
- [x] Capacity **stress** PASS on tip (2026-07-21)
- [x] Targeted package build + API tsc PASS (2026-07-21; not full monorepo `pnpm build`)

## Kernel

- [x] `docs/phase-saas-kernel/` opened
- [x] SK0 maturity inventory
- [x] SK1 CLOSED (design + README + freeze spec + guards)
- [x] SK2 design filed + outbox README
- [x] SK3 design filed (flags / modules / portal entitlements)
- [x] SK2.C first notification adapter (`registration.approved` / `in_app`)
- [x] SK3-FLAGS `inAppRegistrationApprovedNotify` (SK2.C gate)
- [x] SK4 design filed (audit streams + file vs tour-storage)
- [ ] SK3-BP7 plan tables / webhooks — demand-driven
- [ ] SK4.C audit port extraction — demand-driven (`YES — IMPL-SK4-AUDIT`)
- [x] SK4.D object port — `YES — IMPL-SK4-OBJ` (`tenant-path-isolation`) — [SK4_OBJ_IMPLEMENTATION.md](./SK4_OBJ_IMPLEMENTATION.md)

## Implementation gate

- [x] [IMPLEMENTATION_BACKLOG.md](./IMPLEMENTATION_BACKLOG.md) filed — no impl without trigger
- [x] [ARCHITECT_UNLOCK_MENU.md](./ARCHITECT_UNLOCK_MENU.md) filed — single copy-paste surface
- [x] [AGENT_STOP_GATE.md](./AGENT_STOP_GATE.md) ACTIVE (covers «ادامه بده» without unlock)

## Explicitly parked (not forgotten)

| Item | Why parked |
| ---- | ---------- |
| Push tip | **Done** — synced @ `9f442601` |
| Portal login modal WIP (C9) | **DONE** — modal-only reclaim ([STABILIZATION_C9_PORTAL_MODAL_RECLAIM.md](../../phase-20/p7/appendices/STABILIZATION_C9_PORTAL_MODAL_RECLAIM.md)) |
| Package-boundary allowlist (C10) | AST isolation, not package.json equality |
| `origin/DEV` pointer → tip | **DONE** — [STABILIZATION_B6_DEV_POINTER_MOVE.md](../../phase-20/p7/appendices/STABILIZATION_B6_DEV_POINTER_MOVE.md) |
| Stash reclaim (B7) | **DONE** — `0`–`9` closed (superseded / NO_LAND); stashes retained |
| Full monorepo `pnpm build` | **DONE** — `YES — FULL-MONOREPO-BUILD` @ `e4e58665`; `BUILD_EXIT=0` (~136s) |
| API `tenant-kernel` rename | Needs `YES — IMPL-INGRESS-RENAME` |
| Empty `packages/notification-*` | Forbidden until SK2.C |

---

*Use this as the “nothing left behind” ledger for the Stabilization→Kernel handoff.*

## Remote

- [x] Pushed to `origin/booking/capacity-concurrency-cert`

## Truth sync (2026-07-21)

- [x] TEMP roadmap §2.2 corrected (B6–C10 + tip)
- [x] B4 targeted build evidence
- [x] B5 capacity-stress evidence (3/3 PASS)
- [x] B6 DEV asymmetry decision filed
- [x] B7 stash quarantine ledger filed
- [x] C8 prodlike fail-closed for missing tour `capacityMax`
- [x] C9/C10 parked residuals filed
- [x] Unlock menu + stop gate expanded
- [x] Tip SHA on this checklist → `9f442601`
