# VPS deploy — four-process platform (P10 Profile C + P8 Profile B)

Push to **`main`** → GitHub Actions runs `scripts/vps-deploy/remote-deploy.sh` on the VPS via SSH.

**Four processes:** API · web · marketing · portal — each with its own env file under `/etc/app-tour/`.

## Deployment Profiles

| Profile | Access | TLS | Use Case | Status |
|---------|--------|-----|----------|--------|
| **Profile C** | HTTPS subdomain | ✅ Caddy wildcard | Production-ready | **P10 (current)** |
| **Profile B** | HTTP IP:port | ❌ | First customer delivery | Supported |

### Profile C — HTTPS with Caddy (P10-1-N-001)

**Recommended for production.** Apps bind to `127.0.0.1` (loopback), Caddy reverse-proxies with TLS.

```
https://{club}.admin.{root}   → 127.0.0.1:3000 (web)
https://{club}.portal.{root}  → 127.0.0.1:3003 (portal)
https://{club}.{root}         → 127.0.0.1:3002 (marketing)
API (internal)                → 127.0.0.1:3001
```

**Setup:** See [`caddy/README.md`](caddy/README.md)

**Example:** `https://operator.admin.staging.example.com`

### Profile B — Direct IP HTTP (P7/P8)

**Legacy mode for first customer.** Apps exposed on `0.0.0.0:3000-3003`.

```
http://<VPS_IP>:3000  # web
http://<VPS_IP>:3002  # marketing
http://<VPS_IP>:3003  # portal
http://<VPS_IP>:3001  # api (loopback preferred)
```

**Note:** Profile B remains documented and supported. Not deprecated in P10.

---

## Four-Process Architecture (P8 G-ENV-07)

| Service | Default port | Env file | Template |
| ------- | -----------: | -------- | -------- |
| API | 3001 | `/etc/app-tour/api.env` | `deploy/vps/env/api.env.example` |
| Operator web | 3000 | `/etc/app-tour/web.env` | `deploy/vps/env/web.env.example` |
| Marketing | 3002 | `/etc/app-tour/marketing.env` | `deploy/vps/env/marketing.env.example` |
| Portal | 3003 | `/etc/app-tour/portal.env` | `deploy/vps/env/portal.env.example` |

Bootstrap (first time): `bash scripts/vps-deploy/bootstrap-server.sh` — creates all four env templates.

Verify after edit:

```bash
ENV_DIR=/etc/app-tour bash scripts/vps-deploy/verify-env-coherence.sh --all
```

Deploy (`remote-deploy.sh`) runs the same `--all` check when marketing + portal env files exist.

**P8 Profile B smoke:** `pnpm run p8:staging-remote-smoke` — see `docs/phase-21/runbooks/p8-profile-b-vps-smoke.md`.

**P10 four-process smoke (staging):**

```bash
# from laptop
VPS_HOST=89.45.89.206 pnpm run p10:staging-remote-smoke

# on VPS
ENV_DIR=/etc/app-tour-staging bash /opt/app-tour-staging/scripts/vps-deploy/smoke-four-process.sh
```

**P10 Profile B regression:** `VPS_HOST=89.45.89.206 pnpm run p10:profile-b-regression`

**P10 P8 env regression:** `pnpm run p10:p8-env-regression`

**P10 staging gate (one command — laptop → VPS):**

```bash
VPS_HOST=89.45.89.206 pnpm run p10:staging-gate
# → P10_STAGING_GATE_OK
```

**P10 ops drill (read-only — systemd + smoke + rollback dry-run):**

```bash
VPS_HOST=89.45.89.206 pnpm run p10:ops-drill
# → P10_OPS_DRILL_OK
```

**On VPS directly (no pnpm — SSH first):**

```bash
ssh root@89.45.89.206
ENV_DIR=/etc/app-tour-staging bash /opt/app-tour-staging/scripts/vps-deploy/smoke-four-process.sh
```

**From laptop (preferred — do not paste VPS paths into local shell):**

```bash
VPS_HOST=89.45.89.206 pnpm run p10:vps-smoke
```

**Profile C loopback cutover (opt-in — breaks Profile B IP until Caddy proxies):**

```bash
PROFILE_C_ENABLE=1 ENV_DIR=/etc/app-tour-staging bash scripts/vps-deploy/ensure-profile-c-loopback.sh
systemctl restart app-tour-staging-web app-tour-staging-marketing app-tour-staging-portal
```

**URLs (no domain):**

| Service | URL |
| ------- | --- |
| Operator web | `http://<VPS_IP>:3000` |
| Marketing | `http://<VPS_IP>:3002` |
| Portal | `http://<VPS_IP>:3003` |
| API (health) | `http://<VPS_IP>:3001/health` (loopback preferred — see P8 loopback runbook) |

Infra on the VPS (already running): Postgres `:5433`, Redis `:6379`, MinIO `:9002`.

## P6/P7/P10 staging stack (isolated from prod)

| Resource | Production | Staging |
| -------- | ---------- | ------- |
| Path | `/opt/app-tour` | `/opt/app-tour-staging` |
| Env | `/etc/app-tour/` | `/etc/app-tour-staging/` |
| Units | `app-tour-*` | `app-tour-staging-*` |
| Web / API / M / P | `3000` / `3001` / `3002` / `3003` | `23000` / `23001` / `23002` / `23003` |
| Public IP (Profile B) | `:13000–13003` optional | `:23000–23003` |
| Edge (Profile C) | Caddy `:443` → loopback | same pattern · `render-caddy-env.sh` reads staging ports |

## P7 four-process templates (production ports)

P6 vertical slice needs **four processes**: API + web + marketing + portal.

| Unit | Port | Env file | Template |
| ---- | ---- | -------- | -------- |
| `app-tour-api` | 3001 | `/etc/app-tour/api.env` | `deploy/vps/env/api.env.example` |
| `app-tour-web` | 3000 | `/etc/app-tour/web.env` | `deploy/vps/env/web.env.example` |
| `app-tour-marketing` | 3002 | `/etc/app-tour/marketing.env` | `deploy/vps/env/marketing.env.example` |
| `app-tour-portal` | 3003 | `/etc/app-tour/portal.env` | `deploy/vps/env/portal.env.example` |

Systemd templates: `deploy/vps/systemd/app-tour-{marketing,portal}.service`
Installed by `scripts/vps-deploy/install-systemd-units.sh` on each deploy.

**P7-0-N-004 bootstrap:**

```bash
cp deploy/vps/env/marketing.env.example /etc/app-tour/marketing.env
cp deploy/vps/env/portal.env.example /etc/app-tour/portal.env
# Align MARKETING_REVALIDATE_SECRET with api.env (see docs/phase-20/p7/runbooks/p7-0-env-matrix.md)
bash scripts/vps-deploy/install-systemd-units.sh
systemctl restart app-tour-marketing app-tour-portal
ufw allow 3002/tcp
ufw allow 3003/tcp
```

Verify:

```bash
TOUR_OPS_API_URL=http://127.0.0.1:3001 pnpm run p7:staging-verify
# T2 browser: docs/phase-20/p7/runbooks/p7-staging-e2e.md
```

**Loopback (P8):** API binds `127.0.0.1` only — BFF apps use `TOUR_OPS_API_URL=http://127.0.0.1:3001`. See [docs/phase-21/runbooks/p8-api-loopback-vps.md](../../docs/phase-21/runbooks/p8-api-loopback-vps.md).

## P6 staging stack (isolated from prod)

| Resource | Production | Staging |
| -------- | ---------- | ------- |
| Path | `/opt/app-tour` | `/opt/app-tour-staging` |
| Env | `/etc/app-tour/` | `/etc/app-tour-staging/` |
| Units | `app-tour-*` | `app-tour-staging-*` |
| API port | 13001 | 23001 |
| DB | `tour_db_prod` | `tour_db_staging` |

**Wiring only (fast — no pnpm install):**

```bash
# on VPS as root, after rsync DEV to /opt/app-tour-staging
bash /opt/app-tour-staging/scripts/vps-deploy/bootstrap-staging.sh
```

Install/build/migrate/gates: **[TEMP/FOR YOU.md](../../TEMP/FOR%20YOU.md)** · runbook [p6-staging-vps-boundary.md](../../docs/phase-19/p6/runbooks/p6-staging-vps-boundary.md)

## One-time VPS bootstrap

SSH to the server as root:

```bash
git clone https://github.com/hrokhbakhsh1991/docs.git /opt/app-tour
cd /opt/app-tour
bash scripts/vps-deploy/bootstrap-server.sh
```

Edit secrets (required before first deploy):

```bash
nano /etc/app-tour/api.env   # DB, Redis, MinIO, JWT keys
nano /etc/app-tour/web.env
```

Generate JWT keys:

```bash
cd /opt/app-tour/apps/api
sudo -u app-tour pnpm run bootstrap:dev-jwt >> /tmp/jwt.txt
# paste AUTH_JWT_* lines into /etc/app-tour/api.env
```

First deploy manually:

```bash
bash /opt/app-tour/scripts/vps-deploy/remote-deploy.sh
```

Pre-commit hotfix sync from a local worktree (no `git push` yet):

```bash
bash scripts/vps-deploy/sync-worktree-to-deploy.sh
sudo -u app-tour bash /opt/app-tour/scripts/vps-deploy/build-operator-vps.sh
systemctl restart app-tour-api app-tour-web
```

Open firewall ports if needed:

```bash
ufw allow 3000/tcp
ufw allow 3001/tcp
```

## GitHub Secrets

| Secret | Example | Required |
| ------ | ------- | -------- |
| `VPS_HOST` | `89.45.89.206` | yes |
| `VPS_SSH_KEY` | private key (PEM) | yes |
| `VPS_USER` | `root` | no (default `root`) |
| `VPS_DEPLOY_PATH` | `/opt/app-tour` | no |

Add deploy key on VPS if the repo is private:

```bash
ssh-keygen -t ed25519 -f /root/.ssh/github_deploy -N ""
# add /root/.ssh/github_deploy.pub as read-only deploy key on GitHub
```

## What each deploy does

1. `git fetch` + `reset --hard origin/main`
2. `pnpm install --frozen-lockfile`
3. `pnpm run build:operator-vps` (API + web + workspace deps)
4. `pnpm run db:migrate:deploy`
5. `sync-web-api-url-port.sh` + `stop-stale-listeners.sh`, then `systemctl restart app-tour-api app-tour-web`
6. Health check on `api.env` `PORT` and `web.env` `PORT` (defaults `:3001` / `:3000`)

## systemd

Units call `scripts/vps-deploy/start-api.sh` and `start-web.sh` (source `/etc/app-tour/*.env`, then tsx API + `next start` web).

```bash
systemctl status app-tour-api app-tour-web
journalctl -u app-tour-api -f
journalctl -u app-tour-web -f
```

## Local dev vs VPS (same machine confusion)

**Never mix these.** Run on VPS to see active profile:

```bash
bash /opt/app-tour/scripts/vps-deploy/show-infra-profile.sh /etc/app-tour/api.env
```

| Resource | **PRODUCTION** (operator on VPS) | **DEV** (laptop / CI) |
| -------- | -------------------------------- | --------------------- |
| Env file | `/etc/app-tour/api.env` | `apps/api/.env.local` |
| `NODE_ENV` | `production` | `development` |
| `APP_INFRA_PROFILE` | `production` | (unset or `development`) |
| Postgres | `127.0.0.1:5433` / **`tour_db_prod`** | `127.0.0.1:5434` / `tour_db` (Docker) |
| Redis | `127.0.0.1:6379` **db 1** | `127.0.0.1:6379` **db 0** (Docker) |
| MinIO | `:9002` bucket **`app-tour-prod`** | `:9002` bucket **`app-tour-dev`** |
| SSH tunnel | **Forbidden** for daily dev | `scripts/vps-infra-tunnel.sh` hits **prod** `:5433` |

Fresh production database reset (empty prod, no data to keep):

```bash
# on VPS as root — generates new passwords, recreates tour_db_prod
bash /opt/app-tour/scripts/vps-deploy/ensure-prod-postgres-extensions.sh /etc/app-tour/api.env
bash /opt/app-tour/scripts/vps-deploy/bootstrap-prod-identity.sh /etc/app-tour/api.env
```

## Local dev vs VPS (legacy table)

| | Local dev (recommended) | VPS production |
| - | ----------------------- | -------------- |
| Postgres | Docker `:5434` (`pnpm infra:up`) | native `:5433` / `tour_db_prod` |
| Redis | Docker `:6379` db 0 | native `:6379` db 1 |
| MinIO | Docker `:9002` / `app-tour-dev` | native `:9002` / `app-tour-prod` |
| Env file | `apps/api/.env.local` from `.env.local.example` | `/etc/app-tour/api.env` |
| `NODE_ENV` | `development` | `production` |

**Do not** point local `.env.local` at VPS DB/Redis/MinIO unless you intentionally use `apps/api/.env.vps-tunnel.example` + `scripts/vps-infra-tunnel.sh` (debug only).

## Tenant / host without domain

Operator panel uses host-based tenant routing (`denali.localhost` in dev). With raw IP, configure **both** env files:

```bash
# /etc/app-tour/api.env
PUBLIC_TENANT_FALLBACK_LABEL=denali
PUBLIC_TENANT_FALLBACK_HOSTS=89.45.89.206,127.0.0.1

# /etc/app-tour/web.env
TOUR_OPS_DEFAULT_TENANT_ID=00000000-0000-4000-8000-000000000003
TOUR_OPS_PUBLIC_FALLBACK_HOSTS=89.45.89.206,127.0.0.1
SESSION_COOKIE_SECURE=false
```

Verify Postgres credentials **before** OTP/login smoke:

```bash
bash /opt/app-tour/scripts/vps-deploy/verify-db-env.sh /etc/app-tour/api.env
# on password mismatch (requires DATABASE_URL_ADMIN in api.env):
bash /opt/app-tour/scripts/vps-deploy/sync-db-app-role-password.sh /etc/app-tour/api.env
systemctl restart app-tour-api app-tour-web
```

`remote-deploy.sh` runs `verify-db-env.sh` before migrations and auto-invokes `sync-db-app-role-password.sh` when the probe fails. API `/health` returns **503 degraded** when `DATABASE_URL` cannot connect; OTP routes return stable code **`DATABASE_UNAVAILABLE`** (503) instead of opaque 500.

Post-deploy smoke (fail-closed):

When `marketing.env` and `portal.env` exist, `remote-deploy.sh` runs **`smoke-four-process.sh`** (api + web + marketing + portal on loopback) then **`smoke-operator-login.sh`**. Two-process-only stacks fall back to `health-check.sh` (api + web).

```bash
ENV_DIR=/etc/app-tour bash /opt/app-tour/scripts/vps-deploy/smoke-four-process.sh
ENV_DIR=/etc/app-tour bash /opt/app-tour/scripts/vps-deploy/smoke-operator-login.sh
```

**GHA:** `deploy-vps.yml` post-step runs `scripts/p10-production-remote-gate.sh`. Staging manual: `pnpm run p10:staging-remote-smoke` (see `docs/phase-23/appendices/P10-VERIFICATION-COMMANDS.yaml` P10-2-N-002).

Checks: four loopback HTTP endpoints → DB probe (prisma) → `/health` with `checks.database.ok` → BFF OTP issues `challenge_id` (not `OTP_REQUEST_FAILED`).

Login OTP dev: see `OPERATOR-LOGIN-FLOW.md`.
