import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const GUARD_SCRIPT = join(REPO_ROOT, "scripts/guards/field-exposure-phase-4-guard.mjs");
const EXPOSURE_CATALOG = join(REPO_ROOT, "apps/api/src/exposure/exposure-field-catalog.ts");
const PROFILE_RESOLVER = join(
  REPO_ROOT,
  "apps/api/src/exposure/resolve-registry-seeded-exposure-profile.ts"
);
const INTEGRATION_CATALOG = join(
  REPO_ROOT,
  "apps/api/src/integrations/platform/build-delivery-field-catalog.ts"
);
const LEGACY_MAPPER = join(REPO_ROOT, "apps/api/src/exposure/legacy-delivery-exposure-mapper.ts");
const POLICY_ENGINE = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/integration-policy-engine.ts"
);
const INTEGRATION_META = join(
  REPO_ROOT,
  "apps/api/src/integrations/platform/integration-surface-meta.ts"
);
const PHASE_4_DENALI_PARITY = join(
  REPO_ROOT,
  "apps/api/test/field-exposure-phase-4-denali-profile-parity.spec.ts"
);

describe("field exposure phase 4 profile contract", () => {
  it("architecture doc marks Phase 4 complete with profile closure section", () => {
    assert.equal(existsSync(EXPOSURE_DOC), true);
    const text = readFileSync(EXPOSURE_DOC, "utf8");
    assert.match(text, /Phase 4 complete/i);
    assert.match(text, /## Phase 4 — Exposure Profile Default Source Closure/);
    assert.match(text, /guard:field-exposure-phase-4/);
    assert.match(text, /exposure-field-catalog\.ts/);
  });

  it("exposure module owns catalog and seeded profile defaults", () => {
    const catalog = readFileSync(EXPOSURE_CATALOG, "utf8");
    assert.match(catalog, /buildExposureSelectableFieldCatalog/);
    assert.match(catalog, /deliverable/);

    const resolver = readFileSync(PROFILE_RESOLVER, "utf8");
    assert.match(resolver, /resolveRegistrySeededExposureProfile/);
    assert.match(readFileSync(join(REPO_ROOT, "apps/api/src/exposure/exposure-profile.ts"), "utf8"), /REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED/);
  });

  it("integration layer delegates catalog and defaults to exposure module", () => {
    const integrationCatalog = readFileSync(INTEGRATION_CATALOG, "utf8");
    assert.match(integrationCatalog, /exposure-field-catalog/);
    assert.match(integrationCatalog, /resolveExposureProfileDefaultFieldIds/);

    const integrationMeta = readFileSync(INTEGRATION_META, "utf8");
    assert.match(integrationMeta, /buildExposureSelectableFieldCatalog/);
    assert.doesNotMatch(integrationMeta, /from "\.\/build-delivery-field-catalog"/);

    const deliveryDefinitions = readFileSync(
      join(REPO_ROOT, "apps/api/src/integrations/application/delivery-field-definitions.ts"),
      "utf8",
    );
    assert.match(deliveryDefinitions, /resolveDeliveryFieldDefinitions/);
    assert.match(deliveryDefinitions, /exposureCatalogFieldIds/);
    assert.doesNotMatch(deliveryDefinitions, /export function resolveDeliveryFieldPolicy/);
    assert.doesNotMatch(deliveryDefinitions, /build-delivery-field-catalog/);

    const legacyMapper = readFileSync(LEGACY_MAPPER, "utf8");
    assert.match(legacyMapper, /resolveRegistrySeededExposureProfile/);

    const policyEngine = readFileSync(POLICY_ENGINE, "utf8");
    assert.match(policyEngine, /resolveDeliveryExposureProfileContext/);
    assert.match(policyEngine, /resolveRegistrySeededExposureProfile/);
  });

  it("includes Denali profile parity contract test", () => {
    assert.equal(existsSync(PHASE_4_DENALI_PARITY), true);
  });

  it("phase 4 guard passes on repository closure state", () => {
    assert.equal(existsSync(GUARD_SCRIPT), true);
    const result = spawnSync("node", [GUARD_SCRIPT], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout || "guard failed");
  });
});
