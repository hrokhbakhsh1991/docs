import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const DISPATCH = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.ts",
);
const RESOLVER = join(REPO_ROOT, "apps/api/src/exposure/resolve-exposure-decision.ts");
const TRIAGE = join(REPO_ROOT, "apps/api/src/exposure/shadow-parity-intentional-mismatch.ts");
const BUILDER = join(REPO_ROOT, "apps/api/src/exposure/build-field-exposure-engine-input.ts");
const ACTIVE_SELECTOR = join(REPO_ROOT, "apps/api/src/exposure/resolve-active-delivery-field-ids.ts");

const PHASE_CONTRACTS = [
  "apps/api/test/field-exposure-phase-a-migration.contract.spec.ts",
  "apps/api/test/field-exposure-phase-b-parity-gate.contract.spec.ts",
  "apps/api/test/field-exposure-phase-c-engine.contract.spec.ts",
  "apps/api/test/field-exposure-phase-d-selector.contract.spec.ts",
  "apps/api/test/field-exposure-phase-e-cleanup.contract.spec.ts",
  "apps/api/test/field-exposure-engine-migration-closure.contract.spec.ts",
] as const;

const UNIFIED_CONTROL_PLANE_CONTRACTS = [
  "apps/api/test/field-exposure-phase-9-preview.contract.spec.ts",
  "apps/api/test/field-exposure-phase-10-control-plane.contract.spec.ts",
  "apps/api/test/field-exposure-phase-11-runtime-metadata.contract.spec.ts",
  "apps/api/test/field-exposure-phase-12-native-intent-metadata.contract.spec.ts",
  "apps/api/test/field-exposure-phase-13-runtime-selection.contract.spec.ts",
  "apps/api/test/field-exposure-phase-d0-simulation.contract.spec.ts",
  "apps/web/test/field-exposure-phase-b-ui.contract.spec.ts",
  "apps/web/test/field-exposure-phase-c-ui.contract.spec.ts",
  "apps/web/test/field-exposure-phase-d0-simulation-client.contract.spec.ts",
  "apps/web/test/field-exposure-phase-d-ui.contract.spec.ts",
] as const;

describe("field exposure engine migration DONE contract", () => {
  it("documents migration DONE definition and phase contract index", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Field Exposure Decision Engine migration — DONE definition/);
    assert.match(text, /field-exposure-engine-migration-done\.contract\.spec\.ts/);
    assert.match(text, /FIELD_EXPOSURE_RUNTIME_MODE=shadow/);
    assert.match(text, /FIELD_EXPOSURE_INTENTIONAL_SHADOW_PARITY_MISMATCHES/);
  });

  it("ships all phase A–E migration contract specs", () => {
    for (const relativePath of PHASE_CONTRACTS) {
      assert.equal(existsSync(join(REPO_ROOT, relativePath)), true, relativePath);
    }
  });

  it("ships unified-control-plane cleanup contract specs", () => {
    for (const relativePath of UNIFIED_CONTROL_PLANE_CONTRACTS) {
      assert.equal(existsSync(join(REPO_ROOT, relativePath)), true, relativePath);
    }
  });

  it("uses engine decisions as the sole cutover selector source", () => {
    const selectorSource = readFileSync(ACTIVE_SELECTOR, "utf8");

    assert.match(selectorSource, /fieldExposureDecision\?\.engineSelectedFieldIds/);
    assert.doesNotMatch(selectorSource, /engineSelectorFallback/);
    assert.doesNotMatch(selectorSource, /fieldIds: input\.legacyEligibleFieldIds/);
  });

  it("projects cutover audit metadata from engine ids instead of legacy eligibility", () => {
    const resolver = readFileSync(RESOLVER, "utf8");

    assert.match(resolver, /resolveEngineCandidateFieldIds/);
    assert.match(resolver, /engineSelectedFieldIds \?\? \[\]/);
  });

  it("builds engine runtime from full catalog and applies intentional mismatch triage", () => {
    const builder = readFileSync(BUILDER, "utf8");
    const dispatch = readFileSync(DISPATCH, "utf8");
    const triage = readFileSync(TRIAGE, "utf8");

    assert.doesNotMatch(builder, /exposureSelectableFieldIds/);
    assert.match(triage, /adjustShadowParityForIntentionalMismatches/);
    assert.match(dispatch, /adjustShadowParityForIntentionalMismatches/);
  });

  it("skips temporary observability stacks in cutover runtime", () => {
    const dispatch = readFileSync(DISPATCH, "utf8");

    assert.match(
      dispatch,
      /runtimeMode === "cutover"\s*\?\s*null\s*:\s*await resolveFieldExposureShadowDiagnostics/,
    );
    assert.match(dispatch, /if \(runtimeMode === "shadow"\) \{/);
  });

  it("retires resolveDeliveryFieldPolicy selector export from delivery definitions module", () => {
    const deliveryDefinitions = readFileSync(
      join(REPO_ROOT, "apps/api/src/integrations/application/delivery-field-definitions.ts"),
      "utf8",
    );

    assert.match(deliveryDefinitions, /export async function resolveDeliveryFieldDefinitions/);
    assert.doesNotMatch(deliveryDefinitions, /export function resolveDeliveryFieldPolicy/);
  });
});
