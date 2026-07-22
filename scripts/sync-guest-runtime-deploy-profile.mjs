#!/usr/bin/env node
/**
 * Gap Closure C.2c — deploy-image-only guest-runtime product dep sync.
 * Requires WORKSPACE_DEPLOY_PROFILE_APPLY=1. Do not commit the result to trunk.
 * @see docs/dev/wave-c-guest-runtime-product-deps.mdoc
 */
import { discoverManifests } from "./codegen/workspace-registry/manifest-loader.mjs";
import { syncGuestWorkspaceRuntimePackageJsonForDeploy } from "./codegen/workspace-registry/domains/theme.mjs";

try {
  const result = syncGuestWorkspaceRuntimePackageJsonForDeploy(discoverManifests(), process.env);
  console.log(
    `sync:guest-runtime-deploy-profile: ${result.written ? "WRITTEN" : "unchanged"} profile=${JSON.stringify(result.profile)} products=${result.products.length}`
  );
  for (const pkg of result.products) {
    console.log(`  ${pkg}`);
  }
  console.log("NOTE: do not commit packages/guest-workspace-runtime/package.json from a profiled sync");
} catch (err) {
  console.error(`sync:guest-runtime-deploy-profile: FAIL — ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
