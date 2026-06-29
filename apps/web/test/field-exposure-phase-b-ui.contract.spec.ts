import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const API_CONTROL_PLANE = join(REPO_ROOT, "apps/api/src/exposure/exposure-control-plane.service.ts");
const WEB_CONTROL_PLANE_CLIENT = join(REPO_ROOT, "apps/web/src/exposure/exposure-control-plane-client.ts");
const CONTROL_PLANE_PAGE = join(
  REPO_ROOT,
  "apps/web/app/(app)/settings/exposure/control-plane/exposure-control-plane-client.tsx",
);
const INTEGRATION_PANEL = join(
  REPO_ROOT,
  "apps/web/app/(app)/settings/integrations/integration-event-delivery-policy-panel.tsx",
);
const SELECTION_LOGIC = join(REPO_ROOT, "apps/web/src/exposure/exposure-field-selection.ts");

describe("field exposure phase B UI contract", () => {
  it("documents stored vs effective coordinate honesty", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Control Plane UI — Phase B/);
    assert.match(text, /storedContext/);
    assert.match(text, /effectiveContext/);
    assert.match(text, /routeScoped/);
    assert.match(text, /field-exposure-phase-b-ui\.contract\.spec\.ts/);
  });

  it("control-plane API and client expose stored/effective coordinate fields", () => {
    const api = readFileSync(API_CONTROL_PLANE, "utf8");
    const client = readFileSync(WEB_CONTROL_PLANE_CLIENT, "utf8");

    for (const source of [api, client]) {
      assert.match(source, /storedContext/);
      assert.match(source, /effectiveContext/);
      assert.match(source, /storedDiffersFromEffective/);
      assert.match(source, /coordinateControlsRuntimeEffective/);
    }
    assert.match(api, /resolveConnectionExposureIntentForRoute/);
    assert.match(api, /coordinateControlsRuntimeEffective: intentResolution\.coordinateControlsRuntimeEffective/);
    assert.match(api, /legacyShadowDiagnosticsEnabled/);
    assert.doesNotMatch(api, /runtimeMode === "shadow"\s*\?\s*"legacy_mirror_shadow"/);
    assert.doesNotMatch(api, /const effectiveContext = \{\s*surface: input\.connection\.provider,\s*audience: LEGACY_DELIVERY_EXTERNAL_CHANNEL_AUDIENCE,\s*trigger: eventType,\s*\}/);
  });

  it("control-plane page labels runtime-effective coordinates honestly for engineering review", () => {
    const controlPlanePage = readFileSync(CONTROL_PLANE_PAGE, "utf8");
    const logic = readFileSync(SELECTION_LOGIC, "utf8");

    assert.match(logic, /isRouteScopedExposureIntent/);
    assert.match(logic, /coordinateControlsRuntimeEffective: routeScoped/);
    assert.doesNotMatch(logic, /coordinateControlsRuntimeEffective: true/);
    assert.match(controlPlanePage, /coordinateRuntimeNotice/);
    assert.match(controlPlanePage, /storedDiffersFromEffective/);
  });

  it("operator delivery policy panel keeps only operator-facing controls", () => {
    const panel = readFileSync(INTEGRATION_PANEL, "utf8");

    assert.match(panel, /TelegramMessagePreview/);
    assert.match(panel, /ExposureFieldChecklist/);
    assert.doesNotMatch(panel, /AdvancedExposureDiagnostics/);
    assert.doesNotMatch(panel, /ExposureEnginePreviewPanel/);
    assert.doesNotMatch(panel, /fetchExposureEnginePreview/);
  });
});
