#!/usr/bin/env bash
# P10-1-N-001 G-TLS-04 — set WEB_BIND_HOST=127.0.0.1 for Profile C (opt-in)
# Profile B keeps 0.0.0.0 until edge cutover — run only when PROFILE_C_ENABLE=1
set -euo pipefail

ENV_DIR="${ENV_DIR:-/etc/app-tour}"

if [[ "${PROFILE_C_ENABLE:-}" != "1" ]]; then
  echo "ensure-profile-c-loopback: skip (set PROFILE_C_ENABLE=1 to bind web/marketing/portal to 127.0.0.1)"
  exit 0
fi

patch_bind() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  if grep -qE '^WEB_BIND_HOST=' "$file"; then
    sed -i 's/^WEB_BIND_HOST=.*/WEB_BIND_HOST=127.0.0.1/' "$file"
  else
    echo "WEB_BIND_HOST=127.0.0.1" >>"$file"
  fi
  echo "ensure-profile-c-loopback: $file → WEB_BIND_HOST=127.0.0.1"
}

for f in "${ENV_DIR}/web.env" "${ENV_DIR}/marketing.env" "${ENV_DIR}/portal.env"; do
  patch_bind "$f"
done

echo "ensure-profile-c-loopback: restart app units after this change"
