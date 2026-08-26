#!/usr/bin/env bash
# Verify artifact has no build-host absolute paths in runtime-critical files.
set -euo pipefail

artifact_clean_room_check() {
  local vroot="$1"
  local repo_root="${2:-}"

  [[ -d "$vroot" ]] || {
    echo "artifact-clean-room: missing $vroot" >&2
    return 1
  }

  local migrate="${vroot}/bin/migrate-deploy.sh"
  [[ -f "$migrate" ]] || {
    echo "artifact-clean-room: missing migrate-deploy.sh" >&2
    return 1
  }
  grep -q 'cd "${RELEASE_ROOT}/api"' "$migrate" || {
    echo "artifact-clean-room: migrate-deploy.sh must cd to api runtime dir" >&2
    return 1
  }

  local engine
  engine="$(find "${vroot}/api/node_modules" -name 'libquery_engine-debian-openssl-1.1.x.so.node' 2>/dev/null | head -1)"
  [[ -n "$engine" ]] || {
    echo "artifact-clean-room: missing Prisma engine for debian-openssl-1.1.x" >&2
    return 1
  }

  if [[ -n "$repo_root" ]]; then
    local external_links
    external_links="$(find "${vroot}/api/node_modules" -type l -lname "${repo_root}/*" 2>/dev/null | head -1 || true)"
    if [[ -n "$external_links" ]]; then
      echo "artifact-clean-room: symlink points to build host: ${external_links}" >&2
      return 1
    fi
    if grep -rF "$repo_root" "${vroot}/bin" "${vroot}/prisma-migrate" >/dev/null 2>&1; then
      echo "artifact-clean-room: build-host path in bin/prisma-migrate" >&2
      return 1
    fi
  fi

  echo "artifact-clean-room: OK"
}
