#!/usr/bin/env bash
# Cursor cleanup — run after fully closing Cursor (all windows).
set -euo pipefail

CURSOR_DIR="${HOME}/.config/Cursor"
GLOBAL_STORAGE="${CURSOR_DIR}/User/globalStorage"
STATE_DB="${GLOBAL_STORAGE}/state.vscdb"

if pgrep -x cursor >/dev/null 2>&1; then
  echo "ERROR: Cursor is still running. Close all Cursor windows first."
  exit 1
fi

echo "==> Removing old logs and snapshots..."
rm -rf "${CURSOR_DIR}/logs/"*
rm -rf "${CURSOR_DIR}/snapshots/"*

if [[ -f "${STATE_DB}" ]]; then
  BEFORE=$(du -sh "${STATE_DB}" | cut -f1)
  echo "==> VACUUM state DB (was ${BEFORE})..."
  cp "${STATE_DB}" "${HOME}/state.vscdb.bak.$(date +%Y%m%d)"
  sqlite3 "${STATE_DB}" "VACUUM;"
  rm -f "${GLOBAL_STORAGE}/state.vscdb.backup" "${GLOBAL_STORAGE}/state.vscdb-wal" "${GLOBAL_STORAGE}/state.vscdb-shm" 2>/dev/null || true
  AFTER=$(du -sh "${STATE_DB}" | cut -f1)
  echo "    Done: ${BEFORE} -> ${AFTER}"
else
  echo "==> No state.vscdb found, skipping VACUUM."
fi

echo "==> Pruning stale npx cache (older than 7 days)..."
find "${HOME}/.npm/_npx" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true

echo "==> Cleanup complete. Restart Cursor."
