# P8 — API loopback on VPS (Profile B)

```yaml
runbook_id: P8-API-LOOPBACK-VPS
pack: P8
nano: P8-0-N-004
gap: G-ING-05a
proof_tier: DOC
```

## Rule

On the single VPS deploy, **only Next BFF apps** (web · marketing · portal) face the operator/browser. **API listens on loopback** — not as a public ingress target from the internet.

```text
Browser → :3000 / :3002 / :3003  (Profile B IP today)
BFF     → http://127.0.0.1:3001  (TOUR_OPS_API_URL)
```

## Required env

| App | Variable | Value (VPS) |
| --- | -------- | ----------- |
| web | `TOUR_OPS_API_URL` | `http://127.0.0.1:3001` |
| marketing | `TOUR_OPS_API_URL` | `http://127.0.0.1:3001` |
| portal | `TOUR_OPS_API_URL` | `http://127.0.0.1:3001` |

## Not in P8

- Enterprise signed `x-forwarded-host` at edge → **P10** G-ING-05b (after Caddy)
- Public `https://api.*` exposure → optional · BFF loopback sufficient

## Verify

```bash
grep TOUR_OPS_API_URL /etc/app-tour/{web,marketing,portal}.env
curl -fsS http://127.0.0.1:3001/health
```

## References

- [p8-app-fit.md](../p8-app-fit.md)
- [deploy/vps/README.md](../../../deploy/vps/README.md)
