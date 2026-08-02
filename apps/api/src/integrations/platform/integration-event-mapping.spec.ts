import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { integrationMappingsForEvent } from "./integration-event-mapping";

describe("integration event mappings", () => {
  it("maps TourPublished from Denali integration surface", async () => {
    assert.deepEqual(await integrationMappingsForEvent("TourPublished", "denali"), [
      {
        eventType: "TourPublished",
        capability: "message.send",
        providers: ["telegram"],
      },
    ]);
    assert.deepEqual(await integrationMappingsForEvent("TourCreated", "denali"), []);
  });

  it("returns no mappings for workspaces without integration surface", async () => {
    assert.deepEqual(await integrationMappingsForEvent("TourCreated", "starter"), []);
    assert.deepEqual(await integrationMappingsForEvent("TourCreated", null), []);
  });
});
