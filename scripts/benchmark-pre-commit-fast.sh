#!/usr/bin/env bash
# Benchmark the current staged change three times: first cold, then two warm runs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SCENARIO="${1:-}"
case "$SCENARIO" in
  docs) BUDGET_SECONDS=10 ;;
  ui) BUDGET_SECONDS=30 ;;
  package-api) BUDGET_SECONDS=60 ;;
  *)
    echo "usage: bash scripts/benchmark-pre-commit-fast.sh <docs|ui|package-api>" >&2
    exit 2
    ;;
esac

STAGED="$(git diff --cached --name-only --diff-filter=ACMR)"
if [ -z "$STAGED" ]; then
  echo "benchmark-pre-commit-fast: no staged files" >&2
  exit 2
fi

case "$SCENARIO" in
  docs)
    if echo "$STAGED" | grep -qEv '^(docs/|reports/|[^/]+\.(md|mdoc|json|ya?ml)$)'; then
      echo "benchmark-pre-commit-fast: docs scenario contains non-documentation paths" >&2
      exit 2
    fi
    ;;
  ui)
    if echo "$STAGED" | grep -qEv '^apps/(web|portal|marketing)/'; then
      echo "benchmark-pre-commit-fast: ui scenario contains paths outside UI apps" >&2
      exit 2
    fi
    ;;
  package-api)
    if ! echo "$STAGED" | grep -qE '^(apps/api/|packages/)'; then
      echo "benchmark-pre-commit-fast: package-api scenario needs an API or package path" >&2
      exit 2
    fi
    if echo "$STAGED" | grep -qEv '^(apps/api/|packages/|docs/)'; then
      echo "benchmark-pre-commit-fast: package-api scenario contains unrelated paths" >&2
      exit 2
    fi
    ;;
esac

BENCH_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/pre-commit-fast-benchmark.XXXXXX")"
cleanup() {
  rm -rf "$BENCH_ROOT"
}
trap cleanup EXIT

echo "benchmark-pre-commit-fast: scenario=$SCENARIO budget=${BUDGET_SECONDS}s"
printf "run\tcache\tduration_seconds\tstatus\n"

FAILED=0
for run in 1 2 3; do
  cache_state="warm"
  if [ "$run" -eq 1 ]; then
    cache_state="cold"
  fi
  report_dir="$BENCH_ROOT/report-$run"
  if PRE_COMMIT_FAST_REPORT_DIR="$report_dir" \
    TEST_CHANGED_CACHE_DIR="$BENCH_ROOT/test-changed-cache" \
    FAST_PATH_BUDGET_SECONDS="$BUDGET_SECONDS" \
    bash scripts/pre-commit-fast.sh; then
    status="PASS"
  else
    status="FAIL"
    FAILED=1
  fi
  duration="$(awk -F '\t' '$1 == "TOTAL" { print $3 }' "$report_dir/latest.tsv")"
  if [ "$duration" -gt "$BUDGET_SECONDS" ]; then
    status="OVER_BUDGET"
    FAILED=1
  fi
  printf "%s\t%s\t%s\t%s\n" "$run" "$cache_state" "$duration" "$status"
done

if [ "$FAILED" -ne 0 ]; then
  echo "benchmark-pre-commit-fast: FAIL" >&2
  exit 1
fi

echo "benchmark-pre-commit-fast: PASS (3/3)"
