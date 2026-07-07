import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveIntegrationDispatchPayload } from "./resolve-integration-dispatch-payload";

describe("resolveIntegrationDispatchPayload", () => {
  it("merges deliverySnapshot into dispatch payload", () => {
    const payload = resolveIntegrationDispatchPayload({
      tenantId: "tenant-1",
      aggregateId: "tour-1",
      aggregateType: "tour",
      eventType: "TourPublished",
      domainEventId: "TourPublished:tour-1:1",
      payload: {
        schemaVersion: 1,
        tenantId: "tenant-1",
        tourId: "tour-1",
        title: "Alpine Day",
        deliverySnapshot: {
          destinationId: "Kerman",
          title: "Alpine Day",
        },
      },
    });

    assert.equal(payload.tenantId, "tenant-1");
    assert.equal(payload.tourId, "tour-1");
    assert.equal(payload.destinationId, "Kerman");
    assert.equal(payload.title, "Alpine Day");
  });

  it("falls back to raw payload when snapshot is absent", () => {
    const payload = resolveIntegrationDispatchPayload({
      tenantId: "tenant-1",
      aggregateId: "tour-2",
      aggregateType: "tour",
      eventType: "TourCreated",
      domainEventId: "uuid",
      payload: { tenantId: "tenant-1", tourId: "tour-2" },
    });

    assert.deepEqual(payload, {
      tenantId: "tenant-1",
      tourId: "tour-2",
      aggregateId: "tour-2",
    });
  });
});
