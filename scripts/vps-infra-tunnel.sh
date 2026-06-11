#!/usr/bin/env bash
# Forward VPS Postgres (5433) and Redis (6379) to local 15433 / 16379.
# Required before `pnpm --filter @apps/api dev` when using remote infra.
# MinIO is reached directly at 89.45.89.206:9002 (no tunnel).
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.45.89.206}"
VPS_USER="${VPS_USER:-root}"
LOCAL_PG_PORT="${LOCAL_PG_PORT:-15433}"
LOCAL_REDIS_PORT="${LOCAL_REDIS_PORT:-16379}"

if pgrep -f "ssh.*${LOCAL_PG_PORT}:127.0.0.1:5433" >/dev/null 2>&1; then
  echo "Tunnel already running (local :${LOCAL_PG_PORT} -> VPS Postgres, :${LOCAL_REDIS_PORT} -> VPS Redis)"
  exit 0
fi

SSH_OPTS=(
  -N
  -o StrictHostKeyChecking=no
  -o ServerAliveInterval=30
  -o ExitOnForwardFailure=yes
  -L "${LOCAL_PG_PORT}:127.0.0.1:5433"
  -L "${LOCAL_REDIS_PORT}:127.0.0.1:6379"
)

SSH_BASE=(ssh -f "${SSH_OPTS[@]}")

if [[ -n "${SSHPASS:-}" ]] && command -v sshpass >/dev/null 2>&1; then
  sshpass -e "${SSH_BASE[@]}" -o PreferredAuthentications=password -o PubkeyAuthentication=no -o IdentitiesOnly=yes "${VPS_USER}@${VPS_HOST}"
else
  "${SSH_BASE[@]}" "${VPS_USER}@${VPS_HOST}"
fi

sleep 3
if ! ss -tln | grep -q ":${LOCAL_PG_PORT} "; then
  echo "Tunnel failed — check SSH access to ${VPS_USER}@${VPS_HOST}" >&2
  exit 1
fi

echo "VPS infra tunnel up:"
echo "  Postgres  -> 127.0.0.1:${LOCAL_PG_PORT}"
echo "  Redis     -> 127.0.0.1:${LOCAL_REDIS_PORT}"
echo "  MinIO     -> http://${VPS_HOST}:9002 (direct)"
