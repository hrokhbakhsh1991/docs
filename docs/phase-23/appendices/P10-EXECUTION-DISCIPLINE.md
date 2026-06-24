# P10 — Execution discipline

```yaml
discipline_id: P10-EXECUTION-DISCIPLINE
pack_version: "1.0"
status: NORMATIVE
```

> **Rule:** **Profile C HTTPS on staging** before custom apex polish · **never** deprecate Profile B in P10.

---

## Execution order (waves — no skip)

```text
Wave A — wildcard Caddy + smoke 4/4 + GHA hook + incident runbook
Wave B — build align · env regression · cookie/headers · cert · rollback · M+P apex path doc
Wave C — on_demand_tls · second club runbook · custom E2E · README · p10:gate
```

**Blocked until:** `pnpm run p9:gate` green (web no public-auth · M+P guest-surface-host).

---

## Doc-first

| Touch | Required |
| ----- | -------- |
| `deploy/vps/` edge | `docs/phase-23/` + runbooks |
| `apps/api` TLS ask route | markdoc + gap registry |
| `.github/workflows` deploy | p10-action-plan.yaml sync |

---

## Forbidden

```text
❌ Start P10 before p9:gate green
❌ on_demand_tls before wildcard staging HTTPS proven
❌ admin.{customer_apex} as P10 exit P0
❌ Deprecate Profile B IP path in deploy/vps/README
❌ health-check 2/4 as exit sufficient
❌ Require live second production customer
❌ SMS RESEND · k8s prometheus as P10 infra gates
❌ Public https://api.* mandatory
❌ Re-implement P8 4-file env when P8 closed (regression only)
❌ Claim P10 exit from p10:gate without Profile C curl/smoke evidence
❌ guest-surface-host / session-client rework (P9 scope)
```

---

## Wave A blockers (no skip)

| Nano | Why |
| ---- | --- |
| P10-1-N-001 | No HTTPS smoke without edge |
| P10-2-N-001 | remote-deploy today 2/4 |
| P10-2-N-002 | Deploy green ≠ production safe |
| P10-3-N-001 | Ops sign-off needs 4-unit playbook |

---

## Proof escalation

```text
DOC → DEV_STATIC → PROFILE_C → OPS → REGRESSION
```

Exit requires **PROFILE_C + OPS** on staging — not DEV_STATIC alone.

---

## References

- [p10-app-fit.md](../p10-app-fit.md)
- [P10-ANTI-HOLLOW-CONTRACT.md](P10-ANTI-HOLLOW-CONTRACT.md)
- [../../POST-P7-PACK-ALIGNMENT.md](../../POST-P7-PACK-ALIGNMENT.md)
