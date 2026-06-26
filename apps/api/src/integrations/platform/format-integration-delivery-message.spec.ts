import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatIntegrationDeliveryMessage } from "./format-integration-delivery-message";

describe("format integration delivery message", () => {
  it("uses Denali TourCreated template from workspace surface", () => {
    assert.equal(
      formatIntegrationDeliveryMessage({
        workspaceType: "denali",
        eventType: "TourCreated",
        payload: { title: "Alpine Day", aggregateId: "tour-1" },
      }),
      "Tour created: Alpine Day"
    );
  });

  it("falls back when workspace has no template", () => {
    assert.equal(
      formatIntegrationDeliveryMessage({
        workspaceType: "starter",
        eventType: "TourCreated",
        payload: { aggregateId: "tour-2" },
      }),
      "TourCreated: tour-2"
    );
  });
});
