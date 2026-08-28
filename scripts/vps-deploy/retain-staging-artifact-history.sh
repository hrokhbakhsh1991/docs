#!/usr/bin/env bash
# VPS-local: retain only recent staging release/artifact history after a
# successful artifact deploy. Never touches production paths, env, DB, Redis,
# MinIO buckets, or the active release target.
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/app-tour-staging}"
RELEASES_DIR="${RELEASES_DIR:-${DEPLOY_ROOT}/releases}"
ARTIFACT_DIR="${ARTIFACT_DIR:-/tmp/app-tour-artifacts}"
RETAIN_RELEASES="${RETAIN_RELEASES:-3}"
DRY_RUN="${DRY_RUN:-0}"

log() { printf '[retain-staging] %s\n' "$*"; }

[[ "$(id -u)" -eq 0 ]] || {
  echo "retain-staging-artifact-history: run as root" >&2
  exit 1
}

[[ "$DEPLOY_ROOT" == "/opt/app-tour-staging" ]] || {
  echo "retain-staging-artifact-history: refusing non-staging DEPLOY_ROOT=$DEPLOY_ROOT" >&2
  exit 1
}

[[ -d "$RELEASES_DIR" ]] || {
  log "missing releases dir: $RELEASES_DIR"
  exit 0
}

[[ "$RETAIN_RELEASES" =~ ^[0-9]+$ ]] || {
  echo "retain-staging-artifact-history: RETAIN_RELEASES must be numeric" >&2
  exit 1
}

if (( RETAIN_RELEASES < 2 )); then
  echo "retain-staging-artifact-history: RETAIN_RELEASES must be >= 2" >&2
  exit 1
fi

declare -A keep=()

add_keep_path() {
  local path="$1" sha
  [[ -n "$path" ]] || return 0
  [[ "$path" == "${RELEASES_DIR}/"* ]] || return 0
  sha="$(basename "$path")"
  [[ -d "${RELEASES_DIR}/${sha}" ]] || return 0
  keep["$sha"]=1
}

if [[ -L "${DEPLOY_ROOT}/current" ]]; then
  add_keep_path "$(readlink -f "${DEPLOY_ROOT}/current")"
fi

if [[ -f "${DEPLOY_ROOT}/previous-release" ]]; then
  add_keep_path "$(cat "${DEPLOY_ROOT}/previous-release")"
fi

while IFS= read -r sha; do
  [[ -n "$sha" ]] || continue
  keep["$sha"]=1
  if (( ${#keep[@]} >= RETAIN_RELEASES )); then
    break
  fi
done < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' |
  sort -rn |
  awk '{print $2}')

remove_path() {
  local path="$1"
  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY_RUN remove $path"
    return 0
  fi
  rm -rf -- "$path"
}

log "keeping releases: ${!keep[*]}"

while IFS= read -r sha; do
  [[ -n "$sha" ]] || continue
  if [[ -z "${keep[$sha]:-}" ]]; then
    log "remove old release $sha"
    remove_path "${RELEASES_DIR}/${sha}"
  fi
done < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)

if [[ -d "$ARTIFACT_DIR" ]]; then
  while IFS= read -r file; do
    [[ -n "$file" ]] || continue
    base="$(basename "$file")"
    sha="${base#app-tour-staging-}"
    sha="${sha%.tar.zst.sha256}"
    sha="${sha%.tar.zst}"
    if [[ -z "${keep[$sha]:-}" ]]; then
      log "remove old artifact $base"
      remove_path "$file"
    fi
  done < <(find "$ARTIFACT_DIR" -maxdepth 1 -type f \
    \( -name 'app-tour-staging-*.tar.zst' -o -name 'app-tour-staging-*.tar.zst.sha256' \) |
    sort)

  while IFS= read -r parts_dir; do
    [[ -n "$parts_dir" ]] || continue
    log "remove stale artifact parts $(basename "$parts_dir")"
    remove_path "$parts_dir"
  done < <(find "$ARTIFACT_DIR" -maxdepth 1 -type d -name 'app-tour-staging-*.tar.zst.parts' | sort)
fi

log "retention complete"
