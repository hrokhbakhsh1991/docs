#!/usr/bin/env bash
# P7-3-N-001 — T2 Playwright smokes against Profile B-staging (230xx ports)
# Uses SSH port-forwards so local Playwright avoids ISP intercept on bare VPS :230xx.
# @see docs/phase-20/p7/runbooks/p7-staging-e2e.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VPS_HOST="${VPS_HOST:-89.45.89.206}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
WEB_PORT="${STAGING_WEB_PORT:-23000}"
API_PORT="${STAGING_API_PORT:-23001}"
MKT_PORT="${STAGING_MARKETING_PORT:-23002}"
PTL_PORT="${STAGING_PORTAL_PORT:-23003}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)
TUNNEL_PID=""

staging_tunnel_ports_ready() {
  for port in "${WEB_PORT}" "${API_PORT}" "${MKT_PORT}" "${PTL_PORT}"; do
    if ! ss -tln 2>/dev/null | grep -q "127.0.0.1:${port} "; then
      return 1
    fi
  done
  return 0
}

kill_stale_staging_tunnels() {
  pkill -f "127.0.0.1:${WEB_PORT}:127.0.0.1:${WEB_PORT}" 2>/dev/null || true
  pkill -f "127.0.0.1:${API_PORT}:127.0.0.1:${API_PORT}" 2>/dev/null || true
  pkill -f "127.0.0.1:${MKT_PORT}:127.0.0.1:${MKT_PORT}" 2>/dev/null || true
  pkill -f "127.0.0.1:${PTL_PORT}:127.0.0.1:${PTL_PORT}" 2>/dev/null || true
  sleep 1
}

tunnel_health_code() {
  local port="$1"
  local host="${2:-}"
  if [[ -n "${host}" ]]; then
    curl -sf -o /dev/null -w '%{http_code}' \
      -H "Host: ${host}" \
      "http://127.0.0.1:${port}/health" \
      2>/dev/null || echo 000
    return
  fi
  curl -sf -o /dev/null -w '%{http_code}' \
    "http://127.0.0.1:${port}/health" \
    2>/dev/null || echo 000
}

staging_tunnels_responsive() {
  [[ "$(tunnel_health_code "${API_PORT}")" == "200" ]] &&
    [[ "$(tunnel_health_code "${PTL_PORT}" "operator.portal.localhost")" == "200" ]]
}

cleanup() {
  if [[ -n "${TUNNEL_PID}" ]] && kill -0 "${TUNNEL_PID}" 2>/dev/null; then
    kill "${TUNNEL_PID}" 2>/dev/null || true
    wait "${TUNNEL_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

start_staging_tunnels() {
  if staging_tunnel_ports_ready && staging_tunnels_responsive; then
    echo "tunnels ready on 127.0.0.1:${WEB_PORT}-${PTL_PORT} — reusing"
    return 0
  fi
  echo "establishing SSH forwards on 127.0.0.1:${WEB_PORT}-${PTL_PORT}"
  kill_stale_staging_tunnels
  ssh "${SSH_OPTS[@]}" -f -N -o ExitOnForwardFailure=yes \
    -L "127.0.0.1:${WEB_PORT}:127.0.0.1:${WEB_PORT}" \
    -L "127.0.0.1:${API_PORT}:127.0.0.1:${API_PORT}" \
    -L "127.0.0.1:${MKT_PORT}:127.0.0.1:${MKT_PORT}" \
    -L "127.0.0.1:${PTL_PORT}:127.0.0.1:${PTL_PORT}" \
    "${VPS_USER}@${VPS_HOST}"
  sleep 1
  TUNNEL_PID="$(pgrep -f "127.0.0.1:${PTL_PORT}:127.0.0.1:${PTL_PORT}" | head -1 || true)"
  staging_tunnel_ports_ready || fail "SSH forwards missing after start (127.0.0.1:${WEB_PORT}-${PTL_PORT})"
  staging_tunnels_responsive || fail "tunnel health via 127.0.0.1:${WEB_PORT}-${PTL_PORT} not 200"
}

fail() { echo "P7_STAGING_E2E_PROBE_FAIL: $1" >&2; exit 1; }

echo "== p7:staging-e2e-probe → ${VPS_HOST} (tunneled 127.0.0.1:${WEB_PORT}-${PTL_PORT}) =="

start_staging_tunnels

# Chromium host-resolver maps canonical dev hosts → loopback (through SSH forwards).
export VPS_IP="127.0.0.1"
export PW_EXTERNAL_SERVERS=1
export PW_NO_REUSE_SERVER=1
export TOUR_OPS_API_URL="http://127.0.0.1:${API_PORT}"
export PLAYWRIGHT_BASE_URL="http://operator.admin.localhost:${WEB_PORT}"
export SMOKE_MARKETING_BASE_URL="http://operator.localhost:${MKT_PORT}"
export SMOKE_PORTAL_BASE_URL="http://operator.portal.localhost:${PTL_PORT}"
export OPERATOR_OWNER_MOBILE="${OPERATOR_OWNER_MOBILE:-+15550001001}"
export OPERATOR_DEV_OTP="${OPERATOR_DEV_OTP:-1234}"

echo "== sync staging seed scripts + hotfix API sources to VPS =="
rsync -az \
  "${ROOT}/apps/api/scripts/seed-operator-smoke-identity-staging.ts" \
  "${ROOT}/apps/api/scripts/seed-operator-smoke-pending-booking-staging.ts" \
  "${ROOT}/apps/api/scripts/ensure-operator-smoke-vs01-staging.ts" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/api/scripts/"
rsync -az \
  "${ROOT}/apps/api/src/tours/canonical-validation-sync.ts" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/api/src/tours/"
rsync -az \
  "${ROOT}/apps/api/src/bookings/prisma-bookings.repository.ts" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/api/src/bookings/"
rsync -az \
  "${ROOT}/apps/api/src/settings/seed-operator-smoke-published-tour.ts" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/api/src/settings/"
rsync -az \
  "${ROOT}/apps/api/src/fixtures/operator-smoke-published-tour.fixture.ts" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/api/src/fixtures/"

echo "== VPS pre-seed (identity · VS-01 · Ali Rezaei pending) =="
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH}"
ENV_DIR="${ENV_DIR}"
cd "\${DEPLOY_PATH}/apps/api"
set -a
# shellcheck source=/dev/null
source "\${ENV_DIR}/api.env"
set +a
systemctl restart app-tour-staging-api app-tour-staging-marketing app-tour-staging-portal
sleep 3
systemctl is-active app-tour-staging-api app-tour-staging-marketing app-tour-staging-portal
for script in \\
  scripts/seed-operator-smoke-identity-staging.ts \\
  scripts/ensure-operator-smoke-vs01-staging.ts \\
  scripts/seed-operator-smoke-pending-booking-staging.ts
do
  NODE_ENV=development pnpm exec tsx "\$script" >/tmp/p7-e2e-seed-post-restart.log 2>&1 \\
    || { tail -20 /tmp/p7-e2e-seed-post-restart.log >&2; exit 1; }
done
grep -q OPERATOR_SMOKE_PENDING_BOOKING_SEED_OK /tmp/p7-e2e-seed-post-restart.log

MKT_ENV="\${ENV_DIR}/marketing.env"
PORTAL_BASE="http://operator.portal.localhost:${PTL_PORT}"
if grep -q '^PORTAL_PUBLIC_BASE_URL=' "\$MKT_ENV"; then
  sed -i "s|^PORTAL_PUBLIC_BASE_URL=.*|PORTAL_PUBLIC_BASE_URL=\${PORTAL_BASE}|" "\$MKT_ENV"
else
  echo "PORTAL_PUBLIC_BASE_URL=\${PORTAL_BASE}" >> "\$MKT_ENV"
fi
systemctl restart app-tour-staging-marketing app-tour-staging-portal
sleep 2
systemctl is-active app-tour-staging-marketing app-tour-staging-portal
EOF

echo "== tunnel sanity (portal + api /health via tunnel) =="
portal_health="$(tunnel_health_code "${PTL_PORT}" "operator.portal.localhost")"
api_health="$(tunnel_health_code "${API_PORT}")"
[[ "${portal_health}" == "200" ]] || fail "portal /health via tunnel expected 200 got ${portal_health}"
[[ "${api_health}" == "200" ]] || fail "api /health via tunnel expected 200 got ${api_health}"

echo "== host bind (Profile B-staging API via tunnel) =="
TOUR_OPS_API_URL="$TOUR_OPS_API_URL" node "${ROOT}/scripts/smoke-p6-host-bind.mjs"

echo "== portal smokes (SMK-PTL-01/02/04/05) =="
cd "${ROOT}"
pnpm --filter @apps/portal run test:smoke

echo "== restart guest surfaces before marketing smokes =="
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
systemctl restart app-tour-staging-marketing app-tour-staging-portal
sleep 3
systemctl is-active app-tour-staging-marketing app-tour-staging-portal
for port in ${MKT_PORT} ${PTL_PORT}; do
  code=\$(curl -sf -o /dev/null -w '%{http_code}' "http://127.0.0.1:\${port}/health" 2>/dev/null || echo 000)
  [[ "\$code" == "200" ]] || { echo "guest /health on :\$port expected 200 got \$code"; exit 1; }
done
EOF

echo "== marketing smokes (SMK-MKT-03 + browse) =="
pnpm --filter @apps/marketing exec playwright test -c playwright.marketing.config.ts -g "SMK-MKT"

echo "== admin smokes (VS-01 · VS-06 · VS-07) =="
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH}"
ENV_DIR="${ENV_DIR}"
cd "\${DEPLOY_PATH}/apps/api"
set -a
# shellcheck source=/dev/null
source "\${ENV_DIR}/api.env"
set +a
NODE_ENV=development pnpm exec tsx scripts/seed-operator-smoke-pending-booking-staging.ts >/tmp/p7-admin-vs07-reset.log 2>&1 \\
  || { tail -20 /tmp/p7-admin-vs07-reset.log >&2; exit 1; }
grep -q OPERATOR_SMOKE_PENDING_BOOKING_SEED_OK /tmp/p7-admin-vs07-reset.log
EOF
bash "${ROOT}/scripts/p7-staging-sync-platform-core.sh"
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
systemctl restart app-tour-staging-web
sleep 3
systemctl is-active app-tour-staging-web
code=\$(curl -sf -o /dev/null -w '%{http_code}' "http://127.0.0.1:${WEB_PORT}/health" 2>/dev/null || echo 000)
[[ "\$code" == "200" ]] || { echo "web /health on :${WEB_PORT} expected 200 got \$code"; exit 1; }
EOF
web_health="$(tunnel_health_code "${WEB_PORT}" "operator.admin.localhost")"
[[ "${web_health}" == "200" ]] || fail "web /health via tunnel expected 200 got ${web_health}"
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts -g "SMK-P6-VS-01"
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts -g "SMK-P6-ADM-02"
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts -g "SMK-P9-04"

echo "P7_STAGING_E2E_PROBE_OK"
