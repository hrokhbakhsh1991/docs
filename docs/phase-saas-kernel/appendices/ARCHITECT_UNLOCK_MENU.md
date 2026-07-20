# Architect Unlock Menu — copy one line to continue

```yaml
doc_id: ARCHITECT_UNLOCK_MENU
status: ACTIVE
tip: e40dd92a
branch: booking/capacity-concurrency-cert
as_of: 2026-07-21
```

## Active unlocks

| Unlock | Status |
| ------ | ------ |
| `YES — IMPL-SK2.C` | **DONE** — `registration.approved` / `in_app` — [SK2_C_IMPLEMENTATION.md](./SK2_C_IMPLEMENTATION.md) |
| `YES — IMPL-SK3-FLAGS` | **DONE** — `inAppRegistrationApprovedNotify` — [SK3_FLAGS_IMPLEMENTATION.md](./SK3_FLAGS_IMPLEMENTATION.md) |

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

Moves or PRs `origin/DEV` → tip after B6 decision. See [STABILIZATION_B6_DEV_ASYMMETRY_DECISION.md](../../phase-20/p7/appendices/STABILIZATION_B6_DEV_ASYMMETRY_DECISION.md).

```text
YES — STASH-RECLAIM-{n}
```

`{n}` = stash index `0`–`9`. See [STABILIZATION_B7_STASH_QUARANTINE.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_QUARANTINE.md). Never auto-pop `stash@{3}`.

```text
YES — IMPL-PORTAL-MODAL
```

Reclaim portal login modal from `wip/portal-psc-20260718` @ `25f995c7` (C9). See [STABILIZATION_C9_C10_PARKED.md](../../phase-20/p7/appendices/STABILIZATION_C9_C10_PARKED.md).

```text
YES — FULL-MONOREPO-BUILD
```

Optional honesty gap only — full `pnpm build` never run on this train; WP4 remains deferred_clear until this unlock.

---

## Already closed (do not re-open as “continue”)

| ID | Status |
| -- | ------ |
| A1–A3 doc truth | DONE (re-sync this menu) |
| B4 targeted build / B5 capacity stress | DONE |
| B6 DEV asymmetry decision | DECIDED (no merge) |
| B7 stash quarantine ledger | DONE |
| C8 prodlike capacityMax fail-closed | DONE |
| C9 / C10 | PARKED with tickets |
| Kernel design SK0–SK4 | DESIGN_COMPLETE |
| **IMPL-SK2.C** | **DONE** (`registration.approved` / `in_app`) |
| **IMPL-SK3-FLAGS** | **DONE** (`inAppRegistrationApprovedNotify`) |

## Forbidden without unlock

- Hollow `packages/notification-*` / entitlement / file packages  
- Blind `git merge origin/DEV`  
- `git stash pop` / apply  
- Full `phase-*:gate` without YES  
- Speculative Kernel IMPL from «ادامه بده» alone  
