#!/usr/bin/env bash
# Generic staging adapter invoked after the guarded artifact deployment.
# Workspace-specific verification may wrap this adapter; this file contains no
# workspace, tenant, hostname, credential, or database values.
set -euo pipefail

MODE="${1:-}"
[[ "$MODE" == "verify-staging" ]] || {
  echo "staging-adapter: expected verify-staging" >&2
  exit 1
}

STAGING_DEPLOY_ROOT="${STAGING_DEPLOY_ROOT:-}"
STAGING_ENV_DIR="${STAGING_ENV_DIR:-}"
DEPLOY_TARGET="${DEPLOY_TARGET:-${DENALI_WALLET_DEPLOY_TARGET:-}}"
STAGING_TENANT_SCOPE="${STAGING_TENANT_SCOPE:-}"
STAGING_ARTIFACT="${STAGING_ARTIFACT:-}"
STAGING_ARTIFACT_DIGEST="${STAGING_ARTIFACT_DIGEST:-}"
STAGING_RELEASE_SHA="${STAGING_RELEASE_SHA:-}"

fail() {
  echo "staging-adapter: $1" >&2
  exit 1
}

[[ "${GITHUB_REF:-}" == "refs/heads/dev" ]] || fail "ref must be refs/heads/dev"
[[ "$DEPLOY_TARGET" == "staging" ]] || fail "deployment target must be staging"
[[ "$STAGING_DEPLOY_ROOT" == "/opt/app-tour-staging" ]] || fail "deployment root is not staging"
[[ "$STAGING_ENV_DIR" == "/etc/app-tour-staging" ]] || fail "environment directory is not staging"
[[ "$STAGING_TENANT_SCOPE" == "pilot-only" ]] || fail "tenant scope must be pilot-only"
[[ "${BULK_TENANT_ENABLEMENT:-0}" != "1" ]] || fail "bulk tenant enablement is forbidden"
[[ "${PRODUCTION_TARGET:-}" == "" ]] || fail "production target is forbidden"
[[ -n "$STAGING_ARTIFACT" && -f "$STAGING_ARTIFACT" ]] || fail "staging artifact is missing"
[[ "$STAGING_ARTIFACT_DIGEST" =~ ^[0-9a-fA-F]{64}$ ]] || fail "artifact digest is invalid"
[[ "$STAGING_RELEASE_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || fail "release SHA is invalid"

actual_digest="$(sha256sum "$STAGING_ARTIFACT" | awk '{print $1}')"
[[ "$actual_digest" == "$STAGING_ARTIFACT_DIGEST" ]] || fail "artifact digest mismatch"

artifact_name="$(basename "$STAGING_ARTIFACT" .tar.zst)"
manifest_release_sha="$(tar -I zstd -xOf "$STAGING_ARTIFACT" "${artifact_name}/release-manifest.json" | node -e 'let s="";process.stdin.on("data", d => s += d).on("end", () => process.stdout.write(JSON.parse(s).releaseSha))')"
[[ "$manifest_release_sha" == "$STAGING_RELEASE_SHA" ]] || fail "artifact release SHA mismatch"

if [[ "${STAGING_ADAPTER_DRY_RUN:-0}" == "1" ]]; then
  echo "STAGING_ADAPTER_DRY_RUN_OK"
  exit 0
fi

: "${VPS_HOST:?staging VPS_HOST required}"
: "${VPS_SSH_KEY:?staging VPS_SSH_KEY required}"
VPS_DEPLOY_PATH="$STAGING_DEPLOY_ROOT/tooling" ENV_DIR="$STAGING_ENV_DIR" UNIT_PREFIX=app-tour-staging \
  bash "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/p10-staging-remote-gate.sh"
