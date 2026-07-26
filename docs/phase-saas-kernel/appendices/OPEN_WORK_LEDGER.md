# Open Work Ledger (truth-synced)

```yaml
doc_role: temporary_work_ledger
created: 2026-07-21
updated: 2026-07-21
tip: e4e58665
canonical_branch: booking/capacity-concurrency-cert
```

Status legend: `DONE` · `PARTIAL` · `OPEN` · `BLOCKED_ON_ARCHITECT` · `PARKED` · `DECIDED`

**Unlock menu:** [ARCHITECT_UNLOCK_MENU.md](./ARCHITECT_UNLOCK_MENU.md) · **Stop gate:** [AGENT_STOP_GATE.md](./AGENT_STOP_GATE.md)

## A — Doc truth

| ID | Item | Status |
| -- | ---- | ------ |
| A1 | TEMP roadmap §2.2 match tip/WT | DONE (re-synced with B6–C10 + tip `9f442601`) |
| A2 | TRAIN_CLOSURE tip SHA | DONE |
| A3 | This ledger | DONE |
| A4 | Stale residual tables (maturity / WP-GATE note / stop gate) | DONE (this sync) |

## B — Stabilization evidence gaps

| ID | Item | Status | Notes |
| -- | ---- | ------ | ----- |
| B4 | Targeted tsc/build for touched packages | **DONE** | tenant-kernel / finance-core build; `@apps/api` tsc --noEmit |
| B5 | `test:booking-capacity-stress` on tip | **DONE** | 3/3 PASS |
| B6 | DEV asymmetry decision (19 behind) | **DONE** | Pointer moved — `YES — DEV-POINTER` → tip `e4e58665` ([STABILIZATION_B6_DEV_POINTER_MOVE.md](../../phase-20/p7/appendices/STABILIZATION_B6_DEV_POINTER_MOVE.md)) |
| B7 | Stash quarantine / reclaim tickets | **DONE** | Tickets `0`–`9` closed — superseded or archaeology NO_LAND; **no stash dropped** ([STABILIZATION_B7_STASH_RECLAIM_9.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_9.md)) |

## C — Hostile / product residuals (P1)

| ID | Item | Status | Notes |
| -- | ---- | ------ | ----- |
| C8 | Tours without `capacityMax` intake fallback | **DONE** | Prodlike/production fail-closed; test fixture path retained |
| C9 | Portal login modal on `wip/portal-psc-*` | **DONE** | `YES — IMPL-PORTAL-MODAL` — [STABILIZATION_C9_PORTAL_MODAL_RECLAIM.md](../../phase-20/p7/appendices/STABILIZATION_C9_PORTAL_MODAL_RECLAIM.md) |
| C10 | Package-boundary allowlist rubber-stamp | **PARKED** | Isolation via AST guards — not a tip code defect |

## D — Kernel implementation

| ID | Item | Status | Notes |
| -- | ---- | ------ | ----- |
| D-SK2.C | NotificationDeliveryPort + first adapter | **DONE** | `registration.approved` / `in_app` — [SK2_C_IMPLEMENTATION.md](./SK2_C_IMPLEMENTATION.md) |
| D-SK3-FLAGS | `inAppRegistrationApprovedNotify` on TenantFeatureFlags | **DONE** | [SK3_FLAGS_IMPLEMENTATION.md](./SK3_FLAGS_IMPLEMENTATION.md) |
| D-SK3-BP7 | Portal member plan tables + apply-plan webhook | **DONE** | `YES — IMPL-SK3-BP7` — [SK3_BP7_IMPLEMENTATION.md](./SK3_BP7_IMPLEMENTATION.md); MPS-ENT §5.2 |
| D-SK4-OBJ | `TenantObjectStoragePort` + shared ACL | **DONE** | `YES — IMPL-SK4-OBJ` — policy `tenant-path-isolation` — [SK4_OBJ_IMPLEMENTATION.md](./SK4_OBJ_IMPLEMENTATION.md) |
| D-* (rest) | Other `IMPL-SK*` rows | BLOCKED_ON_ARCHITECT | Unlock menu — not this continue |

## E — Explicit non-work

- Hollow notification/entitlement/file packages
- Blind `git merge origin/DEV`
- Auto `git stash pop`
- Full `phase-*:gate` without YES
- Kernel IMPL from «ادامه بده» alone

## F — Honesty gaps (optional unlock only)

| ID | Item | Status |
| -- | ---- | ------ |
| F1 | Full monorepo `pnpm build` | **DONE** — `YES — FULL-MONOREPO-BUILD` @ tip `e4e58665` (2026-07-21); `pnpm build` → `BUILD_EXIT=0` (~136s); `guard:artifact-surface` PASS; WP4 honesty gap closed |
