#!/usr/bin/env bash
# EPH Track II-A — zero identity branches in apps/api/src (strict closure).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "phase-eph-identity-ratchet: zero workspaceType/plugin.id identity branches in apps/api/src"

if rg -q 'workspaceType === "denali"|workspaceType !== "denali"|workspaceType === "starter"|plugin\.id === "denali"' apps/api/src; then
  echo "phase-eph-identity-ratchet: FAIL — identity branches remain:"
  rg -n 'workspaceType === "denali"|workspaceType !== "denali"|workspaceType === "starter"|plugin\.id === "denali"' apps/api/src || true
  exit 1
fi

echo "phase-eph-identity-ratchet: PASS (0 identity branches)"
