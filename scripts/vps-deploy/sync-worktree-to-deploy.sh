#!/usr/bin/env bash
# Sync a local worktree into the VPS deploy path before changes land on origin/main.
# Prefer `remote-deploy.sh` after push; use this only for pre-commit verification on VPS.
set -euo pipefail

SOURCE="${SOURCE:-/root/docs}"
TARGET="${TARGET:-/opt/app-tour}"
APP_USER="${APP_USER:-app-tour}"

[[ -d "$SOURCE" ]] || { echo "missing source: $SOURCE" >&2; exit 1; }
[[ -d "$TARGET" ]] || { echo "missing target: $TARGET" >&2; exit 1; }

rsync -a \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  --exclude 'dist/' \
  --exclude '.cache/' \
  --exclude '.turbo/' \
  --exclude 'test-results/' \
  --exclude 'playwright-report/' \
  "$SOURCE"/ "$TARGET"/

chmod +x "$TARGET"/scripts/vps-deploy/*.sh 2>/dev/null || true
chown -R "$APP_USER:$APP_USER" "$TARGET"

printf '[sync-worktree] synced %s -> %s\n' "$SOURCE" "$TARGET"
printf '[sync-worktree] next: sudo -u %s bash %s/scripts/vps-deploy/build-operator-vps.sh\n' "$APP_USER" "$TARGET"
printf '[sync-worktree] then: systemctl restart app-tour-api app-tour-web\n'
