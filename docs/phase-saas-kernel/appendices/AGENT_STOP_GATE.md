# Agent Stop Gate — Kernel Design Complete

```yaml
doc_id: KERNEL_AGENT_STOP_GATE
status: ACTIVE
tip: fd54e6ca
branch: booking/capacity-concurrency-cert
synced_with_origin: true
as_of: 2026-07-21
```

## Verdict

**Stabilization (incl. B4–C10) + Kernel design (SK0–SK4) are complete and pushed.**  
Further agent work on this train **must not** invent implementation without an Architect trigger.

**Single copy-paste menu:** [ARCHITECT_UNLOCK_MENU.md](./ARCHITECT_UNLOCK_MENU.md)

## Do

| Action | Allowed? |
| ------ | -------- |
| Read / explain Kernel docs | Yes |
| Fix broken links / typos / tip SHA drift in Kernel + Stabilization docs | Yes (docs-only) |
| Start `IMPL-SK*` / portal modal / DEV pointer / stash reclaim | **Only** after matching Architect `YES — …` |
| Create empty notification/entitlement/file packages | **No** |
| Blind merge `origin/DEV` | **No** |
| Auto `git stash pop` | **No** |
| Full phase gates without YES | **No** |

## If the user says «ادامه بده» without an unlock

1. **Do not** speculative-code Kernel packages or reclaim WIP/stashes.  
2. Point to [ARCHITECT_UNLOCK_MENU.md](./ARCHITECT_UNLOCK_MENU.md).  
3. Docs-only truth sync is still allowed when tip/residual tables are stale.

## Architect unlock (abbreviated — full menu wins)

```text
YES — IMPL-SK2.C | YES — IMPL-SK3-FLAGS | YES — IMPL-SK3-BP7
YES — IMPL-SK4-OBJ | YES — IMPL-SK4-AUDIT | YES — IMPL-INGRESS-RENAME
YES — DEV-POINTER | YES — STASH-RECLAIM-{n} | YES — IMPL-PORTAL-MODAL
YES — FULL-MONOREPO-BUILD
```

## SoT

- Charter: [`../CHARTER.md`](../CHARTER.md) (`DESIGN_COMPLETE`)
- Backlog: [IMPLEMENTATION_BACKLOG.md](./IMPLEMENTATION_BACKLOG.md)
- Train ledger: [TRAIN_CLOSURE_CHECKLIST.md](./TRAIN_CLOSURE_CHECKLIST.md)
- Open work: [OPEN_WORK_LEDGER.md](./OPEN_WORK_LEDGER.md)

---

*Stop gate ACTIVE. Prefer unlock menu over improvisation.*
