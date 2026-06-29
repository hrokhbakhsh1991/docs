#!/usr/bin/env node
/**
 * Field Exposure System — Phase 4 exposure profile default source closure guard.
 *
 * @see docs/architecture/field-exposure-system.md#phase-4--exposure-profile-default-source-closure
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const ARCHITECTURE_README = join(REPO_ROOT, "docs/architecture/README.md");
const EXPOSURE_CATALOG = join(REPO_ROOT, "apps/api/src/exposure/exposure-field-catalog.ts");
const EXPOSURE_CATALOG_SPEC = join(
  REPO_ROOT,
  "apps/api/src/exposure/exposure-field-catalog.spec.ts"
);
const PROFILE_RESOLVER = join(
  REPO_ROOT,
  "apps/api/src/exposure/resolve-registry-seeded-exposure-profile.ts"
);
const PROFILE_RESOLVER_SPEC = join(
  REPO_ROOT,
  "apps/api/src/exposure/resolve-registry-seeded-exposure-profile.spec.ts"
);
const EXPOSURE_PROFILE = join(REPO_ROOT, "apps/api/src/exposure/exposure-profile.ts");
const LEGACY_MAPPER = join(
  REPO_ROOT,
  "apps/api/src/exposure/legacy-delivery-exposure-mapper.ts"
);
const LEGACY_MAPPER_SPEC = join(
  REPO_ROOT,
  "apps/api/src/exposure/legacy-delivery-exposure-mapper.spec.ts"
);
const EXPOSURE_PROFILE_SPEC = join(
  REPO_ROOT,
  "apps/api/src/exposure/exposure-profile.spec.ts"
);
const POLICY_ENGINE = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/integration-policy-engine.ts"
);
const DELIVERY_DEFINITIONS = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/delivery-field-definitions.ts"
);
const DELIVERY_DEFINITIONS_SPEC = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/delivery-field-definitions.spec.ts"
);
const INTEGRATION_CATALOG = join(
  REPO_ROOT,
  "apps/api/src/integrations/platform/build-delivery-field-catalog.ts"
);
const INTEGRATION_META = join(
  REPO_ROOT,
  "apps/api/src/integrations/platform/integration-surface-meta.ts"
);
const INTEGRATIONS_SERVICE = join(
  REPO_ROOT,
  "apps/api/src/integrations/http/integrations.service.ts"
);
const PHASE_4_CONTRACT = join(
  REPO_ROOT,
  "apps/api/test/field-exposure-phase-4-profile.contract.spec.ts"
);
const PHASE_4_DENALI_PARITY = join(
  REPO_ROOT,
  "apps/api/test/field-exposure-phase-4-denali-profile-parity.spec.ts"
);

const INTEGRATION_RUNTIME_DIRS = [
  join(REPO_ROOT, "apps/api/src/integrations/application"),
  join(REPO_ROOT, "apps/api/src/integrations/http"),
  join(REPO_ROOT, "apps/api/src/integrations/platform"),
];

const REQUIRED_DOC_MARKERS = [
  "## Phase 4 — Exposure Profile Default Source Closure",
  "exposure-field-catalog.ts",
  "resolveRegistrySeededExposureProfile",
  "resolveDeliveryFieldDefinitions",
  "delivery-field-definitions.ts",
  "registry_deliverable_migration_seed",
  "guard:field-exposure-phase-4",
  "field-exposure-phase-4-profile.contract.spec.ts",
  "field-exposure-phase-4-denali-profile-parity.spec.ts",
];

function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function listTypeScriptFiles(dir) {
  const files = [];
  if (!existsSync(dir)) {
    return files;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

function main() {
  const failures = [];

  const exposureDoc = readText(EXPOSURE_DOC);
  if (!exposureDoc?.includes("Phase 4 complete")) {
    failures.push("field-exposure-system.md must mark Phase 4 complete");
  }
  for (const marker of REQUIRED_DOC_MARKERS) {
    if (!exposureDoc?.includes(marker)) {
      failures.push(`field-exposure-system.md missing Phase 4 marker: ${marker}`);
    }
  }
  const phase4Start =
    exposureDoc?.indexOf("## Phase 4 — Exposure Profile Default Source Closure") ?? -1;
  const phase4End =
    exposureDoc?.indexOf("## Phase 5 — Generic Exposure UI", phase4Start) ?? -1;
  if (phase4Start >= 0 && phase4End > phase4Start) {
    const phase4Section = exposureDoc.slice(phase4Start, phase4End);
    if (/^- \[ \]/m.test(phase4Section)) {
      failures.push("Phase 4 checklist has unchecked items");
    }
  }

  const readme = readText(ARCHITECTURE_README);
  if (!readme?.includes("guard:field-exposure-phase-4")) {
    failures.push("docs/architecture/README.md must reference guard:field-exposure-phase-4");
  }

  for (const path of [
    PHASE_4_CONTRACT,
    PHASE_4_DENALI_PARITY,
    EXPOSURE_CATALOG,
    EXPOSURE_CATALOG_SPEC,
    PROFILE_RESOLVER,
    PROFILE_RESOLVER_SPEC,
    LEGACY_MAPPER,
    LEGACY_MAPPER_SPEC,
    EXPOSURE_PROFILE_SPEC,
  ]) {
    if (!existsSync(path)) {
      failures.push(`missing ${path.replace(`${REPO_ROOT}/`, "")}`);
    }
  }

  const catalog = readText(EXPOSURE_CATALOG);
  if (!catalog?.includes("buildExposureSelectableFieldCatalog")) {
    failures.push("exposure-field-catalog.ts must own deliverable selectable catalog");
  }
  if (!catalog?.includes('DELIVERABLE_REGISTRY_TAG = "deliverable"')) {
    failures.push("exposure-field-catalog.ts must filter deliverable registry tag");
  }

  const profileResolver = readText(PROFILE_RESOLVER);
  if (!profileResolver?.includes("resolveRegistrySeededExposureProfile")) {
    failures.push("resolve-registry-seeded-exposure-profile.ts missing resolver");
  }
  if (!profileResolver?.includes("resolveExposureProfileDefaultFieldIds")) {
    failures.push("resolve-registry-seeded-exposure-profile.ts missing default field ids helper");
  }
  if (!profileResolver?.includes("resolveDeliveryExposureProfileContext")) {
    failures.push("resolve-registry-seeded-exposure-profile.ts missing delivery profile context");
  }

  const exposureProfile = readText(EXPOSURE_PROFILE);
  if (!exposureProfile?.includes("defaultTemplateId")) {
    failures.push("exposure-profile.ts must include defaultTemplateId on seeded profiles");
  }
  if (!exposureProfile?.includes("DENALI_TELEGRAM_TOUR_CREATED_PROFILE_SLUG")) {
    failures.push("exposure-profile.ts must document Denali telegram_tour_created slug");
  }

  const legacyMapper = readText(LEGACY_MAPPER);
  if (!legacyMapper?.includes("resolveRegistrySeededExposureProfile")) {
    failures.push("legacy-delivery-exposure-mapper must resolve seeded exposure profile");
  }
  if (!legacyMapper?.includes("ExposureProfile")) {
    failures.push("legacy-delivery-exposure-mapper must return ExposureProfile view");
  }

  const policyEngine = readText(POLICY_ENGINE);
  if (!policyEngine?.includes("resolveRegistrySeededExposureProfile")) {
    failures.push("integration-policy-engine must resolve seeded exposure profile");
  }
  if (!policyEngine?.includes("resolveDeliveryExposureProfileContext")) {
    failures.push("integration-policy-engine must use delivery exposure profile context");
  }

  const deliveryDefinitions = readText(DELIVERY_DEFINITIONS);
  if (!deliveryDefinitions?.includes("resolveDeliveryFieldDefinitions")) {
    failures.push("delivery-field-definitions must expose definitions-only adapter");
  }
  if (!deliveryDefinitions?.includes("exposureCatalogFieldIds")) {
    failures.push("delivery-field-definitions must adapt definitions from exposure catalog");
  }
  if (deliveryDefinitions?.includes("export function resolveDeliveryFieldPolicy")) {
    failures.push("delivery-field-definitions must not export legacy selector helper");
  }
  if (deliveryDefinitions?.includes("../platform/build-delivery-field-catalog")) {
    failures.push("delivery-field-definitions must not import integration catalog builder");
  }

  const deliveryDefinitionsSpec = readText(DELIVERY_DEFINITIONS_SPEC);
  if (!deliveryDefinitionsSpec?.includes("resolveDeliveryFieldDefinitions")) {
    failures.push("delivery-field-definitions spec must cover definitions-only adapter");
  }

  const legacyDeliveryPolicy = join(
    REPO_ROOT,
    "apps/api/src/integrations/application/resolve-delivery-field-policy.ts",
  );
  if (existsSync(legacyDeliveryPolicy)) {
    failures.push("resolve-delivery-field-policy.ts legacy module must be removed");
  }

  const integrationCatalog = readText(INTEGRATION_CATALOG);
  if (!integrationCatalog?.includes("exposure-field-catalog")) {
    failures.push("integration build-delivery-field-catalog must re-export exposure catalog");
  }
  if (!integrationCatalog?.includes("resolveExposureProfileDefaultFieldIds")) {
    failures.push("getDefaultDeliveryFields must delegate to exposure profile defaults");
  }
  if (integrationCatalog?.includes('DELIVERABLE_REGISTRY_TAG = "deliverable"')) {
    failures.push("deliverable tag filter must not remain in integration catalog module");
  }

  const integrationMeta = readText(INTEGRATION_META);
  if (!integrationMeta?.includes("buildExposureSelectableFieldCatalog")) {
    failures.push("integration surface meta must source catalog from exposure module");
  }
  if (integrationMeta?.includes('from "./build-delivery-field-catalog"')) {
    failures.push("integration surface meta must not import catalog from integration builder");
  }

  const integrationsService = readText(INTEGRATIONS_SERVICE);
  if (!integrationsService?.includes("buildExposureSelectableFieldCatalog")) {
    failures.push("integrations service must validate against exposure selectable catalog");
  }

  for (const dir of INTEGRATION_RUNTIME_DIRS) {
    for (const filePath of listTypeScriptFiles(dir)) {
      if (filePath.endsWith("build-delivery-field-catalog.ts")) {
        continue;
      }
      const source = readText(filePath);
      if (source?.includes('DELIVERABLE_REGISTRY_TAG = "deliverable"')) {
        failures.push(`deliverable tag constant outside exposure module: ${filePath}`);
      }
      if (source?.includes('.includes("deliverable")') || source?.includes(".includes('deliverable')")) {
        failures.push(`direct deliverable tag filter outside exposure module: ${filePath}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error("field-exposure-phase-4-guard: FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("field-exposure-phase-4-guard: PASS");
}

main();
