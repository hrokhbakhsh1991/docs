# Architect Unlock Menu — copy one line to continue

```yaml
doc_id: ARCHITECT_UNLOCK_MENU
status: ACTIVE
tip: e4e58665
branch: booking/capacity-concurrency-cert
as_of: 2026-07-21
```

## Active unlocks

| Unlock | Status |
| ------ | ------ |
| `YES — IMPL-SK2.C` | **DONE** — `registration.approved` / `in_app` — [SK2_C_IMPLEMENTATION.md](./SK2_C_IMPLEMENTATION.md) |
| `YES — IMPL-SK3-FLAGS` | **DONE** — `inAppRegistrationApprovedNotify` — [SK3_FLAGS_IMPLEMENTATION.md](./SK3_FLAGS_IMPLEMENTATION.md) |
| `YES — FULL-MONOREPO-BUILD` | **DONE** — tip `e4e58665`; `pnpm build` `BUILD_EXIT=0` (~136s); `guard:artifact-surface` PASS |
| `YES — IMPL-PORTAL-MODAL` | **DONE** — C9 modal reclaim (modal-only) — [STABILIZATION_C9_PORTAL_MODAL_RECLAIM.md](../../phase-20/p7/appendices/STABILIZATION_C9_PORTAL_MODAL_RECLAIM.md) |
| `YES — DEV-POINTER` | **DONE** — `origin/DEV` → tip `e4e58665` — [STABILIZATION_B6_DEV_POINTER_MOVE.md](../../phase-20/p7/appendices/STABILIZATION_B6_DEV_POINTER_MOVE.md) |
| `YES — STASH-RECLAIM-0` | **DONE** — superseded on tip; stash kept — [STABILIZATION_B7_STASH_RECLAIM_0.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_0.md) |
| `YES — STASH-RECLAIM-1` | **DONE** — superseded on tip; stash kept — [STABILIZATION_B7_STASH_RECLAIM_1.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_1.md) |
| `YES — STASH-RECLAIM-2` | **DONE** — superseded on tip; stash kept — [STABILIZATION_B7_STASH_RECLAIM_2.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_2.md) |
| `YES — STASH-RECLAIM-3` | **DONE** — archaeology only; **no land**; stash kept — [STABILIZATION_B7_STASH_RECLAIM_3.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_3.md) |
| `YES — STASH-RECLAIM-4` | **DONE** — superseded CI hygiene; stash kept — [STABILIZATION_B7_STASH_RECLAIM_4.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_4.md) |
| `YES — STASH-RECLAIM-5` | **DONE** — archaeology NO_LAND; stash kept — [STABILIZATION_B7_STASH_RECLAIM_5.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_5.md) |
| `YES — STASH-RECLAIM-6` | **DONE** — superseded guest-shell WIP; stash kept — [STABILIZATION_B7_STASH_RECLAIM_6.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_6.md) |
| `YES — STASH-RECLAIM-7` | **DONE** — archaeology NO_LAND; stash kept — [STABILIZATION_B7_STASH_RECLAIM_7.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_7.md) |
| `YES — STASH-RECLAIM-8` | **DONE** — superseded P4 spike; stash kept — [STABILIZATION_B7_STASH_RECLAIM_8.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_8.md) |
| `YES — STASH-RECLAIM-9` | **DONE** — superseded; **B7 0–9 complete**; stash kept — [STABILIZATION_B7_STASH_RECLAIM_9.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_9.md) |
| `YES — IMPL-SK3-BP7` | **DONE** — plan tables + apply-plan webhook — [SK3_BP7_IMPLEMENTATION.md](./SK3_BP7_IMPLEMENTATION.md) |
| `YES — IMPL-SK4-OBJ` | **DONE** — `tenant-path-isolation` ACL + `TenantObjectStoragePort` — [SK4_OBJ_IMPLEMENTATION.md](./SK4_OBJ_IMPLEMENTATION.md) |

All other menu rows remain locked until pasted.

---

## A — Kernel implementation (demand-driven)

```text
YES — IMPL-SK2.C
first_event: <domain event or user action>
channel: email | sms | in_app
owner: <name>
```

```text
YES — IMPL-SK3-FLAGS
flags: <comma-separated TenantFeatureFlags keys>
```

```text
YES — IMPL-SK3-BP7
```

```text
YES — IMPL-SK4-OBJ
shared_policy: <ACL or lifecycle rule across blob families>
```

```text
YES — IMPL-SK4-AUDIT
streams_to_unify: <e.g. tour+settings>
```

```text
YES — IMPL-INGRESS-RENAME
```

## B — Process / reclaim (not Kernel design)

```text
YES — DEV-POINTER
```

**DONE (2026-07-21).** `origin/DEV` force-with-lease moved to tip `e4e58665`. See [STABILIZATION_B6_DEV_POINTER_MOVE.md](../../phase-20/p7/appendices/STABILIZATION_B6_DEV_POINTER_MOVE.md).

```text
YES — STASH-RECLAIM-{n}
```

`{n}` = stash index `0`–`9`. See [STABILIZATION_B7_STASH_QUARANTINE.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_QUARANTINE.md). Never auto-pop `stash@{3}`.

**`YES — STASH-RECLAIM-0` DONE (2026-07-21):** archaeological — tip already had HostIo/WS3 intent; **no apply / no drop**. [STABILIZATION_B7_STASH_RECLAIM_0.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_0.md).

**`YES — STASH-RECLAIM-1` DONE (2026-07-21):** archaeological — tip past registry isolation WIP; **no apply / no drop**. [STABILIZATION_B7_STASH_RECLAIM_1.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_1.md).

**`YES — STASH-RECLAIM-2` DONE (2026-07-21):** archaeological — payment-port Option C already on tip; **no apply / no drop**. [STABILIZATION_B7_STASH_RECLAIM_2.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_2.md).

**`YES — STASH-RECLAIM-3` DONE (2026-07-21):** hard-quarantine archaeology — **no apply / no drop / no orphan TSX land**. [STABILIZATION_B7_STASH_RECLAIM_3.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_3.md).

**`YES — STASH-RECLAIM-4` DONE (2026-07-21):** CI/guard hygiene already on tip; **no apply / no drop**. [STABILIZATION_B7_STASH_RECLAIM_4.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_4.md).

**`YES — STASH-RECLAIM-5` DONE (2026-07-21):** hero-3d archaeology — tip SoT is hero-static; **no apply / no drop**. [STABILIZATION_B7_STASH_RECLAIM_5.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_5.md).

**`YES — STASH-RECLAIM-6` DONE (2026-07-21):** guest-shell design-tokens already on tip; **no apply / no drop**. [STABILIZATION_B7_STASH_RECLAIM_6.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_6.md).

**`YES — STASH-RECLAIM-7` DONE (2026-07-21):** draft-era 372-file WIP — **no apply / no drop**. [STABILIZATION_B7_STASH_RECLAIM_7.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_7.md).

**`YES — STASH-RECLAIM-8` DONE (2026-07-21):** P4 club-product/gate spike already on tip; **no apply / no drop**. [STABILIZATION_B7_STASH_RECLAIM_8.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_8.md).

**`YES — STASH-RECLAIM-9` DONE (2026-07-21):** Denali isolate WIP already on tip; **B7 reclaim series 0–9 complete**; **no apply / no drop**. [STABILIZATION_B7_STASH_RECLAIM_9.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_RECLAIM_9.md).

```text
YES — IMPL-PORTAL-MODAL
```

**DONE (2026-07-21).** Modal-only reclaim from `wip/portal-psc-20260718` @ `25f995c7` onto capacity tip — see [STABILIZATION_C9_PORTAL_MODAL_RECLAIM.md](../../phase-20/p7/appendices/STABILIZATION_C9_PORTAL_MODAL_RECLAIM.md). Finance/header/middleware from that WIP snapshot remain out of scope.

```text
YES — FULL-MONOREPO-BUILD
```

**DONE (2026-07-21).** Evidence: Architect unlock pasted; tip `e4e58665`; `pnpm build` (`scripts/monorepo-build.sh`) completed with `BUILD_EXIT=0` in ~136s; postbuild `guard:artifact-surface` PASS. WP4 honesty gap closed — full monorepo production build is proven on this train.

---

## Already closed (do not re-open as “continue”)

| ID | Status |
| -- | ------ |
| A1–A3 doc truth | DONE (re-sync this menu) |
| B4 targeted build / B5 capacity stress | DONE |
| B6 DEV asymmetry decision | DECIDED (no merge) |
| B7 stash quarantine ledger | DONE |
| C8 prodlike capacityMax fail-closed | DONE |
| C9 portal modal | **DONE** (`YES — IMPL-PORTAL-MODAL`) |
| **DEV-POINTER (B6)** | **DONE** (`origin/DEV` @ `e4e58665`) |
| **STASH-RECLAIM-0** | **DONE** (superseded; stash retained) |
| **STASH-RECLAIM-1** | **DONE** (superseded; stash retained) |
| **STASH-RECLAIM-2** | **DONE** (superseded; stash retained) |
| **STASH-RECLAIM-3** | **DONE** (archaeology; no land; stash retained) |
| **STASH-RECLAIM-4** | **DONE** (superseded; stash retained) |
| **STASH-RECLAIM-5** | **DONE** (archaeology; no land; stash retained) |
| **STASH-RECLAIM-6** | **DONE** (superseded; stash retained) |
| **STASH-RECLAIM-7** | **DONE** (archaeology; no land; stash retained) |
| **STASH-RECLAIM-8** | **DONE** (superseded; stash retained) |
| **STASH-RECLAIM-9** | **DONE** (superseded; B7 0–9 complete; stash retained) |
| C10 | PARKED with ticket |
| Kernel design SK0–SK4 | DESIGN_COMPLETE |
| **IMPL-SK2.C** | **DONE** (`registration.approved` / `in_app`) |
| **IMPL-SK3-FLAGS** | **DONE** (`inAppRegistrationApprovedNotify`) |
| **FULL-MONOREPO-BUILD (F1 / WP4)** | **DONE** (`pnpm build` PASS @ `e4e58665`) |

## Forbidden without unlock

- Hollow `packages/notification-*` / entitlement / file packages  
- Blind `git merge origin/DEV`  
- `git stash pop` / apply  
- Full `phase-*:gate` without YES  
- Speculative Kernel IMPL from «ادامه بده» alone  
