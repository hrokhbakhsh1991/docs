#!/usr/bin/env bash
# Per-boot Cloud Agent setup for the app-tour monorepo.
#
# Runs on every container start (environment.json `start`). Idempotent:
#   1. Ensure Node 24 wins on PATH (see ensure-node24.sh).
#   2. Generate gitignored dev env files so the surfaces run out of the box
#      (API in-memory driver + RS256 dev JWT; web/marketing/portal dev flags).
#   3. Map the seeded dev hosts to 127.0.0.1 for browser-based testing.
set -eu

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

bash "$repo_root/scripts/cloud/ensure-node24.sh" || true

# Put Node 24 on PATH for the rest of this script (JWT keygen runs under node).
node24_bin="$(ls -d "${NVM_DIR:-$HOME/.nvm}"/versions/node/v24*/bin 2>/dev/null | sort -V | tail -1 || true)"
[ -n "$node24_bin" ] && export PATH="$node24_bin:$PATH"

write_if_missing() {
  # $1 = path, stdin = contents
  if [ ! -f "$1" ]; then
    mkdir -p "$(dirname "$1")"
    cat > "$1"
    echo "agent-start: created $1"
  fi
}

# --- API: in-memory driver dev config (no Postgres/Docker required) ---
write_if_missing "$repo_root/apps/api/.env" <<'EOF'
PORT=3001
EOF

write_if_missing "$repo_root/apps/api/.env.local" <<'EOF'
NODE_ENV=development
PORT=3001
STORAGE_DRIVER=memory
OUTBOX_RELAY_ENABLED=false
TENANT_RATE_LIMIT_ENABLED=false
PROJECTION_AUTO_RECONCILE_ENABLED=false
PRIORITY_LOAD_SHED_ENABLED=false
AUTH_ALLOW_DEV_STATIC_OTP=true
OPERATOR_OWNER_MOBILE=+15550001001
EOF

# RS256 dev JWT keys — required when the dev bearer is disabled (non-test dev).
if ! grep -q "AUTH_JWT_PRIVATE_KEY" "$repo_root/apps/api/.env.local" 2>/dev/null; then
  ( cd "$repo_root/apps/api" && node ./scripts/bootstrap-dev-jwt-keys.mjs >> .env.local ) \
    && echo "agent-start: generated dev JWT keys for apps/api/.env.local" || true
fi

# --- Web / Marketing / Portal: dev session + workspace client bundle flags ---
for app in web marketing portal; do
  write_if_missing "$repo_root/apps/$app/.env.local" <<'EOF'
ALLOW_DEV_WEB_SESSION=true
ALLOW_DENALI_WEB_PLUGIN=true
ALLOW_URBAN_WEB_PLUGIN=true
TOUR_OPS_API_URL=http://127.0.0.1:3001
API_INTERNAL_URL=http://127.0.0.1:3001
EOF
done

# --- Dev host aliases for browser testing (host-based tenant routing) ---
hosts_line="127.0.0.1 operator.localhost denali.localhost urban.localhost denali.portal.localhost operator.portal.localhost"
if ! grep -q "operator.localhost" /etc/hosts 2>/dev/null; then
  printf '%s\n' "$hosts_line" | sudo tee -a /etc/hosts >/dev/null 2>&1 \
    && echo "agent-start: added dev host aliases to /etc/hosts" || true
fi

echo "agent-start: ready — run a surface with e.g. 'pnpm --filter @apps/web run dev'"
