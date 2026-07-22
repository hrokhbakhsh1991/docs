#!/usr/bin/env node
/**
 * Gap Closure D.2 — print recommended ALLOW_* exports for a deploy-profile plan.
 * @see docs/dev/saas-platform-remediation.mdoc
 */
import { discoverManifests } from "./codegen/workspace-registry/manifest-loader.mjs";
import {
  assertDeployProfileBundlePlanCoherent,
  buildDeployProfileBundlePlan,
  formatDeployProfileAllowEnvExports,
} from "./codegen/workspace-registry/domains/theme.mjs";

const plan = buildDeployProfileBundlePlan(discoverManifests(), process.env);
const coherence = assertDeployProfileBundlePlanCoherent(plan);
if (!coherence.ok) {
  console.error("print:deploy-profile-env: FAIL — plan incoherent");
  for (const err of coherence.errors) console.error(`  ${err}`);
  process.exit(1);
}

process.stdout.write(
  `# deploy-profile applied=${plan.applied} profile=${JSON.stringify(plan.profile)}\n`
);
process.stdout.write(formatDeployProfileAllowEnvExports(plan));
