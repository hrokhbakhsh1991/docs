#!/usr/bin/env bash
# Verify P7 evidence pack manifest (T4 / 98+ exit).
set -euo pipefail

MANIFEST="${1:-}"

if [[ -z "$MANIFEST" ]]; then
  EVIDENCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../docs/phase-20/p7/evidence" 2>/dev/null && pwd || echo "")"
  if [[ -n "$EVIDENCE_ROOT" && -d "$EVIDENCE_ROOT" ]]; then
    MANIFEST="$(find "$EVIDENCE_ROOT" -name manifest.yaml -type f 2>/dev/null | sort | tail -1)"
  fi
fi

if [[ -z "$MANIFEST" || ! -f "$MANIFEST" ]]; then
  echo "P7_EVIDENCE_PACK_VERIFY: no manifest (template-only OK for doc gate)"
  echo "P7_EVIDENCE_PACK_VERIFY_OK"
  exit 0
fi

fail() {
  echo "P7_EVIDENCE_PACK_VERIFY_FAIL: $*" >&2
  exit 1
}

grep -q 'evidence_pack_version:' "$MANIFEST" || fail "missing evidence_pack_version"
grep -q 'club_id:' "$MANIFEST" || fail "missing club_id"
grep -q 'git_sha:' "$MANIFEST" || fail "missing git_sha"

if grep -q 'git_sha: "<commit' "$MANIFEST"; then
  fail "git_sha placeholder not replaced"
fi

for gate in p7_gate p7_staging_gate p7_staging_e2e; do
  grep -q "${gate}:" "$MANIFEST" || fail "missing gates.${gate}"
done

for vs in VS-01 VS-02 VS-03 VS-04 VS-05 VS-06 VS-07 VS-08; do
  grep -q "${vs}:" "$MANIFEST" || fail "missing vertical_slice.${vs}"
done

echo "P7_EVIDENCE_PACK_VERIFY_OK manifest=$MANIFEST"
