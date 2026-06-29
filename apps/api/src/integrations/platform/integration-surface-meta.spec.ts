import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildWorkspaceIntegrationSurfaceMeta } from "./integration-surface-meta";

describe("integration surface meta", () => {
  it("exposes Denali provider fields without secret values", () => {
    const meta = buildWorkspaceIntegrationSurfaceMeta("denali");
    const telegram = meta.providers.find((provider) => provider.id === "telegram");

    assert.ok(telegram);
    assert.deepEqual(telegram.configFields, [
      { id: "channelId", kind: "string", requiredOnCreate: true },
    ]);
    assert.deepEqual(telegram.credentialFields, [
      { id: "botToken", kind: "secret", requiredOnCreate: true },
    ]);
    assert.deepEqual(telegram.defaultCapabilities, ["message.send"]);
    assert.deepEqual(telegram.defaultEventPolicies, [{ eventType: "TourCreated", enabled: true }]);

    const catalogIds = meta.exposureCandidateFields.map((field) => field.id);
    assert.ok(catalogIds.includes("title"));
    assert.ok(catalogIds.includes("denali.destination"));
    assert.ok(meta.exposureCandidateFields.length > 1);
    assert.equal(
      (meta as Record<string, unknown>).deliveryCandidateFields,
      undefined,
      "Phase 7g: legacy delivery alias must not be emitted",
    );
  });

  it("returns no providers for workspaces without an integration surface", () => {
    assert.deepEqual(buildWorkspaceIntegrationSurfaceMeta("starter"), {
      workspaceType: "starter",
      providers: [],
      exposureCandidateFields: [],
    });
  });
});
