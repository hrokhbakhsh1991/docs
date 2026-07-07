import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const PREVIEW_SERVICE = join(
  REPO_ROOT,
  "apps/api/src/exposure/exposure-engine-preview.service.ts",
);
const CONTROL_PLANE_SERVICE = join(
  REPO_ROOT,
  "apps/api/src/exposure/exposure-control-plane.service.ts",
);

describe("field exposure phase 9 preview dependency closure contract", () => {
  it("documents Phase 9 as preview and dependency closure", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Unified Control Plane Migration — Phase 9/);
    assert.match(text, /preview and dependency closure/);
    assert.match(text, /legacyComparison/);
    assert.match(text, /field-exposure-phase-9-preview\.contract\.spec\.ts/);
  });

  it("keeps engine preview free of legacy delivery selector dependencies", () => {
    const preview = readFileSync(PREVIEW_SERVICE, "utf8");

    assert.doesNotMatch(preview, /resolveDeliveryFieldPolicy/);
    assert.doesNotMatch(preview, /legacyComparison/);
    assert.match(preview, /resolveFieldExposureDecision/);
    assert.match(preview, /resolveDeterministicExposurePreviewPayload/);
    assert.match(preview, /samplePayload/);
    assert.match(preview, /resolveIntegrationPolicyExposureCoordinate/);
    assert.doesNotMatch(preview, /trigger: eventType,\s*exposureIntent/);
  });

  it("keeps control-plane preview engine-selected and deterministic", () => {
    const controlPlane = readFileSync(CONTROL_PLANE_SERVICE, "utf8");

    assert.match(controlPlane, /buildFieldExposureEngineDecisionMap/);
    assert.match(controlPlane, /resolveEngineSelectedFieldIds/);
    assert.match(controlPlane, /resolveDeterministicExposurePreviewPayload/);
    assert.doesNotMatch(controlPlane, /legacy_eligible_field_ids/);
  });
});
