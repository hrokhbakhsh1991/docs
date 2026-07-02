import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTourPublishedDomainEventId,
  buildTourPublishedOutboxPayload,
  isPublicPublishStatusLabel,
} from "./build-tour-published-outbox-payload";

describe("buildTourPublishedOutboxPayload", () => {
  it("builds deterministic domain event id", () => {
    assert.equal(
      buildTourPublishedDomainEventId("tour-1", 3),
      "TourPublished:tour-1:3",
    );
  });

  it("recognizes public publish labels", () => {
    assert.equal(isPublicPublishStatusLabel("active"), true);
    assert.equal(isPublicPublishStatusLabel("published"), true);
    assert.equal(isPublicPublishStatusLabel("PUBLISHED"), true);
    assert.equal(isPublicPublishStatusLabel("draft"), false);
    assert.equal(isPublicPublishStatusLabel(undefined), false);
  });

  it("freezes deliverySnapshot from canonical data", () => {
    const occurredAt = new Date("2026-06-29T12:00:00.000Z");
    const payload = buildTourPublishedOutboxPayload({
      tenantId: "tenant-1",
      tourId: "tour-1",
      rowVersion: 2,
      canonical: {
        schemaVersion: 1,
        data: { title: "Alpine Day", publishStatus: "active" },
      },
      projections: { title: "Alpine Day", schemaVersion: 1 },
      publishStatusLabel: "active",
      occurredAt,
    });

    assert.equal(payload.schemaVersion, 1);
    assert.equal(payload.title, "Alpine Day");
    assert.equal(payload.publishStatus, "active");
    assert.equal(payload.occurredAt, occurredAt.toISOString());
    assert.deepEqual(payload.deliverySnapshot, {
      title: "Alpine Day",
      publishStatus: "active",
    });
  });

  it("uses rowVersion 1 domain event id for create-with-publish", () => {
    assert.equal(buildTourPublishedDomainEventId("tour-new", 1), "TourPublished:tour-new:1");
  });
});
