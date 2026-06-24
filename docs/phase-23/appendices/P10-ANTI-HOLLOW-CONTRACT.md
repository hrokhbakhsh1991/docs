# P10 — Anti-hollow contract (agents)

```yaml
contract_id: P10-ANTI-HOLLOW-CONTRACT
pack_version: "1.0"
fail_token: P10_FAIL
```

> **Rule:** Caddyfile in repo ≠ HTTPS proven on staging hosts. `p10:gate` ≠ Profile C browser smoke.

---

## Proof tier enum

| Tier | Counts toward P10 exit |
| ---- | ---------------------- |
| **DOC** | Partial only |
| **DEV_STATIC** | Partial — pack + scripts exist |
| **PROFILE_C** | Yes — HTTPS staging subdomain |
| **PROFILE_B_REGRESSION** | Required — IP path still documented |
| **OPS** | Yes — runbook + rollback tested |
| **REGRESSION** | p6→p9 chain required |

---

## proves vs does_not_prove

| Check | proves | does_not_prove |
| ----- | ------ | -------------- |
| `p10:gate` | Doc pack + p9 regression | Live cert on customer apex |
| `grep caddy deploy/vps` | Template exists | curl HTTPS 200 |
| health-check api+web only | Partial | 4/4 smoke |
| on-demand TLS day 1 | Over-scope | Wildcard staging first |
| Second prod customer | Not required | Runbook exists |
| Deprecate Profile B | Wrong | Dual mode documented |

---

## Forbidden claims (`P10_FAIL`)

```yaml
forbidden_claims:
  - "P10 complete" without Profile C staging HTTPS smoke
  - "Profile C exit" with only IP :3000-3003
  - admin.{customer_apex} HTTPS as P10 exit requirement
  - on-demand TLS before wildcard staging proven
  - Remove Profile B from deploy/vps/README
  - health-check 2/4 as exit sufficient
  - Require live second production club
  - SMS RESEND as P10 infra gate
  - k8s prometheus on VPS without signed waive
  - Public https://api.* as mandatory
  - p10:gate PASS without smoke-four-process when script exists
  - Start P10 before p9:gate green
  - Re-implement P8 env in P10 when P8 already closed (regression only)
```

---

## Hollow patterns

| Pattern | Valid instead |
| ------- | ------------- |
| Caddy doc only | curl -I https://{club}.admin.{staging_root} |
| smoke-four-process.sh un wired in GHA | deploy-vps post-step |
| rollback script never tested | idempotent dry-run in runbook |
| Enterprise edge signing | loopback trust doc (P8 G-ING-05a) |
| Skip Wave A go to custom apex | wildcard staging first |

---

## References

- [P10-EXECUTION-DISCIPLINE.md](P10-EXECUTION-DISCIPLINE.md)
- [P10-AGENT-TURN-SCHEMA.md](P10-AGENT-TURN-SCHEMA.md)
