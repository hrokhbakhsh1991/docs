#!/usr/bin/env bash
# Back-compat alias — prefer scripts/phase-hooks-suspended.sh
set -euo pipefail
exec bash "$(cd "$(dirname "$0")" && pwd)/phase-hooks-suspended.sh" "$@"
