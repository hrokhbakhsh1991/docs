#!/usr/bin/env node
/**
 * Phase 7 — tour RBAC / validation drift guardrails (prompt.md).
 *
 * Static parity checks (no DB):
 * 1. PATCH rank gates: @repo/types ↔ API tour-patch-field-policy ↔ web editCoreFieldConfig
 * 2. PATCH DTO coverage: every UpdateTourDto key appears in API policy matrix
 * 3. Write pipeline wiring on ToursController
 * 4. Submit-required wiring: API uses @repo/types getRequiredSubmitFieldPathsForProfile
 *
 * Run parity unit tests separately in CI (see architecture-guardrails tour-rbac-parity job).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const failures = [];

function fail(message) {
  failures.push(message);
}

function readRepo(relPath) {
  const abs = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(abs)) {
    fail(`missing file: ${relPath}`);
    return "";
  }
  return fs.readFileSync(abs, "utf8");
}

/** Extract `{ dtoKey, minRoleForEdit }` rows from TS policy tables. */
function extractPatchRankGates(source, arrayName) {
  const gates = new Map();
  const arrayStart = source.indexOf(arrayName);
  if (arrayStart < 0) {
    return gates;
  }
  const slice = source.slice(arrayStart, arrayStart + 12_000);
  const ruleRe =
    /dtoKey:\s*["']([^"']+)["'][^{]*minRoleForEdit:\s*["']([^"']+)["']/g;
  let match;
  while ((match = ruleRe.exec(slice)) !== null) {
    gates.set(match[1], match[2]);
  }
  return gates;
}

/** Web `CORE_ROLE_OVERRIDES` leader gates → wire DTO keys. */
function extractWebCoreLeaderGates(source) {
  const gates = new Map();
  const wireByEditId = {
    "core.totalCapacity": "total_capacity",
    "core.capacity": "total_capacity",
  };
  const block = source.includes("CORE_ROLE_OVERRIDES")
    ? source.slice(source.indexOf("CORE_ROLE_OVERRIDES"))
    : source;
  const re =
    /["'](core\.(?:totalCapacity|capacity))["']:\s*\{[^}]*minRoleForEdit:\s*["']([^"']+)["']/g;
  let match;
  while ((match = re.exec(block)) !== null) {
    const wireKey = wireByEditId[match[1]];
    if (wireKey) {
      gates.set(wireKey, match[2]);
    }
  }
  return gates;
}

const TOUR_PATCH_CONTRACT_REL = "packages/shared-contracts/src/tours/tour-patch-contract.ts";

function extractApiPolicyDtoKeys(source) {
  const keys = new Set();
  const arrayStart =
    source.indexOf("TOUR_PATCH_CONTRACT_RULES") >= 0
      ? source.indexOf("TOUR_PATCH_CONTRACT_RULES")
      : source.indexOf("TOUR_PATCH_FIELD_POLICY_RULES");
  if (arrayStart < 0) {
    return keys;
  }
  const slice = source.slice(arrayStart, arrayStart + 14_000);
  const re = /dtoKey:\s*["']([^"']+)["']/g;
  let match;
  while ((match = re.exec(slice)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

function extractUpdateTourDtoKeys(source) {
  const keys = new Set();
  const classMatch = source.match(/export class UpdateTourDto\s*\{([\s\S]*?)^\}/m);
  if (!classMatch) {
    return keys;
  }
  const body = classMatch[1];
  const re = /^\s{2}([a-zA-Z][\w]*)\??:/gm;
  let match;
  while ((match = re.exec(body)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

function checkPatchRankGateParity() {
  const typesSrc = readRepo("packages/types/src/tour-patch-field-policy.ts");
  const contractSrc = readRepo(TOUR_PATCH_CONTRACT_REL);
  const webSrc = readRepo("apps/web/src/features/tours/config/editCoreFieldConfig.ts");

  const typesGates = extractPatchRankGates(typesSrc, "TOUR_PATCH_FIELD_RULES");
  const apiGates = extractPatchRankGates(contractSrc, "TOUR_PATCH_CONTRACT_RULES");
  const webGates = extractWebCoreLeaderGates(webSrc);

  for (const [dtoKey, minRole] of typesGates) {
    const apiRole = apiGates.get(dtoKey);
    if (apiRole !== minRole) {
      fail(
        `[patch-rank] @repo/types ${dtoKey} minRole=${minRole} but API has ${apiRole ?? "none"}`,
      );
    }
    const webRole = webGates.get(dtoKey);
    if (webRole !== minRole) {
      fail(
        `[patch-rank] @repo/types ${dtoKey} minRole=${minRole} but web editCore maps to ${webRole ?? "none"}`,
      );
    }
  }

  for (const [dtoKey, minRole] of apiGates) {
    if (!typesGates.has(dtoKey)) {
      fail(
        `[patch-rank] API ranks ${dtoKey}@${minRole} but @repo/types TOUR_PATCH_FIELD_RULES omits it — extend types mirror`,
      );
    }
  }
}

function checkPatchDtoCoverage() {
  const dtoSrc = readRepo("apps/api/src/modules/tours/dto/update-tour.dto.ts");
  const contractSrc = readRepo(TOUR_PATCH_CONTRACT_REL);
  const dtoKeys = extractUpdateTourDtoKeys(dtoSrc);
  const policyKeys = extractApiPolicyDtoKeys(contractSrc);

  for (const key of dtoKeys) {
    if (!policyKeys.has(key)) {
      fail(`[patch-coverage] UpdateTourDto.${key} missing from TOUR_PATCH_FIELD_POLICY_RULES`);
    }
  }

  for (const key of policyKeys) {
    if (!dtoKeys.has(key)) {
      fail(`[patch-coverage] policy dtoKey ${key} not found on UpdateTourDto`);
    }
  }
}

function checkWritePipelineWiring() {
  const controller = readRepo("apps/api/src/modules/tours/tours.controller.ts");
  if (!controller.includes("assertTourPatchWritePreMerge")) {
    fail("[pipeline] ToursController.update must call assertTourPatchWritePreMerge");
  }
  if (!controller.includes("assertTourCreateWritePreMerge")) {
    fail("[pipeline] ToursController.create must call assertTourCreateWritePreMerge");
  }
  if (controller.includes("assertTourPatchAbilities(")) {
    fail("[pipeline] use assertTourPatchWritePreMerge instead of direct assertTourPatchAbilities");
  }
}

function checkSubmitRequiredWiring() {
  const apiAssert = readRepo(
    "apps/api/src/modules/tours/utils/assert-profile-required-fields-for-submit.ts",
  );
  if (!apiAssert.includes("getRequiredSubmitFieldPathsForProfile")) {
    fail("[submit-required] API assert must import getRequiredSubmitFieldPathsForProfile from @repo/types");
  }
  if (!apiAssert.includes("@repo/types")) {
    fail("[submit-required] API assert must depend on @repo/types");
  }

  const typesSrc = readRepo("packages/types/src/tour-profile-submit-required.ts");
  if (!typesSrc.includes("WIZARD_SUBMIT_REQUIRED_FIELD_PATHS")) {
    fail("[submit-required] missing WIZARD_SUBMIT_REQUIRED_FIELD_PATHS in @repo/types");
  }

  const publishTransition = readRepo(
    "apps/api/src/modules/tours/policies/assert-tour-publish-transition.ts",
  );
  if (!publishTransition.includes("assertProfileRequiredFieldsForPublish")) {
    fail("[submit-required] assert-tour-publish-transition must call assertProfileRequiredFieldsForPublish");
  }

  const service = readRepo("apps/api/src/modules/tours/tours.service.ts");
  if (service.includes("assertProfileRequiredFieldsForSubmit(resolvedFormProfile, dto)")) {
    fail(
      "[submit-required] Draft CREATE must not call assertProfileRequiredFieldsForSubmit (strict gates on OPEN/PUBLISH only)",
    );
  }
  if (!service.includes("assertTourStateReadyForOpenAfterPatch")) {
    fail("[submit-required] tours.service must enforce OPEN/PUBLISH via assertTourStateReadyForOpenAfterPatch");
  }
}

function extractRegisteredCapabilities() {
  const registrySrc = readRepo("packages/shared/rbac/capability-registry.ts");
  const capsSrc = readRepo("packages/shared/rbac/capabilities.ts");
  const registered = new Set();
  const start = registrySrc.indexOf("WORKSPACE_CAPABILITY_VALUES");
  if (start >= 0) {
    const slice = registrySrc.slice(start, start + 2500);
    const re = /"([a-zA-Z][a-zA-Z0-9_.]+)"/g;
    let match;
    while ((match = re.exec(slice)) !== null) {
      registered.add(match[1]);
    }
  }
  for (const name of [
    "TOUR_CAPABILITIES",
    "SETTINGS_CAPABILITIES",
    "MODULE_CAPABILITIES",
    "MARKETING_CAPABILITIES",
  ]) {
    const blockStart = capsSrc.indexOf(`export const ${name}`);
    if (blockStart < 0) {
      continue;
    }
    const block = capsSrc.slice(blockStart, blockStart + 1500);
    const re = /"([a-zA-Z][a-zA-Z0-9_.]+)"/g;
    let match;
    while ((match = re.exec(block)) !== null) {
      registered.add(match[1]);
    }
  }
  return registered;
}

function checkPatchPolicyCapabilityParity() {
  const policy = readRepo(TOUR_PATCH_CONTRACT_REL);
  const registered = extractRegisteredCapabilities();
  const used = new Set();
  const re = /requiredCapability:\s*"([^"]+)"/g;
  let match;
  while ((match = re.exec(policy)) !== null) {
    used.add(match[1]);
  }
  for (const cap of used) {
    if (!registered.has(cap)) {
      fail(`[patch-capability] tour-patch-field-policy uses unknown capability "${cap}"`);
    }
  }
  const coreCaps = new Set();
  const tripCaps = new Set();
  const groupRe = /group:\s*"(core|tripDetails)"[^{]*requiredCapability:\s*"([^"]+)"/g;
  while ((match = groupRe.exec(policy)) !== null) {
    if (match[1] === "core") {
      coreCaps.add(match[2]);
    } else {
      tripCaps.add(match[2]);
    }
  }
  if (!coreCaps.has("tour.update.core")) {
    fail("[patch-capability] policy core group must use tour.update.core");
  }
  if (!tripCaps.has("tour.update.tripDetails")) {
    fail("[patch-capability] policy tripDetails group must use tour.update.tripDetails");
  }
  if (coreCaps.size !== 1) {
    fail(`[patch-capability] expected single core capability, got: ${[...coreCaps].join(", ")}`);
  }
  if (tripCaps.size !== 1) {
    fail(
      `[patch-capability] expected single tripDetails capability, got: ${[...tripCaps].join(", ")}`,
    );
  }
}

function checkSubmitRequiredParityArtifacts() {
  const paritySpec = readRepo(
    "apps/web/src/features/tours/wizard/profileRules/submit-required-parity.spec.ts",
  );
  if (!paritySpec.includes("getRequiredSubmitFieldPathsForProfile")) {
    fail("[submit-required] web submit-required-parity.spec must use @repo/types paths");
  }
  if (!paritySpec.includes("requiredFieldsForProfile")) {
    fail("[submit-required] web submit-required-parity.spec must compare requiredFieldsForProfile");
  }

  const editParity = readRepo(
    "apps/web/src/features/tours/wizard/profileRules/edit-required-parity.spec.ts",
  );
  if (!editParity.includes("getEditRequiredTripDetailsPathsForProfile")) {
    fail("[edit-required] web edit-required-parity.spec must use @repo/types");
  }
}

function checkGovernanceEntrypoints() {
  for (const script of [
    "run-tour-governance.mjs",
    "audit-capability-registry.mjs",
  ]) {
    const abs = path.join(REPO_ROOT, "scripts", script);
    if (!fs.existsSync(abs)) {
      fail(`[governance] missing scripts/${script}`);
    }
  }
}

function checkMutationAbilityGroups() {
  const abilities = readRepo("apps/api/src/modules/tours/policies/assert-tour-mutation-abilities.ts");
  const policy = readRepo("apps/api/src/modules/tours/utils/tour-patch-field-policy.ts");

  const coreKeys = new Set();
  const tripKeys = new Set();
  const coreBlock = abilities.match(/CORE_PATCH_KEYS[\s\S]*?TRIP_DETAILS_PATCH_KEYS/);
  const tripBlock = abilities.match(/TRIP_DETAILS_PATCH_KEYS[\s\S]*?function forbidCapability/);
  if (coreBlock) {
    const re = /"([^"]+)"/g;
    let m;
    while ((m = re.exec(coreBlock[0])) !== null) {
      coreKeys.add(m[1]);
    }
  }
  if (tripBlock) {
    const re = /"([^"]+)"/g;
    let m;
    while ((m = re.exec(tripBlock[0])) !== null) {
      tripKeys.add(m[1]);
    }
  }

  const policyCore = new Set();
  const policyTrip = new Set();
  const ruleRe = /\{\s*dtoKey:\s*"([^"]+)"[\s\S]*?group:\s*"(core|tripDetails)"/g;
  let match;
  while ((match = ruleRe.exec(policy)) !== null) {
    if (match[2] === "core") {
      policyCore.add(match[1]);
    } else {
      policyTrip.add(match[1]);
    }
  }

  for (const key of policyCore) {
    if (!coreKeys.has(key)) {
      fail(
        `[casl-groups] policy core field ${key} missing from CORE_PATCH_KEYS in assert-tour-mutation-abilities`,
      );
    }
  }
  for (const key of policyTrip) {
    if (!tripKeys.has(key)) {
      fail(
        `[casl-groups] policy tripDetails field ${key} missing from TRIP_DETAILS_PATCH_KEYS`,
      );
    }
  }
}

checkPatchRankGateParity();
checkPatchDtoCoverage();
checkPatchPolicyCapabilityParity();
checkWritePipelineWiring();
checkSubmitRequiredWiring();
checkSubmitRequiredParityArtifacts();
checkGovernanceEntrypoints();
checkMutationAbilityGroups();

if (failures.length > 0) {
  console.error("[tour-rbac-parity] FAILED:\n");
  for (const line of failures) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log("[tour-rbac-parity] OK (static checks)");
