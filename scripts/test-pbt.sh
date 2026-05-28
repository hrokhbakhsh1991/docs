#!/usr/bin/env bash
# Run property-based tests (*.property.spec.ts) via Jest + fast-check.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

exec pnpm exec jest --config jest.pbt.config.js "$@"
