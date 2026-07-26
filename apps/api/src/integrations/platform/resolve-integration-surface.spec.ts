import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultIntegrationEventTypesForProvider,
  isDefaultIntegrationEventEnabled,
  resolveIntegrationSurfaceForWorkspaceType,
} from "./resolve-integration-surface";

describe("resolve integration surface", () => {
  it("resolves Denali telegram provider surface", async () => {
    const surface = await resolveIntegrationSurfaceForWorkspaceType("denali");
    assert.ok(surface !== null);
    assert.equal(surface.manifestVersion, 1);
    const telegram = surface.providers.find((provider) => provider.id === "telegram");
    assert.ok(telegram !== undefined);
    assert.deepEqual(telegram.defaultCapabilities, ["message.send"]);
    assert.equal(
      await isDefaultIntegrationEventEnabled({
        workspaceType: "denali",
        providerId: "telegram",
        eventType: "TourPublished",
      }),
      true
    );
    assert.deepEqual(
      await defaultIntegrationEventTypesForProvider({
        workspaceType: "denali",
        providerId: "telegram",
      }),
      ["TourPublished"]
    );
  });

  it("returns null for workspaces without integration surface", async () => {
    assert.equal(await resolveIntegrationSurfaceForWorkspaceType("starter"), null);
    assert.equal(await resolveIntegrationSurfaceForWorkspaceType(null), null);
  });
});
