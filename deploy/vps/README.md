# VPS deploy — operator admin (IP, no domain)

Push to **`main`** → GitHub Actions runs `scripts/vps-deploy/remote-deploy.sh` on the VPS via SSH.

**URLs (no domain):**

| Service | URL |
| ------- | --- |
| Operator web | `http://<VPS_IP>:3000` |
| API (health) | `http://<VPS_IP>:3001/health` |

Infra on the VPS (already running): Postgres `:5433`, Redis `:6379`, MinIO `:9002`.

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

```bash
bash /opt/app-tour/scripts/vps-deploy/smoke-operator-login.sh
```

Checks: DB probe (prisma) → `/health` with `checks.database.ok` → BFF OTP issues `challenge_id` (not `OTP_REQUEST_FAILED`).

Login OTP dev: see `OPERATOR-LOGIN-FLOW.md`.
