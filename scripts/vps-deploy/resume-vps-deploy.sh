#!/usr/bin/env bash
# Resume first VPS deploy after bootstrap (pnpm fix + remote-deploy).
# Run as root: bash scripts/vps-deploy/resume-vps-deploy.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour}"
ENV_DIR="${ENV_DIR:-/etc/app-tour}"
VPS_IP="${VPS_IP:-$(curl -fsS --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')}"

log() { printf '[resume-deploy] %s\n' "$*"; }

[[ "$(id -u)" -eq 0 ]] || { echo "run as root"; exit 1; }
[[ -d "$DEPLOY_PATH/.git" ]] || { echo "missing $DEPLOY_PATH — run bootstrap-server.sh first"; exit 1; }

log "stop stuck deploy/build processes"
pkill -f remote-deploy.sh 2>/dev/null || true
pkill -f "pnpm install" 2>/dev/null || true
sleep 2

log "install standalone pnpm at /usr/local/bin/pnpm (corepack breaks under sudo -u app-tour)"
if [[ ! -x /usr/local/pnpm/pnpm ]]; then
  curl -fsSL https://get.pnpm.io/install.sh | env PNPM_HOME=/usr/local/pnpm PNPM_VERSION=10.6.5 SHELL=/bin/bash bash -
fi
ln -sf /usr/local/pnpm/pnpm /usr/local/bin/pnpm
/usr/local/bin/pnpm -v

git config --global --add safe.directory "$DEPLOY_PATH" || true
sudo -u app-tour git config --global --add safe.directory "$DEPLOY_PATH" 2>/dev/null || true

log "verify app-tour can run pnpm from $DEPLOY_PATH"
sudo -u app-tour env HOME="$DEPLOY_PATH" PATH="/usr/local/bin:/usr/bin:/bin" bash -lc \
  "cd '$DEPLOY_PATH' && /usr/local/bin/pnpm -v"

log "running remote-deploy (15–45 min on first build)"
FORCE_BOOTSTRAP=1 DEPLOY_PATH="$DEPLOY_PATH" ENV_DIR="$ENV_DIR" \
  bash "$DEPLOY_PATH/scripts/vps-deploy/remote-deploy.sh"

log "smoke"
curl -sf "http://127.0.0.1:3001/health" && echo
ENV_DIR="$ENV_DIR" bash "$DEPLOY_PATH/scripts/vps-deploy/smoke-four-process.sh" || true
systemctl is-active app-tour-api app-tour-web app-tour-marketing app-tour-portal

log "GitHub Actions — set repository secrets:"
echo "  VPS_HOST=${VPS_IP}"
echo "  VPS_USER=root"
echo "  VPS_DEPLOY_PATH=${DEPLOY_PATH}"
if [[ -f /root/.ssh/gha_deploy ]]; then
  echo "  VPS_SSH_KEY=<contents of /root/.ssh/gha_deploy>"
else
  ssh-keygen -t ed25519 -f /root/.ssh/gha_deploy -N "" -C "github-actions-deploy"
  cat /root/.ssh/gha_deploy.pub >>/root/.ssh/authorized_keys
  chmod 600 /root/.ssh/gha_deploy /root/.ssh/authorized_keys
  echo "  VPS_SSH_KEY=<contents of /root/.ssh/gha_deploy>"
fi

log "URLs"
echo "  Operator:  http://${VPS_IP}:3000"
echo "  Marketing: http://${VPS_IP}:3002"
echo "  Portal:    http://${VPS_IP}:3003"
echo "  API:       http://${VPS_IP}:3001/health"
