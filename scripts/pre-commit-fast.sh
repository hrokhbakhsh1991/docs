#!/usr/bin/env bash
# Fast-path pre-commit — target <60s: doc gate, engine, eslint/prettier on diff, changed tests only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "pre-commit-fast: guard-docs"
sh scripts/guard-docs.sh

echo "pre-commit-fast: guard-field-exposure-phase-0"
node scripts/guards/field-exposure-phase-0-guard.mjs

echo "pre-commit-fast: guard-field-exposure-phase-1"
node scripts/guards/field-exposure-phase-1-guard.mjs

echo "pre-commit-fast: guard-field-exposure-phase-2"
node scripts/guards/field-exposure-phase-2-guard.mjs

echo "pre-commit-fast: guard-field-exposure-phase-3"
node scripts/guards/field-exposure-phase-3-guard.mjs

echo "pre-commit-fast: guard-field-exposure-phase-4"
node scripts/guards/field-exposure-phase-4-guard.mjs

echo "pre-commit-fast: guard-field-exposure-phase-5"
node scripts/guards/field-exposure-phase-5-guard.mjs

echo "pre-commit-fast: guard-field-exposure-phase-6"
node scripts/guards/field-exposure-phase-6-guard.mjs

echo "pre-commit-fast: guard-field-exposure-phase-7"
node scripts/guards/field-exposure-phase-7-guard.mjs

echo "pre-commit-fast: guard-field-exposure-phase-8"
node scripts/guards/field-exposure-phase-8-guard.mjs

echo "pre-commit-fast: guard-field-exposure-phase-9"
node scripts/guards/field-exposure-phase-9-guard.mjs

echo "pre-commit-fast: guard-field-exposure-phase-10"
node scripts/guards/field-exposure-phase-10-guard.mjs

echo "pre-commit-fast: guard-field-exposure-phase-11"
node scripts/guards/field-exposure-phase-11-guard.mjs

echo "pre-commit-fast: guard-wizard-post-submit"
node scripts/guards/guard-wizard-post-submit-contract.mjs

echo "pre-commit-fast: guard-css-globals"
node scripts/guards/guard-css-globals-import-only.mjs

echo "pre-commit-fast: check-node-engine"
node scripts/guards/check-node-engine.mjs

resolve_base() {
  if git rev-parse --verify origin/main >/dev/null 2>&1; then
    echo "origin/main"
    return
  fi
  if git rev-parse --verify main >/dev/null 2>&1; then
    echo "main"
    return
  fi
  git rev-parse HEAD~1 2>/dev/null || echo "HEAD"
}

STAGED="$(git diff --cached --name-only 2>/dev/null || true)"
BASE="$(resolve_base)"
MB="$(git merge-base HEAD "$BASE" 2>/dev/null || echo "$BASE")"
# Lint/format only what is being committed; tests still use broader diff in test-changed.
LINT_FILES="$(echo "$STAGED" | sort -u)"

lint_ts() {
  local cfg="$1"
  shift
  local f
  local any=0
  for f in "$@"; do
    [ -z "$f" ] && continue
    any=1
    pnpm exec eslint --max-warnings 0 -c "$cfg" "$f"
  done
  return 0
}

if [ -n "$(echo "$LINT_FILES" | tr -d '[:space:]')" ]; then
  ROOT_TS="$(echo "$LINT_FILES" | grep -E '\.(ts|tsx)$' | grep -E '^(packages/workspace-sdk|packages/platform-core)/' || true)"
  WEB_TS="$(echo "$LINT_FILES" | grep -E '\.(ts|tsx)$' | grep -E '^apps/web/' || true)"
  PRETTIER_FILES="$(echo "$LINT_FILES" | grep -E '\.(ts|tsx|json|md|mdoc|yml|yaml)$' | grep -vE '^pnpm-lock\.yaml$' || true)"

  if [ -n "$ROOT_TS" ]; then
    echo "pre-commit-fast: eslint (platform packages)"
    # shellcheck disable=SC2086
    lint_ts "$ROOT/.eslintrc.cjs" $ROOT_TS
  fi
  if [ -n "$WEB_TS" ]; then
    echo "pre-commit-fast: eslint (@apps/web)"
    # shellcheck disable=SC2086
    lint_ts "$ROOT/apps/web/.eslintrc.cjs" $WEB_TS
  fi

  if [ -n "$(echo "$PRETTIER_FILES" | tr -d '[:space:]')" ]; then
    if pnpm exec prettier --version >/dev/null 2>&1; then
      if [ -f .prettierrc ] || [ -f .prettierrc.json ] || [ -f .prettierrc.js ] || [ -f prettier.config.js ] || [ -f prettier.config.mjs ]; then
        echo "pre-commit-fast: prettier --check"
        while IFS= read -r f; do
          [ -z "$f" ] && continue
          [ -e "$ROOT/$f" ] || continue
          pnpm exec prettier --check "$f"
        done <<< "$PRETTIER_FILES"
      else
        echo "pre-commit-fast: prettier available but no config — skip"
      fi
    else
      echo "pre-commit-fast: prettier not installed — skip"
    fi
  fi
else
  echo "pre-commit-fast: no staged files — skip eslint/prettier"
fi

echo "pre-commit-fast: test-changed (pre-commit mode)"
bash scripts/test-changed.sh --mode pre-commit

echo "pre-commit-fast: PASS"
