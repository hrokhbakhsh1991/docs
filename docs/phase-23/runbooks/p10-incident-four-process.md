# P10 — Four-process incident runbook (VPS systemd)

```yaml
runbook_id: P10-INCIDENT-FOUR-PROCESS
pack: P10
nano: P10-3-N-001
gap: G-OPS-01
status: ACTIVE
proof_tier: OPS
```

> **Scope:** Single VPS · four systemd units · Profile C edge (Caddy) + loopback apps.  
> **Staging units:** `app-tour-staging-*` · ports `23000–23003` · env `/etc/app-tour-staging/`  
> **Production units:** `app-tour-*` · ports `13000–13003` (or `3000–3003` Profile C loopback)

---

## Quick reference

| Unit | Prod port | Staging port | Health (loopback) |
| ---- | --------- | ------------ | ----------------- |
| `*-api` | 3001 / 13001 | 23001 | `curl http://127.0.0.1:<port>/health` |
| `*-web` | 3000 / 13000 | 23000 | `curl http://127.0.0.1:<port>/auth/login` |
| `*-marketing` | 3002 / 13002 | 23002 | `curl http://127.0.0.1:<port>/health` |
| `*-portal` | 3003 / 13003 | 23003 | `curl http://127.0.0.1:<port>/health` |

Post-deploy smoke:

```bash
ENV_DIR=/etc/app-tour bash scripts/vps-deploy/smoke-four-process.sh
# staging: ENV_DIR=/etc/app-tour-staging
```

Remote from laptop:

```bash
VPS_HOST=<ip> pnpm run p10:staging-remote-smoke
```

---

## Units (restart order)

1. `app-tour-api` / `app-tour-staging-api`
2. `app-tour-web` / `app-tour-staging-web`
3. `app-tour-marketing` / `app-tour-staging-marketing`
4. `app-tour-portal` / `app-tour-staging-portal`

Edge: **Caddy** (`:80`/`:443`) — restart after apps if Host routing fails.

---

## INC-01 — Single unit down

```bash
UNIT=app-tour-staging-api   # or app-tour-api
sudo systemctl status "$UNIT"
sudo journalctl -u "$UNIT" -n 100 --no-pager
sudo systemctl restart "$UNIT"
ENV_DIR=/etc/app-tour-staging bash /opt/app-tour-staging/scripts/vps-deploy/smoke-four-process.sh
```

---

## INC-02 — All apps down after deploy

```bash
sudo systemctl restart app-tour-staging-api app-tour-staging-web \
  app-tour-staging-marketing app-tour-staging-portal
sudo systemctl reload caddy 2>/dev/null || sudo systemctl restart caddy 2>/dev/null || true
ENV_DIR=/etc/app-tour-staging bash /opt/app-tour-staging/scripts/vps-deploy/smoke-four-process.sh \
  || bash /opt/app-tour-staging/scripts/vps-deploy/rollback-vps.sh
```

---

## INC-03 — Caddy down (Profile C)

```bash
sudo systemctl status caddy
sudo journalctl -u caddy -n 80 --no-pager
caddy validate --config /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

Profile B IP (`:23000` etc.) may still work while edge is down.

---

## INC-04 — Edge OK but HTTPS 502

- Apps must answer on loopback ports from `/etc/caddy/caddy.env` (`WEB_PORT`, etc.)
- `TOUR_OPS_API_URL=http://127.0.0.1:<api-port>` in all four env files
- `ss -tln | grep 127.0.0.1`

---

## INC-05 — Port conflict

```bash
bash scripts/vps-deploy/stop-stale-listeners.sh
ENV_DIR=/etc/app-tour-staging bash scripts/vps-deploy/show-infra-profile.sh /etc/app-tour-staging/api.env
```

---

## INC-06 — Postgres unavailable

```bash
sudo systemctl status postgresql
bash scripts/vps-deploy/verify-db-env.sh /etc/app-tour-staging/api.env
```

Do not restart Caddy alone — fix DB first. API `/health` returns degraded when DB is down.

---

## INC-07 — Disk / OOM

```bash
df -h /
journalctl -k | tail -20
sudo systemctl restart app-tour-staging-api app-tour-staging-web \
  app-tour-staging-marketing app-tour-staging-portal
```

---

## Escalation

| Level | When |
| ----- | ---- |
| L1 | Single unit — restart + smoke |
| L2 | All four down or deploy fail — rollback-vps.sh |
| L3 | TLS/DNS — cert renewal runbook · DNS provider |

---

## References

- [p10-production-profile.yaml](../p10-production-profile.yaml)
- [deploy/vps/caddy/README.md](../../../deploy/vps/caddy/README.md)
- [deploy/vps/systemd/](../../../deploy/vps/systemd/)
