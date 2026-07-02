import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { integrationMappingsForEvent } from "./integration-event-mapping";

describe("integration event mappings", () => {
  it("maps TourPublished from Denali integration surface", () => {
    assert.deepEqual(integrationMappingsForEvent("TourPublished", "denali"), [
      {
        eventType: "TourPublished",
        capability: "message.send",
        providers: ["telegram"],
      },
    ]);
    assert.deepEqual(integrationMappingsForEvent("TourCreated", "denali"), []);
  });

  it("returns no mappings for workspaces without integration surface", () => {
    assert.deepEqual(integrationMappingsForEvent("TourCreated", "starter"), []);
    assert.deepEqual(integrationMappingsForEvent("TourCreated", null), []);
  });
});
