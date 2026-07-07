# P7 — Staging gate composition (T1 + infra + T3)

```yaml
runbook_id: P7-STAGING-GATE
nano: P7-3-N-003
decision: DEC-P7-011
authority: p7-3-delivery-exit.md · scripts/p7-staging-gate.sh
```

> **T1 every PR:** `pnpm run p7:gate`  
> **Staging closure:** `pnpm run p7:staging-gate` (this doc)  
> **Full browser T2:** [p7-staging-e2e.md](p7-staging-e2e.md) (manual / CI dispatch)

---

## Command

```bash
# Profile B VPS (API on loopback :3001)
export TOUR_OPS_API_URL=http://127.0.0.1:3001
export DATABASE_URL=postgresql://app_tour:...@127.0.0.1:5433/tour_db_prod   # optional T3

pnpm run p7:staging-gate
# → P7_STAGING_GATE_OK
```

---

## Composition (frozen — DEC-P7-011)

| Step | Script | Tier | Skip when |
| ---- | ------ | ---- | --------- |
| 1 | `pnpm run p7:gate` | T1 | never |
| 2 | `verify-env-coherence.sh` | infra | no `/etc/app-tour/*.env` |
| 3 | `smoke-p6-host-bind.mjs` | infra | API unreachable |
| 4 | marketing/portal `/health` | infra | env files missing |
| 5 | `finance-ops.spec.ts` | T3 | `DATABASE_URL` unset |

Steps 2–4 run inside `p7:staging-verify`. Step 5 runs in `p7-staging-gate.sh`.

**T2 (Playwright)** is **not** in this gate — run [p7-staging-e2e.md](p7-staging-e2e.md) before T4 sign-off.

---

## When to run

| Context | Command |
| ------- | ------- |
| Every PR | `pnpm run p7:gate` only |
| After VPS deploy / env change | `pnpm run p7:staging-gate` |
| Pre customer sign-off | `p7:staging-gate` + `p7-staging-e2e` + T4 |

---

## References

- [p7-staging-e2e.md](p7-staging-e2e.md)
- [p7-staging-triage.md](p7-staging-triage.md)
- [P7-PORT-MATRIX.md](../appendices/P7-PORT-MATRIX.md)
