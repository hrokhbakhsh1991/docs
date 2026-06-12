#!/usr/bin/env bash
# Start Denali admin panel (API :3001 + Web :3000) on VPS dev.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT}/.logs"
mkdir -p "$LOG_DIR"

echo "Stopping old processes on :3000 and :3001..."
fuser -k 3000/tcp 2>/dev/null || true
fuser -k 3001/tcp 2>/dev/null || true
pkill -f "next dev --port 3000" 2>/dev/null || true
pkill -f "node --import tsx --env-file=.env" 2>/dev/null || true
sleep 2

if ! ss -tln | grep -q ':3001 '; then
  echo "Starting API on :3001..."
  cd "$ROOT"
  nohup pnpm --filter @apps/api dev >"$LOG_DIR/api.log" 2>&1 &
  for _ in $(seq 1 30); do
    curl -sf http://127.0.0.1:3001/health >/dev/null 2>&1 && break
    sleep 1
  done
fi

if ! ss -tln | grep -q ':3000 '; then
  echo "Starting Web on :3000..."
  cd "$ROOT"
  nohup pnpm --filter @apps/web dev >"$LOG_DIR/web.log" 2>&1 &
  for _ in $(seq 1 60); do
    curl -sf http://127.0.0.1:3000/auth/login >/dev/null 2>&1 && break
    sleep 1
  done
fi

echo ""
echo "API:  http://127.0.0.1:3001/health"
echo "Web:  http://127.0.0.1:3000/auth/login"
echo "Logs: $LOG_DIR/api.log  $LOG_DIR/web.log"
curl -sf http://127.0.0.1:3001/health && echo " — API ok"
curl -sf -o /dev/null -w " — Web login HTTP %{http_code}\n" http://127.0.0.1:3000/auth/login
