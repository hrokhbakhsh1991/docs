#!/usr/bin/env sh
# Zero-Debt doc-first gate — staged changes in core packages require docs/ touch.
# Protected paths align with .cursorrules Doc-First Covenant (+ packages/core alias).
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "guard-docs: skip (not a git repository)"
  exit 0
fi

STAGED="$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)"
if [ -z "$STAGED" ]; then
  exit 0
fi

core_touched=false
docs_touched=false

for path in $STAGED; do
  case "$path" in
    packages/platform-core/* | packages/workspace-sdk/* | packages/core/* | apps/api/*)
      core_touched=true
      ;;
    docs/*)
      docs_touched=true
      ;;
  esac
done

if [ "$core_touched" = false ]; then
  exit 0
fi

if [ "$docs_touched" = true ]; then
  echo "guard-docs: PASS (core change paired with docs/)"
  exit 0
fi

echo "guard-docs: FAIL" >&2
echo "" >&2
echo "Doc-First Covenant: staged changes under protected paths require a staged change under docs/." >&2
echo "" >&2
echo "Protected paths:" >&2
echo "  - packages/platform-core/" >&2
echo "  - packages/workspace-sdk/" >&2
echo "  - packages/core/" >&2
echo "  - apps/api/" >&2
echo "" >&2
echo "Stage at least one of: docs/*.md, docs/*.mdoc (Markdoc), or related audit under docs/audits/." >&2
echo "Propose technical detail, logic, or diagrams — not wording-only edits." >&2
exit 1
