import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDeterministicExposureEnginePreview,
  ExposureEnginePreviewInvalidQueryError,
  getExposureEnginePreview,
} from "./exposure-engine-preview.service";
import { resolveRegistrySeededExposureProfile, resolveDeliveryExposureProfileContext } from "./resolve-registry-seeded-exposure-profile";

describe("getExposureEnginePreview", () => {
  it("rejects missing connectionId before loading integration", async () => {
    await assert.rejects(
      () =>
        getExposureEnginePreview(
          { tenantId: "tenant-a", userId: "user-a", roles: ["admin"] },
          { connectionId: "", eventType: "TourCreated" },
        ),
      ExposureEnginePreviewInvalidQueryError,
    );
  });

  it("rejects missing eventType before loading integration", async () => {
    await assert.rejects(
      () =>
        getExposureEnginePreview(
          { tenantId: "tenant-a", userId: "user-a", roles: ["admin"] },
          { connectionId: "conn-1", eventType: "" },
        ),
      ExposureEnginePreviewInvalidQueryError,
    );
  });
});

describe("buildDeterministicExposureEnginePreview", () => {
  it("runs platform-core engine over the full catalog with deterministic payload", async () => {
    const seededProfile = await resolveRegistrySeededExposureProfile({
      workspaceType: "starter",
      ...resolveDeliveryExposureProfileContext("TourCreated"),
      surface: "telegram",
    });
    assert.ok(seededProfile !== null);

    const preview = buildDeterministicExposureEnginePreview({
      tenantId: "tenant-a",
      workspaceType: "starter",
      provider: "telegram",
      eventType: "TourCreated",
      exposureIntent: null,
      exposureProfile: seededProfile,
    });

    const fieldIds = Object.keys(preview.fields).sort((left, right) => left.localeCompare(right));
    assert.ok(fieldIds.length > 0);
    assert.deepEqual(preview.samplePayload, {
      status: "published",
      title: "Engine preview",
    });
    assert.ok(preview.summary.visibleCount + preview.summary.hiddenCount + preview.summary.blockedCount > 0);

    const firstFieldId = fieldIds[0]!;
    const firstDecision = preview.fields[firstFieldId];
    assert.ok(firstDecision !== undefined);
    assert.ok(firstDecision.reasonChain.length > 0);
    assert.equal("legacyComparison" in firstDecision, false);
  });
});
