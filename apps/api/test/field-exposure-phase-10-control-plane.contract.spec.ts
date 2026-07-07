import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const API_CONTROL_PLANE = join(REPO_ROOT, "apps/api/src/exposure/exposure-control-plane.service.ts");
const WEB_CONTROL_PLANE_CLIENT = join(
  REPO_ROOT,
  "apps/web/src/exposure/exposure-control-plane-client.ts",
);
const ACTIVE_SELECTOR = join(REPO_ROOT, "apps/api/src/exposure/resolve-active-delivery-field-ids.ts");
const DISPATCH = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.ts",
);

describe("field exposure phase 10 control-plane selector contract", () => {
  it("documents Phase 10 as engine-only control-plane selector cleanup", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Unified Control Plane Migration — Phase 10/);
    assert.match(text, /activeDeliverySelector = engine_selected_field_ids/);
    assert.match(text, /field-exposure-phase-10-control-plane\.contract\.spec\.ts/);
    assert.match(text, /legacy_mirror_shadow.*FIELD_EXPOSURE_SHADOW_DIAGNOSTICS/s);
  });

  it("keeps API control-plane runtime selector engine-only", () => {
    const api = readFileSync(API_CONTROL_PLANE, "utf8");

    assert.match(api, /activeDeliverySelector: "engine_selected_field_ids"/);
    assert.match(api, /resolveExposureControlPlaneParityInstrumentation/);
    assert.match(api, /legacyShadowDiagnosticsEnabled/);
    assert.doesNotMatch(api, /legacy_eligible_field_ids/);
    assert.doesNotMatch(api, /runtimeMode === "shadow"\s*\?\s*"legacy_mirror_shadow"/);
  });

  it("normalizes web control-plane selector to engine_selected_field_ids", () => {
    const client = readFileSync(WEB_CONTROL_PLANE_CLIENT, "utf8");

    assert.match(client, /activeDeliverySelector: "engine_selected_field_ids"/);
    assert.doesNotMatch(client, /legacy_eligible_field_ids/);
    assert.match(client, /parityInstrumentation/);
  });

  it("keeps active selector helper and dispatch free of legacy selector branches", () => {
    const selectorSource = readFileSync(ACTIVE_SELECTOR, "utf8");
    const dispatch = readFileSync(DISPATCH, "utf8");

    assert.match(selectorSource, /fieldExposureDecision\?\.engineSelectedFieldIds/);
    assert.doesNotMatch(selectorSource, /engineSelectorFallback/);
    assert.doesNotMatch(dispatch, /useEngineCatalogForCandidates: runtimeMode === "cutover"/);
  });
});
