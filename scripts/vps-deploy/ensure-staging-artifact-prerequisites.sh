#!/usr/bin/env bash
# VPS prerequisites for artifact extract/install (no broad apt upgrade).
set -euo pipefail

missing=()
command -v zstd >/dev/null 2>&1 || missing+=(zstd)
command -v tar >/dev/null 2>&1 || missing+=(tar)

if ((${#missing[@]} > 0)); then
  echo "ensure-staging-artifact-prerequisites: missing: ${missing[*]}" >&2
  echo "ensure-staging-artifact-prerequisites: install with: apt-get install -y ${missing[*]}" >&2
  exit 1
fi

if ! command -v mc >/dev/null 2>&1; then
  echo "ensure-staging-artifact-prerequisites: installing mc (MinIO client) to /usr/local/bin"
  curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc
  chmod +x /usr/local/bin/mc
fi

command -v mc >/dev/null 2>&1 || {
  echo "ensure-staging-artifact-prerequisites: mc install failed" >&2
  exit 1
}

echo "ensure-staging-artifact-prerequisites: OK"
