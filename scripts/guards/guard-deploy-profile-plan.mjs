#!/usr/bin/env node
/**
 * Gap Closure D.1 — fail-closed deploy-profile bundle plan coherence.
 * Always checks hermetic full-trunk + one sample profiled plan (urban,starter).
 * @see docs/dev/saas-platform-remediation.mdoc
 */
import { discoverManifests } from "../codegen/workspace-registry/manifest-loader.mjs";
import {
  assertDeployProfileBundlePlanCoherent,
  buildDeployProfileBundlePlan,
} from "../codegen/workspace-registry/domains/theme.mjs";

const manifests = discoverManifests();

const full = buildDeployProfileBundlePlan(manifests, {});
const fullCheck = assertDeployProfileBundlePlanCoherent(full);
if (!fullCheck.ok) {
  console.error("guard-deploy-profile-plan: FAIL — full-trunk plan incoherent");
  for (const err of fullCheck.errors) console.error(`  ${err}`);
  process.exit(1);
}

const profiled = buildDeployProfileBundlePlan(manifests, {
  WORKSPACE_DEPLOY_PROFILE_APPLY: "1",
  WORKSPACE_DEPLOY_PROFILE: "urban,starter",
});
const profiledCheck = assertDeployProfileBundlePlanCoherent(profiled);
if (!profiledCheck.ok) {
  console.error("guard-deploy-profile-plan: FAIL — sample profile plan incoherent");
  for (const err of profiledCheck.errors) console.error(`  ${err}`);
  process.exit(1);
}

const denali = profiled.clientIgnore.find((row) => row.label === "denali" || row.id === "denali");
const urban = profiled.clientIgnore.find((row) => row.id === "urban");
if (denali?.inProfile === true) {
  console.error("guard-deploy-profile-plan: FAIL — denali should be out of urban,starter profile");
  process.exit(1);
}
if (urban?.inProfile !== true) {
  console.error("guard-deploy-profile-plan: FAIL — urban should be in urban,starter profile");
  process.exit(1);
}
if (profiled.adminTranspileProducts.includes("@app-tour/workspace-denali")) {
  console.error("guard-deploy-profile-plan: FAIL — denali must leave filtered admin transpile set");
  process.exit(1);
}
if (!profiled.adminTranspileProducts.includes("@app-tour/workspace-urban")) {
  console.error("guard-deploy-profile-plan: FAIL — urban must remain in filtered admin transpile set");
  process.exit(1);
}

console.log(
  `guard-deploy-profile-plan: PASS (full products=${full.adminTranspileProducts.length}; sample profile products=${profiled.adminTranspileProducts.length}; ignoreRules=${full.clientIgnore.length})`
);
