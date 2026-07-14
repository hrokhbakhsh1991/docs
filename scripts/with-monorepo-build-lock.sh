#!/usr/bin/env bash
# Serialize monorepo production builds — parallel `pnpm build` / gate runs race on
# ui-primitives `rm -rf dist`, marketing `rm -rf .next`, and Next manifest writes.
set -euo pipefail

LOCK_FILE="${APP_TOUR_BUILD_LOCK_FILE:-${TMPDIR:-/tmp}/app-tour-monorepo-build.lock}"
WAIT_SECONDS="${APP_TOUR_BUILD_LOCK_WAIT_SECONDS:-900}"

exec flock -w "$WAIT_SECONDS" "$LOCK_FILE" "$@"
