import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultIntegrationEventTypesForProvider,
  isDefaultIntegrationEventEnabled,
  resolveIntegrationSurfaceForWorkspaceType,
} from "./resolve-integration-surface";

describe("resolve integration surface", () => {
  it("resolves Denali telegram provider surface", () => {
    const surface = resolveIntegrationSurfaceForWorkspaceType("denali");
    assert.ok(surface !== null);
    assert.equal(surface.manifestVersion, 1);
    const telegram = surface.providers.find((provider) => provider.id === "telegram");
    assert.ok(telegram !== undefined);
    assert.deepEqual(telegram.defaultCapabilities, ["message.send"]);
    assert.equal(
      isDefaultIntegrationEventEnabled({
        workspaceType: "denali",
        providerId: "telegram",
        eventType: "TourCreated",
      }),
      true
    );
    assert.deepEqual(
      defaultIntegrationEventTypesForProvider({
        workspaceType: "denali",
        providerId: "telegram",
      }),
      ["TourCreated"]
    );
  });

  it("returns null for workspaces without integration surface", () => {
    assert.equal(resolveIntegrationSurfaceForWorkspaceType("starter"), null);
    assert.equal(resolveIntegrationSurfaceForWorkspaceType(null), null);
  });
});
