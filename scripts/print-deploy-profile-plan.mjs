#!/usr/bin/env node
/**
 * Gap Closure D.1 — print deploy-profile bundle plan (transpile ∩ IgnorePlugin).
 * Hermetic without APPLY; profiled when WORKSPACE_DEPLOY_PROFILE_APPLY=1.
 * @see docs/dev/saas-platform-remediation.mdoc
 */
import { discoverManifests } from "./codegen/workspace-registry/manifest-loader.mjs";
import {
  assertDeployProfileBundlePlanCoherent,
  buildDeployProfileBundlePlan,
} from "./codegen/workspace-registry/domains/theme.mjs";

const plan = buildDeployProfileBundlePlan(discoverManifests(), process.env);
const coherence = assertDeployProfileBundlePlanCoherent(plan);

console.log(
  JSON.stringify(
    {
      applied: plan.applied,
      profile: plan.profile,
      adminTranspileProducts: plan.adminTranspileProducts,
      guestRuntimeProducts: plan.guestRuntimeProducts,
      clientIgnore: plan.clientIgnore,
      recommendedProcessEnv: plan.recommendedProcessEnv,
      coherent: coherence.ok,
      ...(coherence.ok ? {} : { errors: coherence.errors }),
    },
    null,
    2
  )
);

if (!coherence.ok) {
  process.exit(1);
}
