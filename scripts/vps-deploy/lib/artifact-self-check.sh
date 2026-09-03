#!/usr/bin/env bash
# Post-build artifact layout verification (extracted tree or ARTIFACT_ROOT).
set -euo pipefail

artifact_self_check() {
  local vroot="$1"
  [[ -f "${vroot}/api/dist/main.js" ]] || {
    echo "artifact-self-check: missing api/dist/main.js" >&2
    return 1
  }
  [[ -f "${vroot}/prisma-migrate/node_modules/prisma/build/index.js" ]] || {
    echo "artifact-self-check: missing prisma-migrate CLI bundle" >&2
    return 1
  }
  [[ -f "${vroot}/api/node_modules/@prisma/client/package.json" ]] || {
    echo "artifact-self-check: missing @prisma/client in api bundle" >&2
    return 1
  }
  [[ -f "${vroot}/api/node_modules/@app-tour/booking-http-contracts/package.json" ]] || {
    echo "artifact-self-check: missing @app-tour/booking-http-contracts in api bundle" >&2
    return 1
  }
  NODE_PATH="${vroot}/api/node_modules:${vroot}/api/node_modules/.pnpm/node_modules${NODE_PATH:+:${NODE_PATH}}" \
    node -e 'require.resolve("@app-tour/booking-http-contracts")' >/dev/null || {
    echo "artifact-self-check: @app-tour/booking-http-contracts is not runtime-resolvable" >&2
    return 1
  }
  [[ -f "${vroot}/bin/migrate-deploy.sh" ]] || {
    echo "artifact-self-check: missing bin/migrate-deploy.sh" >&2
    return 1
  }
  [[ -f "${vroot}/bin/seed-staging.cjs" ]] || {
    echo "artifact-self-check: missing bin/seed-staging.cjs" >&2
    return 1
  }
  [[ -f "${vroot}/bin/seed-denali-wallet-pilot.cjs" ]] || {
    echo "artifact-self-check: missing bin/seed-denali-wallet-pilot.cjs" >&2
    return 1
  }
  [[ -x "${vroot}/bin/seed-denali-wallet-pilot.sh" ]] || {
    echo "artifact-self-check: missing executable pilot seed wrapper" >&2
    return 1
  }
  for k in web portal marketing; do
    [[ -f "${vroot}/${k}/RUNTIME.json" ]] || {
      echo "artifact-self-check: missing ${k}/RUNTIME.json" >&2
      return 1
    }
  done
  [[ -f "${vroot}/portal/apps/portal/src/me/member-profile-contract-v1.snapshot.json" ]] || {
    echo "artifact-self-check: missing portal member-profile contract snapshot" >&2
    return 1
  }
  local web_server="${vroot}/web/apps/web/server.js"
  [[ -f "$web_server" ]] || {
    echo "artifact-self-check: missing web standalone server.js" >&2
    return 1
  }
  if ! grep -q '"ALLOW_DENALI_WEB_PLUGIN":"true"' "$web_server" 2>/dev/null \
    && ! grep -q '"ALLOW_DENALI_WEB_PLUGIN": "true"' "$web_server" 2>/dev/null; then
    echo "artifact-self-check: Denali client bundle disabled in web server config" >&2
    return 1
  fi
  if [[ -n "${2:-}" ]]; then
    local expected_sha="$2"
    local manifest_sha=""
    [[ -f "${vroot}/release-manifest.json" ]] || {
      echo "artifact-self-check: missing release-manifest.json" >&2
      return 1
    }
    manifest_sha="$(python3 - "${vroot}/release-manifest.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as manifest_file:
    print(json.load(manifest_file).get("releaseSha", ""))
PY
    )"
    [[ "$manifest_sha" == "$expected_sha" ]] || {
      echo "artifact-self-check: release manifest SHA does not match expected release" >&2
      return 1
    }
    echo "artifact-self-check: release manifest SHA matches expected release"
  fi
  echo "artifact-self-check: OK"
}
