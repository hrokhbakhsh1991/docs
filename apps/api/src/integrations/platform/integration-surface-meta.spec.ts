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
  });

  it("returns no providers for workspaces without an integration surface", () => {
    assert.deepEqual(buildWorkspaceIntegrationSurfaceMeta("starter"), {
      workspaceType: "starter",
      providers: [],
    });
  });
});
