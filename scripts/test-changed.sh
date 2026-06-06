#!/usr/bin/env bash
# Git-aware workspace tests — only packages touched (and dependents) since base ref.
# Cache: .cache/test-changed/<filter>.sha — skip when diff hash unchanged.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="ci"
while [ $# -gt 0 ]; do
  case "$1" in
    --mode)
      MODE="${2:-ci}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

CACHE_DIR="$ROOT/.cache/test-changed"
mkdir -p "$CACHE_DIR"

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

BASE="$(resolve_base)"
CHANGED=""

collect_diff() {
  local ref="$1"
  if git rev-parse --verify "$ref" >/dev/null 2>&1; then
    git diff --name-only "$ref"...HEAD 2>/dev/null || true
  fi
}

if [ "$MODE" = "pre-commit" ]; then
  MB="$(git merge-base HEAD "$BASE" 2>/dev/null || echo "$BASE")"
  CHANGED="$( {
    git diff --name-only "$MB"...HEAD 2>/dev/null || true
    git diff --cached --name-only 2>/dev/null || true
    git diff --name-only 2>/dev/null || true
  } | sort -u)"
else
  CHANGED="$(collect_diff "$BASE" | sort -u)"
fi

if [ -z "$(echo "$CHANGED" | tr -d '[:space:]')" ]; then
  echo "test-changed: no changed files (base=$BASE mode=$MODE) — skip"
  exit 0
fi

# path prefix → pnpm filter name
pkg_for_path() {
  case "$1" in
    packages/workspace-sdk/*) echo "@app-tour/workspace-sdk" ;;
    packages/platform-core/*) echo "@app-tour/platform-core" ;;
    packages/design-tokens/*) echo "@app-tour/design-tokens" ;;
    packages/ui-primitives/*) echo "@app-tour/ui-primitives" ;;
    packages/theme-react/*) echo "@app-tour/theme-react" ;;
    packages/tenant-kernel/*) echo "@app-tour/tenant-kernel" ;;
    packages/platform-events/*) echo "@app-tour/platform-events" ;;
    packages/workspaces/starter/*) echo "@app-tour/workspace-starter" ;;
    apps/api/*) echo "@apps/api" ;;
    apps/web/*) echo "@apps/web" ;;
    scripts/* | infra/* | docs/* | reports/* | .github/* | .husky/*)
      echo "__scripts__"
      ;;
    *) echo "" ;;
  esac
}

# When package P changes, also run tests for these dependents (transitive closure applied below)
expand_pkg() {
  case "$1" in
    @app-tour/workspace-sdk)
      echo "@app-tour/workspace-sdk @app-tour/platform-core @app-tour/workspace-starter @app-tour/theme-react @apps/api @apps/web"
      ;;
    @app-tour/platform-core)
      echo "@app-tour/platform-core @app-tour/workspace-starter @apps/api @apps/web"
      ;;
    @app-tour/design-tokens)
      echo "@app-tour/design-tokens @app-tour/ui-primitives @app-tour/theme-react @apps/web"
      ;;
    @app-tour/ui-primitives)
      echo "@app-tour/ui-primitives @apps/web"
      ;;
    @app-tour/theme-react)
      echo "@app-tour/theme-react @apps/web"
      ;;
    @app-tour/tenant-kernel)
      echo "@app-tour/tenant-kernel @apps/api"
      ;;
    @app-tour/platform-events)
      echo "@app-tour/platform-events @apps/api"
      ;;
    @app-tour/workspace-starter)
      echo "@app-tour/workspace-starter @apps/api @apps/web"
      ;;
    @apps/api) echo "@apps/api" ;;
    @apps/web) echo "@apps/web" ;;
    @app-tour/workspace-sdk|@app-tour/platform-core|@app-tour/design-tokens|@app-tour/ui-primitives|@app-tour/theme-react|@app-tour/tenant-kernel|@app-tour/platform-events|@app-tour/workspace-starter)
      echo "$1"
      ;;
    *) echo "" ;;
  esac
}

SEED=""
while IFS= read -r path; do
  [ -z "$path" ] && continue
  p="$(pkg_for_path "$path")"
  [ -z "$p" ] && continue
  if [ "$p" = "__scripts__" ]; then
    SEED="${SEED} @app-tour/workspace-sdk @app-tour/platform-core @apps/api @apps/web"
  else
    SEED="${SEED} $(expand_pkg "$p")"
  fi
done <<< "$CHANGED"

# Deduplicate targets
TARGETS=""
for t in $SEED; do
  case " $TARGETS " in
    *" $t "*) ;;
    *) TARGETS="${TARGETS} $t" ;;
  esac
done

if [ -z "$(echo "$TARGETS" | tr -d '[:space:]')" ]; then
  echo "test-changed: no testable workspaces in diff — skip"
  exit 0
fi

hash_pkg() {
  local pkg="$1"
  local prefix=""
  case "$pkg" in
    @app-tour/workspace-sdk) prefix="packages/workspace-sdk" ;;
    @app-tour/platform-core) prefix="packages/platform-core" ;;
    @app-tour/design-tokens) prefix="packages/design-tokens" ;;
    @app-tour/ui-primitives) prefix="packages/ui-primitives" ;;
    @app-tour/theme-react) prefix="packages/theme-react" ;;
    @app-tour/tenant-kernel) prefix="packages/tenant-kernel" ;;
    @app-tour/platform-events) prefix="packages/platform-events" ;;
    @app-tour/workspace-starter) prefix="packages/workspaces/starter" ;;
    @apps/api) prefix="apps/api" ;;
    @apps/web) prefix="apps/web" ;;
    *) return 1 ;;
  esac
  {
    echo "base=$BASE"
    echo "mode=$MODE"
    echo "pkg=$pkg"
    git rev-parse HEAD 2>/dev/null || true
    echo "$CHANGED" | grep "^${prefix}/" || true
  } | sha256sum | awk '{print $1}'
}

has_test_script() {
  local dir="$1"
  [ -f "$dir/package.json" ] || return 1
  (
    cd "$dir"
    node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts.test?0:1)"
  ) 2>/dev/null
}

pkg_dir() {
  case "$1" in
    @app-tour/workspace-sdk) echo "packages/workspace-sdk" ;;
    @app-tour/platform-core) echo "packages/platform-core" ;;
    @app-tour/design-tokens) echo "packages/design-tokens" ;;
    @app-tour/ui-primitives) echo "packages/ui-primitives" ;;
    @app-tour/theme-react) echo "packages/theme-react" ;;
    @app-tour/tenant-kernel) echo "packages/tenant-kernel" ;;
    @app-tour/platform-events) echo "packages/platform-events" ;;
    @app-tour/workspace-starter) echo "packages/workspaces/starter" ;;
    @apps/api) echo "apps/api" ;;
    @apps/web) echo "apps/web" ;;
    *) echo "" ;;
  esac
}

FAILED=0
for pkg in $TARGETS; do
  dir="$(pkg_dir "$pkg")"
  if [ -z "$dir" ] || ! has_test_script "$dir"; then
    echo "test-changed: skip $pkg (no test script)"
    continue
  fi
  safe_name="$(echo "$pkg" | tr '/:@' '___')"
  digest="$(hash_pkg "$pkg" || echo "none")"
  cache_file="$CACHE_DIR/${safe_name}.sha"
  if [ -f "$cache_file" ] && [ "$(cat "$cache_file")" = "$digest" ]; then
    echo "test-changed: cache HIT $pkg"
    continue
  fi
  echo "test-changed: RUN pnpm --filter $pkg test"
  if pnpm --filter "$pkg" test; then
    echo "$digest" >"$cache_file"
  else
    FAILED=1
  fi
done

if [ "$FAILED" -ne 0 ]; then
  echo "test-changed: FAIL" >&2
  exit 1
fi
echo "test-changed: PASS (base=$BASE mode=$MODE)"
