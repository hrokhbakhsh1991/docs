#!/usr/bin/env node
/**
 * Gap Closure D.6 — fail-closed deploy-profile bundle isolation.
 * With APPLY=1 + sample profile, excluded products must leave transpile/guest-runtime plans.
 * @see docs/dev/saas-platform-remediation.mdoc
 */
import { discoverManifests } from "../codegen/workspace-registry/manifest-loader.mjs";
import {
  assertDeployProfileBundlePlanCoherent,
  buildDeployProfileBundlePlan,
  collectAdminProductTranspilePackages,
  collectGuestRuntimeProductPackages,
  filterProductPackagesByDeployProfile,
} from "../codegen/workspace-registry/domains/theme.mjs";

const SAMPLE_PROFILE = "urban,starter";
const EXCLUDED = "@app-tour/workspace-denali";

const env = {
  WORKSPACE_DEPLOY_PROFILE_APPLY: "1",
  WORKSPACE_DEPLOY_PROFILE: SAMPLE_PROFILE,
};

const manifests = discoverManifests();
const plan = buildDeployProfileBundlePlan(manifests, env);
const coherence = assertDeployProfileBundlePlanCoherent(plan);
/** @type {string[]} */
const errors = [];

if (!coherence.ok) {
  errors.push(...coherence.errors.map((e) => `coherence: ${e}`));
}

const adminFull = collectAdminProductTranspilePackages(manifests);
const adminFiltered = filterProductPackagesByDeployProfile(adminFull, SAMPLE_PROFILE);
if (adminFiltered.includes(EXCLUDED)) {
  errors.push(`admin transpile still includes ${EXCLUDED} under profile ${SAMPLE_PROFILE}`);
}
if (!adminFiltered.includes("@app-tour/workspace-urban")) {
  errors.push("admin transpile missing @app-tour/workspace-urban under sample profile");
}

const guestFull = collectGuestRuntimeProductPackages(manifests);
const guestFiltered = filterProductPackagesByDeployProfile(guestFull, SAMPLE_PROFILE);
if (guestFiltered.includes(EXCLUDED)) {
  errors.push(`guest-runtime products still include ${EXCLUDED} under profile ${SAMPLE_PROFILE}`);
}

if (plan.adminTranspileProducts.includes(EXCLUDED)) {
  errors.push(`bundle plan adminTranspileProducts includes excluded ${EXCLUDED}`);
}
if (plan.guestRuntimeProducts.includes(EXCLUDED)) {
  errors.push(`bundle plan guestRuntimeProducts includes excluded ${EXCLUDED}`);
}

if (errors.length > 0) {
  console.error("guard-bundle-profile-isolation: FAIL");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `guard-bundle-profile-isolation: PASS (profile=${SAMPLE_PROFILE}; excluded=${EXCLUDED}; admin=${adminFiltered.length}; guest=${guestFiltered.length})`
);
