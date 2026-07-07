import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseWorkspaceExposureControlPlaneResponse } from "../src/exposure/exposure-control-plane-client";

describe("parseWorkspaceExposureControlPlaneResponse", () => {
  it("normalizes stale activeDeliverySelector values to engine_selected_field_ids", () => {
    const parsed = parseWorkspaceExposureControlPlaneResponse({
      workspaceType: "denali",
      runtime: {
        fieldExposureRuntimeMode: "shadow",
        forwardEngineShadowEnabled: false,
        activeDeliverySelector: "legacy_eligible_field_ids",
        parityInstrumentation: "legacy_mirror_shadow",
      },
      connections: [],
    });

    assert.equal(parsed.runtime.activeDeliverySelector, "engine_selected_field_ids");
    assert.equal(parsed.runtime.parityInstrumentation, "legacy_mirror_shadow");
  });

  it("defaults unknown parity instrumentation to none", () => {
    const parsed = parseWorkspaceExposureControlPlaneResponse({
      workspaceType: "denali",
      runtime: {
        fieldExposureRuntimeMode: "cutover",
        forwardEngineShadowEnabled: true,
        activeDeliverySelector: "unknown_selector",
        parityInstrumentation: "unexpected",
      },
      connections: [],
    });

    assert.equal(parsed.runtime.activeDeliverySelector, "engine_selected_field_ids");
    assert.equal(parsed.runtime.parityInstrumentation, "none");
    assert.equal(parsed.runtime.forwardEngineShadowEnabled, true);
  });
});
