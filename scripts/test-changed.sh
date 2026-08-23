#!/usr/bin/env bash
# Git-aware workspace tests — only packages touched (and dependents) since base ref.
# Pre-commit: staged files only (not full branch vs main or the dirty worktree).
# CI: origin/main...HEAD, full dependency expansion, full workspace test scripts.
# Cache: .cache/test-changed/<filter>.sha — content-addressed, not HEAD-addressed.
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

CACHE_DIR="${TEST_CHANGED_CACHE_DIR:-$ROOT/.cache/test-changed}"
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
  CHANGED="$(git diff --cached --name-only 2>/dev/null | sort -u)"
elif [ "$MODE" = "gate" ]; then
  CHANGED="$(git diff --name-only origin/main 2>/dev/null; git ls-files --others --exclude-standard)"
else
  CHANGED="$(collect_diff "$BASE" | sort -u)"
fi

if { [ "$MODE" = "pre-commit" ] || [ "$MODE" = "gate" ]; } && [ -z "$(echo "$CHANGED" | tr -d '[:space:]')" ]; then
  echo "test-changed: no staged files (mode=$MODE) — skip"
  exit 0
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
    packages/draft-engine/*) echo "@app-tour/draft-engine" ;;
    packages/wizard-navigation/*) echo "@app-tour/wizard-navigation" ;;
    packages/workspaces/denali/*) echo "@app-tour/workspace-denali" ;;
    packages/workspaces/urban/*) echo "@app-tour/workspace-urban" ;;
    packages/workspaces/guest-club/*) echo "@app-tour/workspace-guest-club" ;;
    apps/api/*) echo "@apps/api" ;;
    apps/web/*) echo "@apps/web" ;;
    apps/portal/*) echo "@apps/portal" ;;
    apps/marketing/*) echo "@apps/marketing" ;;
    scripts/* | infra/* | docs/* | reports/* | .github/* | .husky/*)
      echo "__scripts__"
      ;;
    *) echo "" ;;
  esac
}

# When package P changes, also run tests for these dependents (CI mode only)
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
    @app-tour/draft-engine)
      echo "@app-tour/draft-engine @apps/web"
      ;;
    @app-tour/wizard-navigation)
      echo "@app-tour/wizard-navigation @apps/web"
      ;;
    @app-tour/workspace-denali)
      echo "@app-tour/workspace-denali @apps/web"
      ;;
    @apps/api) echo "@apps/api" ;;
    @apps/web) echo "@apps/web" ;;
    @apps/portal) echo "@apps/portal" ;;
    @apps/marketing) echo "@apps/marketing" ;;
    @app-tour/workspace-urban) echo "@app-tour/workspace-urban" ;;
    @app-tour/workspace-guest-club) echo "@app-tour/workspace-guest-club" ;;
    @app-tour/workspace-starter|@app-tour/draft-engine|@app-tour/wizard-navigation|@app-tour/workspace-denali|@app-tour/workspace-sdk|@app-tour/platform-core|@app-tour/design-tokens|@app-tour/ui-primitives|@app-tour/theme-react|@app-tour/tenant-kernel|@app-tour/platform-events)
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
  if [ "$MODE" = "pre-commit" ] || [ "$MODE" = "gate" ]; then
    if [ "$p" = "__scripts__" ]; then
      continue
    fi
    SEED="${SEED} ${p}"
  else
    if [ "$p" = "__scripts__" ]; then
      SEED="${SEED} @app-tour/workspace-sdk @app-tour/platform-core @apps/api @apps/web"
    else
      SEED="${SEED} $(expand_pkg "$p")"
    fi
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

hash_paths() {
  local paths="$1"
  local path content_hash
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    printf "path=%s\n" "$path"
    if [ "$MODE" = "pre-commit" ]; then
      if git cat-file -e ":$path" 2>/dev/null; then
        content_hash="$(git show ":$path" | sha256sum | awk '{print $1}')"
        printf "content=%s\n" "$content_hash"
      else
        echo "content=DELETED"
      fi
    elif [ "$MODE" = "gate" ] && [ -f "$path" ]; then
      content_hash="$(sha256sum "$path" | awk '{print $1}')"
      printf "content=%s\n" "$content_hash"
    elif git cat-file -e "HEAD:$path" 2>/dev/null; then
      content_hash="$(git show "HEAD:$path" | sha256sum | awk '{print $1}')"
      printf "content=%s\n" "$content_hash"
    else
      echo "content=DELETED"
    fi
  done <<<"$paths"
}

hash_file_if_present() {
  local path="$1"
  local content_hash
  printf "support=%s:" "$path"
  if [ "$MODE" = "pre-commit" ]; then
    if git cat-file -e ":$path" 2>/dev/null; then
      content_hash="$(git show ":$path" | sha256sum | awk '{print $1}')"
      echo "$content_hash"
    else
      echo "MISSING"
    fi
  elif [ "$MODE" = "gate" ] && [ -f "$path" ]; then
    echo "$(sha256sum "$path" | awk '{print $1}')"
  elif git cat-file -e "HEAD:$path" 2>/dev/null; then
    content_hash="$(git show "HEAD:$path" | sha256sum | awk '{print $1}')"
    echo "$content_hash"
  else
    echo "MISSING"
  fi
}

hash_pkg() {
  local pkg="$1"
  local prefix=""
  local relevant_paths=""
  case "$pkg" in
    @app-tour/workspace-sdk) prefix="packages/workspace-sdk" ;;
    @app-tour/platform-core) prefix="packages/platform-core" ;;
    @app-tour/design-tokens) prefix="packages/design-tokens" ;;
    @app-tour/ui-primitives) prefix="packages/ui-primitives" ;;
    @app-tour/theme-react) prefix="packages/theme-react" ;;
    @app-tour/tenant-kernel) prefix="packages/tenant-kernel" ;;
    @app-tour/platform-events) prefix="packages/platform-events" ;;
    @app-tour/workspace-starter) prefix="packages/workspaces/starter" ;;
    @app-tour/draft-engine) prefix="packages/draft-engine" ;;
    @app-tour/wizard-navigation) prefix="packages/wizard-navigation" ;;
    @app-tour/workspace-denali) prefix="packages/workspaces/denali" ;;
    @app-tour/workspace-urban) prefix="packages/workspaces/urban" ;;
    @app-tour/workspace-guest-club) prefix="packages/workspaces/guest-club" ;;
    @apps/api) prefix="apps/api" ;;
    @apps/web) prefix="apps/web" ;;
    @apps/portal) prefix="apps/portal" ;;
    @apps/marketing) prefix="apps/marketing" ;;
    *) return 1 ;;
  esac
  if [ "$MODE" = "pre-commit" ] || [ "$MODE" = "gate" ]; then
    relevant_paths="$(echo "$CHANGED" | grep "^${prefix}/" || true)"
  else
    # CI targets may be selected because an upstream dependency changed.
    relevant_paths="$CHANGED"
  fi
  {
    echo "mode=$MODE"
    echo "pkg=$pkg"
    hash_paths "$relevant_paths"
    hash_file_if_present "$prefix/package.json"
    hash_file_if_present "pnpm-lock.yaml"
    hash_file_if_present "scripts/test-changed.sh"
    hash_file_if_present "scripts/lib/resolve-api-test-specs.mjs"
    hash_file_if_present "scripts/lib/resolve-web-test-specs.mjs"
  } | sha256sum | awk '{print $1}'
}

hash_target_specs() {
  local specs_json="$1"
  local pkg="$2"
  local prefix="$3"
  {
    echo "mode=$MODE"
    echo "pkg=$pkg"
    echo "spec-level"
    echo "$specs_json"
    hash_paths "$(echo "$CHANGED" | grep "^${prefix}/" || true)"
    hash_file_if_present "$prefix/package.json"
    hash_file_if_present "pnpm-lock.yaml"
    hash_file_if_present "scripts/test-changed.sh"
    hash_file_if_present "scripts/lib/resolve-api-test-specs.mjs"
    hash_file_if_present "scripts/lib/resolve-web-test-specs.mjs"
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
    @app-tour/draft-engine) echo "packages/draft-engine" ;;
    @app-tour/wizard-navigation) echo "packages/wizard-navigation" ;;
    @app-tour/workspace-denali) echo "packages/workspaces/denali" ;;
    @app-tour/workspace-urban) echo "packages/workspaces/urban" ;;
    @app-tour/workspace-guest-club) echo "packages/workspaces/guest-club" ;;
    @apps/api) echo "apps/api" ;;
    @apps/web) echo "apps/web" ;;
    @apps/portal) echo "apps/portal" ;;
    @apps/marketing) echo "apps/marketing" ;;
    *) echo "" ;;
  esac
}

run_api_tests() {
  if [ "$MODE" = "pre-commit" ] || [ "$MODE" = "gate" ]; then
    local resolve_json specs_list fallback
    resolve_json="$(printf '%s\n' "$CHANGED" | node "$ROOT/scripts/lib/resolve-api-test-specs.mjs")"
    fallback="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).fallbackBaseline?'yes':'no')" "$resolve_json")"
    if [ "$fallback" = "yes" ]; then
      echo "test-changed: WARN unmapped API production path; full API suite deferred to checkpoint/CI"
      echo "test-changed: RUN @apps/api baseline fallback (3 memory specs)"
      pnpm --filter @apps/api run test:file \
        test/package-boundary.spec.ts \
        test/resolve-workspace-type.spec.ts \
        test/tours-operator.spec.ts
      return $?
    fi
    specs_list="$(TEST_CHANGED_GATE="$([ "$MODE" = "gate" ] && echo 1 || true)" node -e "
      const allSpecs = JSON.parse(process.argv[1]).specs;
      const specs = process.env.TEST_CHANGED_GATE ? allSpecs.filter((spec) => !/(performance|perf|stress|postgres|nightly)/i.test(spec)) : allSpecs;
      if (!specs.length) process.exit(2);
      process.stdout.write(specs.join(' '));
    " "$resolve_json")" || {
      echo "test-changed: no runnable API specs resolved — skip"
      return 0
    }
    echo "test-changed: RUN pnpm --filter @apps/api run test:file ${specs_list}"
    # shellcheck disable=SC2086
    pnpm --filter @apps/api run test:file ${specs_list}
    return $?
  fi
  echo "test-changed: RUN pnpm --filter @apps/api test"
  pnpm --filter @apps/api test
}

run_web_tests() {
  local resolve_json specs_list fallback
  resolve_json="$(printf '%s\n' "$CHANGED" | node "$ROOT/scripts/lib/resolve-web-test-specs.mjs")"
  fallback="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).fallbackBaseline?'yes':'no')" "$resolve_json")"
  if [ "$fallback" = "yes" ]; then
    echo "test-changed: WARN unmapped web production path; full web suite deferred to checkpoint/CI"
    echo "test-changed: RUN @apps/web baseline fallback (3 memory specs)"
    pnpm --filter @apps/web run test:file \
      test/barrel-hunt.spec.ts \
      test/dashboard-smoke.spec.ts \
      test/phase-9.contract.spec.ts
    return $?
  fi
  specs_list="$(node -e "
    const specs = JSON.parse(process.argv[1]).specs;
    if (!specs.length) process.exit(2);
    process.stdout.write(specs.join(' '));
  " "$resolve_json")" || {
    echo "test-changed: no runnable web specs resolved — skip"
    return 0
  }
  echo "test-changed: RUN pnpm --filter @apps/web run test:file ${specs_list}"
  # shellcheck disable=SC2086
  pnpm --filter @apps/web run test:file ${specs_list}
}

FAILED=0
for pkg in $TARGETS; do
  dir="$(pkg_dir "$pkg")"
  if [ -z "$dir" ] || ! has_test_script "$dir"; then
    echo "test-changed: skip $pkg (no test script)"
    continue
  fi
  safe_name="$(echo "$pkg" | tr '/:@' '___')"

  if { [ "$pkg" = "@apps/api" ] || [ "$pkg" = "@apps/web" ]; } && { [ "$MODE" = "pre-commit" ] || [ "$MODE" = "gate" ]; }; then
    if [ "$pkg" = "@apps/api" ]; then
      resolve_json="$(printf '%s\n' "$CHANGED" | node "$ROOT/scripts/lib/resolve-api-test-specs.mjs")"
    else
      resolve_json="$(printf '%s\n' "$CHANGED" | node "$ROOT/scripts/lib/resolve-web-test-specs.mjs")"
    fi
    fallback="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).fallbackBaseline?'yes':'no')" "$resolve_json")"
    if [ "$fallback" = "yes" ]; then
      digest="$(hash_pkg "$pkg" || echo "none")"
      cache_file="$CACHE_DIR/${safe_name}.sha"
    else
      digest="$(hash_target_specs "$resolve_json" "$pkg" "$dir" || echo "none")"
      cache_file="$CACHE_DIR/${safe_name}-specs.sha"
    fi
  else
    digest="$(hash_pkg "$pkg" || echo "none")"
    cache_file="$CACHE_DIR/${safe_name}.sha"
  fi

  if [ -f "$cache_file" ] && [ "$(cat "$cache_file")" = "$digest" ]; then
    echo "test-changed: cache HIT $pkg"
    continue
  fi

  if [ "$pkg" = "@apps/api" ]; then
    if run_api_tests; then
      echo "$digest" >"$cache_file"
    else
      FAILED=1
    fi
  elif [ "$pkg" = "@apps/web" ] && { [ "$MODE" = "pre-commit" ] || [ "$MODE" = "gate" ]; }; then
    if run_web_tests; then
      echo "$digest" >"$cache_file"
    else
      FAILED=1
    fi
  else
    echo "test-changed: RUN pnpm --filter $pkg test"
    if pnpm --filter "$pkg" test; then
      echo "$digest" >"$cache_file"
    else
      FAILED=1
    fi
  fi
done

if [ "$FAILED" -ne 0 ]; then
  echo "test-changed: FAIL" >&2
  exit 1
fi
echo "test-changed: PASS (base=$BASE mode=$MODE)"
