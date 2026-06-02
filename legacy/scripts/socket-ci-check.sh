#!/usr/bin/env bash
# Socket.dev CI scan — requires SOCKET_SECURITY_API_TOKEN (or socket login) in CI.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

if [ -z "${SOCKET_SECURITY_API_TOKEN:-}" ]; then
  echo "socket-ci-check: skip — SOCKET_SECURITY_API_TOKEN is not set." >&2
  echo "  Set the token in CI secrets or run: pnpm exec socket login" >&2
  exit 0
fi

echo "==> socket ci (supply-chain policy)"
pnpm exec socket ci
