/**
 * Operator tour list acceptedCount — approved booking aggregation (DEC-P11-015)
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { enrichTourListProjectionsWithAcceptedCount } from "../src/bookings/enrich-tour-accepted-counts";
import { installMemoryStorageDriverForDescribe } from "./test-helpers";
import { resetBookingsRepositoryForTests } from "../src/bookings/create-bookings-repository";
import type { TourListProjection } from "@app-tour/workspace-sdk";

const TENANT_ID = "00000000-0000-4000-8000-000000000014";
const TOUR_A = "00000000-0000-4000-8000-000000000210";
const TOUR_B = "00000000-0000-4000-8000-000000000211";

function projection(id: string, acceptedCount = 0): TourListProjection {
  return {
    id,
    tenantId: TENANT_ID,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    rowVersion: 1,
    title: "Tour",
    shortDescription: null,
    listStatus: "published",
    uiStatus: "active",
    priceAmount: null,
    priceCurrency: null,
    totalCapacity: 12,
    acceptedCount,
    category: null,
    coverImageUrl: null,
    departureAt: null,
  };
}

describe("tours-operator-accepted-count", () => {
  installMemoryStorageDriverForDescribe();

  before(() => {
    const repo = resetBookingsRepositoryForTests();
    repo.seedBooking({
      id: "00000000-0000-4000-8000-000000000401",
      tenantId: TENANT_ID,
      tourId: TOUR_A,
      tourTitle: "North Ridge Trek",
      guestLabel: "Guest A",
      guestEmail: "a@example.com",
      guestPhone: null,
      partySize: 3,
      status: "approved",
      paymentStatus: "paid",
      departureAt: "2026-07-01T08:00:00.000Z",
      submittedAt: new Date().toISOString(),
      submittedByUserId: "00000000-0000-4000-8000-000000000101",
      approvedAt: new Date().toISOString(),
    });
    repo.seedBooking({
      id: "00000000-0000-4000-8000-000000000402",
      tenantId: TENANT_ID,
      tourId: TOUR_A,
      tourTitle: "North Ridge Trek",
      guestLabel: "Guest B",
      guestEmail: "b@example.com",
      guestPhone: null,
      partySize: 2,
      status: "pending",
      paymentStatus: "unpaid",
      departureAt: "2026-07-01T08:00:00.000Z",
      submittedAt: new Date().toISOString(),
      submittedByUserId: "00000000-0000-4000-8000-000000000101",
      approvedAt: null,
    });
  });

  it("OPS-ACC-01 sums approved partySize only", async () => {
    const enriched = await enrichTourListProjectionsWithAcceptedCount(TENANT_ID, [
      projection(TOUR_A),
      projection(TOUR_B),
    ]);
    assert.equal(enriched[0]?.acceptedCount, 3);
    assert.equal(enriched[1]?.acceptedCount, 0);
  });
});
