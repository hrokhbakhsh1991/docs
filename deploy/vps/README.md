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
5. `systemctl restart app-tour-api app-tour-web`
6. Health check on `:3001` and `:3000`

## systemd

Units call `scripts/vps-deploy/start-api.sh` and `start-web.sh` (source `/etc/app-tour/*.env`, then tsx API + `next start` web).

```bash
systemctl status app-tour-api app-tour-web
journalctl -u app-tour-api -f
journalctl -u app-tour-web -f
```

## Local dev vs VPS

| | Local dev (recommended) | VPS production |
| - | ----------------------- | -------------- |
| Postgres | Docker `:5434` (`pnpm infra:up`) | native `:5433` |
| Redis | Docker `:6379` | native `:6379` |
| MinIO | Docker `:9002` | native `:9002` |
| Env file | `apps/api/.env.local` from `.env.local.example` | `/etc/app-tour/api.env` |
| `NODE_ENV` | `development` | `production` |

**Do not** point local `.env.local` at VPS DB/Redis/MinIO unless you intentionally use `apps/api/.env.vps-tunnel.example` + `scripts/vps-infra-tunnel.sh` (debug only).

## Tenant / host without domain

Operator panel uses host-based tenant routing (`denali.localhost` in dev). With raw IP you may need `/etc/hosts` on the client or DNS later. Login OTP dev: see `OPERATOR-LOGIN-FLOW.md`.
