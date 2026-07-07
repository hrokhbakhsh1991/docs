import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeIntegrationEventType,
  resolveFieldExposureDecision,
} from "../../../src/index.js";

describe("exposure public API", () => {
  it("exports shadow decision engine symbols from the platform-core facade", () => {
    assert.equal(typeof resolveFieldExposureDecision, "function");
    assert.equal(typeof normalizeIntegrationEventType, "function");
  });

  it("normalizes known integration events through the facade", () => {
    assert.deepEqual(normalizeIntegrationEventType("TourCreated"), {
      kind: "event",
      name: "tour_created",
    });
  });
});
