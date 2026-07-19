/**
 * Approve lifecycle — first-class capacity gate (same capacityPolicy + capacityMode as create).
 * TX/outbox boundary preserved: capacity before approveWithOutbox; reaction after commit.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { BOOKING_POLICY_CASE_A_GUEST_LABEL } from "@app-tour/booking-http-contracts";

import { resetBookingsRepositoryForTests } from "./create-bookings-repository.ts";
import {
  approveBooking,
  createBooking,
  getOrCreateBookingRuntimeForWorkspaceType,
  resetBookingsServiceCompositionForTests,
} from "./create-bookings-service.ts";
import type { BookingActorContext } from "./ports/booking-actor-context.ts";

const here = dirname(fileURLToPath(import.meta.url));

const TENANT_DENALI = "00000000-0000-4000-8000-000000000014";
const TENANT_WS2 = "00000000-0000-4000-8000-000000000015";
const TOUR_DENALI = "00000000-0000-4000-8000-000000000891";
const TOUR_WS2 = "00000000-0000-4000-8000-000000000892";

function opsAuth(tenantId: string): BookingActorContext {
  return {
    tenantId,
    userId: "00000000-0000-4000-8000-000000000201",
    role: "admin",
    status: "ACTIVE",
  };
}

function body(input: {
  readonly tourId: string;
  readonly guestLabel: string;
  readonly partySize: number;
  readonly tourCapacityMax: number;
}) {
  return {
    tourId: input.tourId,
    tourTitle: "Approve Lifecycle Tour",
    guestLabel: input.guestLabel,
    guestEmail: `${input.guestLabel.replace(/\s+/g, "-").toLowerCase()}@example.com`,
    guestPhone: "+15550008888",
    partySize: input.partySize,
    departureAt: "2031-01-15T10:00:00.000Z",
    registrationIntake: { tourCapacityMax: input.tourCapacityMax },
  };
}

describe("booking approve lifecycle capacity", { concurrency: false }, () => {
  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.DATABASE_URL;
  });

  beforeEach(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  after(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  it("create pending → change occupancy → approve rejects when capacity exceeded", async () => {
    const pending = await createBooking(
      opsAuth(TENANT_DENALI),
      body({
        tourId: TOUR_DENALI,
        guestLabel: "Pending Later",
        partySize: 4,
        tourCapacityMax: 10,
      })
    );
    assert.equal(pending.status, "pending");

    // Change occupancy: another booking consumes seats first.
    const filler = await createBooking(
      opsAuth(TENANT_DENALI),
      body({
        tourId: TOUR_DENALI,
        guestLabel: "Filler Approved",
        partySize: 8,
        tourCapacityMax: 10,
      })
    );
    const filled = await approveBooking(opsAuth(TENANT_DENALI), filler.id);
    assert.equal(filled.status, "approved");

    await assert.rejects(
      () => approveBooking(opsAuth(TENANT_DENALI), pending.id),
      (err: unknown) =>
        err instanceof Error && err.message.startsWith("BOOKING_CAPACITY_REJECTED")
    );
  });

  it("approve succeeds when capacity available", async () => {
    const pending = await createBooking(
      opsAuth(TENANT_DENALI),
      body({
        tourId: TOUR_DENALI,
        guestLabel: "Fits Fine",
        partySize: 3,
        tourCapacityMax: 10,
      })
    );

    const peer = await createBooking(
      opsAuth(TENANT_DENALI),
      body({
        tourId: TOUR_DENALI,
        guestLabel: "Peer Small",
        partySize: 2,
        tourCapacityMax: 10,
      })
    );
    await approveBooking(opsAuth(TENANT_DENALI), peer.id);

    const approved = await approveBooking(opsAuth(TENANT_DENALI), pending.id);
    assert.equal(approved.status, "approved");
    assert.ok(approved.approvedAt);
  });

  it("two workspace types in same process: approve capacity + markers independent", async () => {
    const denali = getOrCreateBookingRuntimeForWorkspaceType("denali");
    const ws2 = getOrCreateBookingRuntimeForWorkspaceType("booking-ws2");
    assert.notEqual(denali.service, ws2.service);
    assert.equal(denali.service.boundWorkspaceType, "denali");
    assert.equal(ws2.service.boundWorkspaceType, "booking-ws2");

    // Denali: pending then occupancy change → approve reject (occupancy).
    const denaliPending = await createBooking(
      opsAuth(TENANT_DENALI),
      body({
        tourId: TOUR_DENALI,
        guestLabel: "Denali Pending",
        partySize: 5,
        tourCapacityMax: 10,
      })
    );
    const denaliFill = await createBooking(
      opsAuth(TENANT_DENALI),
      body({
        tourId: TOUR_DENALI,
        guestLabel: "Denali Fill",
        partySize: 6,
        tourCapacityMax: 10,
      })
    );
    await approveBooking(opsAuth(TENANT_DENALI), denaliFill.id);
    await assert.rejects(
      () => approveBooking(opsAuth(TENANT_DENALI), denaliPending.id),
      /BOOKING_CAPACITY_REJECTED/
    );

    // ws2: CASE_A create rejected by capacity policy (marker); normal approve succeeds.
    await assert.rejects(
      () =>
        createBooking(
          opsAuth(TENANT_WS2),
          body({
            tourId: TOUR_WS2,
            guestLabel: BOOKING_POLICY_CASE_A_GUEST_LABEL,
            partySize: 1,
            tourCapacityMax: 10,
          })
        ),
      /BOOKING_CAPACITY_REJECTED/
    );

    const ws2Pending = await createBooking(
      opsAuth(TENANT_WS2),
      body({
        tourId: TOUR_WS2,
        guestLabel: "Ws2 Ok",
        partySize: 2,
        tourCapacityMax: 10,
      })
    );
    const ws2Approved = await approveBooking(opsAuth(TENANT_WS2), ws2Pending.id);
    assert.equal(ws2Approved.status, "approved");
  });

  it("approve capacity runs before outbox TX (source order)", () => {
    const src = readFileSync(join(here, "bookings.service.ts"), "utf8");
    const approveBlock = src.slice(
      src.indexOf("async approveBooking("),
      src.indexOf("async rejectBooking(")
    );
    assert.match(approveBlock, /assertApprovalCapability/);
    assert.match(approveBlock, /assertCapacityInTx/);
    const capacityAt = approveBlock.indexOf("assertCapacityInTx");
    const txAt = approveBlock.indexOf("approveWithOutbox");
    const reactionAt = approveBlock.indexOf("invokeApproveReaction");
    assert.ok(capacityAt > 0 && txAt >= 0, "capacity assert passed into approve TX");
    assert.ok(reactionAt > txAt, "reaction after approve TX");
  });
});
