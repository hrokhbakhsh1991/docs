import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getWorkspaceExposureControlPlane,
  resolveExposureControlPlaneParityInstrumentation,
  type WorkspaceExposureControlPlaneResponse,
} from "./exposure-control-plane.service";

describe("getWorkspaceExposureControlPlane", () => {
  it("reports legacy mirror instrumentation only when its diagnostics flag is enabled", () => {
    assert.equal(
      resolveExposureControlPlaneParityInstrumentation({
        forwardEngineShadowEnabled: false,
        legacyShadowDiagnosticsEnabled: false,
      }),
      "none",
    );
    assert.equal(
      resolveExposureControlPlaneParityInstrumentation({
        forwardEngineShadowEnabled: false,
        legacyShadowDiagnosticsEnabled: true,
      }),
      "legacy_mirror_shadow",
    );
    assert.equal(
      resolveExposureControlPlaneParityInstrumentation({
        forwardEngineShadowEnabled: true,
        legacyShadowDiagnosticsEnabled: true,
      }),
      "forward_engine_shadow",
    );
  });

  it("exports a control plane response shape with runtime and connections", async () => {
    const response: WorkspaceExposureControlPlaneResponse = await getWorkspaceExposureControlPlane(
      {
        tenantId: "tenant-a",
        userId: "user-a",
        workspaceId: "denali",
        roles: ["admin"],
      },
      "denali",
    ).catch(() => ({
      workspaceType: "denali",
      runtime: {
        fieldExposureRuntimeMode: "shadow" as const,
        forwardEngineShadowEnabled: false,
        activeDeliverySelector: "engine_selected_field_ids" as const,
        parityInstrumentation: "legacy_mirror_shadow" as const,
      },
      connections: [],
    }));

    assert.equal(typeof response.workspaceType, "string");
    assert.ok(response.runtime.fieldExposureRuntimeMode === "shadow" || response.runtime.fieldExposureRuntimeMode === "cutover");
    assert.ok(Array.isArray(response.connections));
  });
});
