#!/usr/bin/env bash
# Run each guest-conformance sub-guard with clear step labels (GHA-friendly).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

steps=(
  registry_fresh
  intake_plugin_registry
  guest_extension_schema
  no_default_fallback
  generated_banner
  feature_flag_boundary
  guest_e2e_hooks
  structured_errors
  no_todo_guest
  guest_reuse_from
  guest_frozen_shell
  guest_api_shell
  guest_consumer_deps
  guest_conformance_dual_verify
  guest_seo
  guest_seo_e2e_hooks
  registration_flow_state
  member_portal_contract
  no_workspace_ids_in_codegen
  no_workspace_type_branches
  css_bootstrap_integrity
)

for step in "${steps[@]}"; do
  echo "::group::guest_conformance/$step"
  node scripts/guards/guard-guest-plugin-conformance.mjs --only "$step"
  echo "::endgroup::"
done

echo "guest-conformance-each: PASS"
