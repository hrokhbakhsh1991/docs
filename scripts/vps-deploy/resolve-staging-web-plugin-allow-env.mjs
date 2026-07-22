#!/usr/bin/env node
/**
 * Gap Closure D.4 — resolve IgnorePlugin ALLOW_* exports for staging web builds.
 * Default (no APPLY): legacy staging behavior — ALLOW_DENALI_WEB_PLUGIN=true only.
 * With WORKSPACE_DEPLOY_PROFILE_APPLY=1: deploy-profile plan recommendations.
 * @see docs/dev/saas-platform-remediation.mdoc
 */
import { discoverManifests } from "../codegen/workspace-registry/manifest-loader.mjs";
import {
  assertDeployProfileBundlePlanCoherent,
  buildDeployProfileBundlePlan,
  formatDeployProfileAllowEnvExports,
  resolveWorkspaceDeployProfile,
} from "../codegen/workspace-registry/domains/theme.mjs";

/** Legacy staging client allow — Denali-only (pre–Gap Closure D.4). */
export const STAGING_WEB_LEGACY_ALLOW_EXPORTS = 'export ALLOW_DENALI_WEB_PLUGIN="true"\n';

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @param {import("../codegen/workspace-registry/manifest-loader.mjs").WorkspaceManifest[]} [manifests]
 * @returns {{ readonly mode: "legacy" | "deploy-profile"; readonly shell: string }}
 */
export function resolveStagingWebPluginAllowEnv(env = process.env, manifests = discoverManifests()) {
  const resolved = resolveWorkspaceDeployProfile(env);
  if (!resolved.applied) {
    return { mode: "legacy", shell: STAGING_WEB_LEGACY_ALLOW_EXPORTS };
  }
  const plan = buildDeployProfileBundlePlan(manifests, env);
  const coherence = assertDeployProfileBundlePlanCoherent(plan);
  if (!coherence.ok) {
    throw new Error(
      `resolve-staging-web-plugin-allow-env: plan incoherent\n${coherence.errors.map((e) => `  - ${e}`).join("\n")}`
    );
  }
  return {
    mode: "deploy-profile",
    shell: formatDeployProfileAllowEnvExports(plan),
  };
}

function main() {
  try {
    const result = resolveStagingWebPluginAllowEnv(process.env);
    process.stdout.write(`# staging-web-plugin-allow mode=${result.mode}\n`);
    process.stdout.write(result.shell);
  } catch (err) {
    console.error(
      `resolve-staging-web-plugin-allow-env: FAIL — ${err instanceof Error ? err.message : err}`
    );
    process.exit(1);
  }
}

import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
