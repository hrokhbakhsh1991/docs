import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  publishDomainEvent,
  resetDomainEventBusForTests,
  subscribeDomainEvent,
  subscribeDomainEventForTenant,
} from "../src/index";

describe("platform-events (P4-E-EVT-01)", () => {
  beforeEach(() => {
    resetDomainEventBusForTests();
  });

  it("rejects publish without tenantId", () => {
    assert.throws(
      () =>
        publishDomainEvent({
          tenantId: "  ",
          type: "TourCreated",
          payload: {},
        }),
      /DOMAIN_EVENT_TENANT_REQUIRED/
    );
  });

  it("delivers TourCreated with tenantId on envelope", () => {
    const seen: string[] = [];
    subscribeDomainEvent("TourCreated", (evt) => {
      seen.push(evt.tenantId);
    });

    const envelope = publishDomainEvent({
      tenantId: "tenant-a",
      type: "TourCreated",
      payload: { tourId: "t-1" },
    });

    assert.equal(envelope.tenantId, "tenant-a");
    assert.equal(envelope.type, "TourCreated");
    assert.equal(seen.length, 1);
    assert.equal(seen[0], "tenant-a");
  });

  it("tenant-scoped subscriber does not receive other tenant events", () => {
    const tenantBSeen: string[] = [];
    subscribeDomainEventForTenant("tenant-b", "TourCreated", (evt) => {
      tenantBSeen.push(evt.tenantId);
    });

    publishDomainEvent({
      tenantId: "tenant-a",
      type: "TourCreated",
      payload: { tourId: "t-a" },
    });

    assert.deepEqual(tenantBSeen, []);
  });
});
