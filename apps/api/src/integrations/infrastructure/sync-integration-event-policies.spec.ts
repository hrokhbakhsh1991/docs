import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseIntegrationEventPolicyPatches } from "../infrastructure/sync-integration-event-policies";

describe("sync-integration-event-policies", () => {
  it("INT-POL-01 filters unknown event types and dedupes", () => {
    const allowed = new Set(["TourPublished", "TourCreated"]);
    const patches = parseIntegrationEventPolicyPatches(
      [
        { eventType: "TourPublished", enabled: true },
        { eventType: "UnknownEvent", enabled: true },
        { eventType: "TourCreated", enabled: false },
        { eventType: "TourCreated", enabled: true },
      ],
      allowed
    );
    assert.equal(patches.length, 2);
    assert.deepEqual(patches[0], { eventType: "TourPublished", enabled: true });
    assert.deepEqual(patches[1], { eventType: "TourCreated", enabled: false });
  });
});
