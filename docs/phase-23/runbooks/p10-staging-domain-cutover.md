# P10 — Staging domain cutover (Profile C HTTPS)

**Nano:** P10-1-N-001 · P10-1-N-002  
**Blocker today:** `PLATFORM_ROOT_DOMAIN=staging.example.com` placeholder — ACME cannot issue for example.com.

## Prerequisites

| Item | Example |
| ---- | ------- |
| Apex domain you control | `staging.yourclub.ir` |
| DNS A records | `*.staging.yourclub.ir` → VPS IP (`89.45.89.206`) |
| ACME email | `ops@yourclub.ir` |
| VPS path | `/opt/app-tour-staging` |
| Env dir | `/etc/app-tour-staging` |

Wildcard `*.apex` is required for `operator.admin.apex`, `operator.portal.apex`, and `operator.apex` in the current Caddyfile.

## 1 — DNS (before touching VPS)

```bash
dig +short operator.admin.staging.yourclub.ir
# must return VPS IP
```

## 2 — App env (all four files)

Set on VPS in `/etc/app-tour-staging/{api,web,marketing,portal}.env`:

```env
PLATFORM_ROOT_DOMAIN=staging.yourclub.ir
TENANT_ROOT_DOMAIN=staging.yourclub.ir
SESSION_COOKIE_SECURE=true
```

Keep `TOUR_OPS_API_URL=http://127.0.0.1:23001` (staging ports).

Restart four-process units after edit:

```bash
systemctl restart app-tour-staging-{api,web,marketing,portal}
```

## 3 — Caddy install / re-render

On VPS:

```bash
cd /opt/app-tour-staging
ENV_DIR=/etc/app-tour-staging \
  PLATFORM_ROOT_DOMAIN=staging.yourclub.ir \
  CADDY_ACME_EMAIL=ops@yourclub.ir \
  DEPLOY_PATH=/opt/app-tour-staging \
  bash scripts/vps-deploy/install-caddy-profile-c.sh
```

Confirm:

```bash
source /etc/caddy/caddy.env
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl is-active caddy
```

## 4 — Loopback smoke (must stay green)

```bash
ENV_DIR=/etc/app-tour-staging bash /opt/app-tour-staging/scripts/vps-deploy/smoke-four-process.sh
```

From laptop:

```bash
VPS_HOST=89.45.89.206 pnpm run p10:vps-smoke
```

## 5 — HTTPS edge smoke (closes P10-1-N-001)

```bash
PLATFORM_ROOT_DOMAIN=staging.yourclub.ir CLUB_LABEL=operator pnpm run p10:profile-c-edge-smoke
```

Expect `P10_PROFILE_C_EDGE_OK` for admin login, portal `/health`, marketing `/health`.

## 6 — Full staging gate

```bash
VPS_HOST=89.45.89.206 pnpm run p10:staging-gate
```

## Rollback

Profile B (IP HTTP on `23000–23003`) remains available — see [p10-incident-four-process.md](./p10-incident-four-process.md).

## After cutover (Wave C)

- P10-0-N-003 — second club (`alborz.*`) — [p10-second-club-onboarding.md](./p10-second-club-onboarding.md)
- P10-0-N-002 — `on_demand_tls` ask endpoint — only after wildcard HTTPS proven
- P10-2-N-006 — M+P custom apex E2E

## Common failures

| Symptom | Fix |
| ------- | --- |
| ACME invalid email | Real `CADDY_ACME_EMAIL` |
| Certificate not issued | DNS wildcard not pointing to VPS |
| `curl` HTTPS 000 | Caddy down or wrong `PLATFORM_ROOT_DOMAIN` in `caddy.env` |
| Session lost after HTTPS | `SESSION_COOKIE_SECURE=true` on all four env files |
