import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { integrationMappingsForEvent } from "./integration-event-mapping";

describe("integration event mappings", () => {
  it("maps TourCreated from Denali integration surface", () => {
    assert.deepEqual(integrationMappingsForEvent("TourCreated", "denali"), [
      {
        eventType: "TourCreated",
        capability: "message.send",
        providers: ["telegram"],
      },
    ]);
  });

  it("returns no mappings for workspaces without integration surface", () => {
    assert.deepEqual(integrationMappingsForEvent("TourCreated", "starter"), []);
    assert.deepEqual(integrationMappingsForEvent("TourCreated", null), []);
  });
});
