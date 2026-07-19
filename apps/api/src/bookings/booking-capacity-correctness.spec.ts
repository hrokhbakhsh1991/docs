/**
 * Booking-owned capacity correctness — fail-closed max, in-TX approve, multi-ws.
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
  createPublicGuestBooking,
  getOrCreateBookingRuntimeForWorkspaceType,
  resetBookingsServiceCompositionForTests,
} from "./create-bookings-service.ts";
import type { BookingActorContext } from "./ports/booking-actor-context.ts";
import { getBookingWorkspaceCapabilities } from "./workspace-booking-capabilities.generated.ts";

const here = dirname(fileURLToPath(import.meta.url));
const TENANT_DENALI = "00000000-0000-4000-8000-000000000014";
const TENANT_WS2 = "00000000-0000-4000-8000-000000000015";
const TOUR = "00000000-0000-4000-8000-000000000901";

function opsAuth(tenantId: string): BookingActorContext {
  return {
    tenantId,
    userId: "00000000-0000-4000-8000-000000000201",
    role: "admin",
    status: "ACTIVE",
  };
}

function publicAuth(tenantId: string): BookingActorContext {
  return {
    tenantId,
    userId: "00000000-0000-4000-8000-000000000301",
    role: "none",
    status: "ACTIVE",
  };
}

function body(over: {
  guestLabel?: string;
  partySize?: number;
  tourCapacityMax?: number | null;
  tourId?: string;
}) {
  const intake =
    over.tourCapacityMax === null
      ? {}
      : { tourCapacityMax: over.tourCapacityMax ?? 10 };
  return {
    tourId: over.tourId ?? TOUR,
    tourTitle: "Capacity Correctness Tour",
    guestLabel: over.guestLabel ?? "Guest",
    guestEmail: "cap@example.com",
    partySize: over.partySize ?? 1,
    departureAt: "2031-06-01T10:00:00.000Z",
    registrationIntake: intake,
  };
}

describe("booking-owned capacity correctness", { concurrency: false }, () => {
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

  it("1) create with missing capacity data fails closed", async () => {
    await assert.rejects(
      () =>
        createPublicGuestBooking(
          publicAuth(TENANT_DENALI),
          body({ tourCapacityMax: null, guestLabel: "No Max" })
        ),
      /BOOKING_CAPACITY_REJECTED: tourCapacityMax required/
    );
    await assert.rejects(
      () =>
        createBooking(opsAuth(TENANT_WS2), body({ tourCapacityMax: null, guestLabel: "No Max Ws2" })),
      /BOOKING_CAPACITY_REJECTED: tourCapacityMax required/
    );
  });

  it("2) create over capacity is rejected", async () => {
    await assert.rejects(
      () =>
        createBooking(
          opsAuth(TENANT_DENALI),
          body({ partySize: 11, tourCapacityMax: 10, guestLabel: "Over" })
        ),
      /BOOKING_CAPACITY_REJECTED/
    );
  });

  it("3) approve after occupancy changed rejects when exceeded", async () => {
    const pending = await createBooking(
      opsAuth(TENANT_DENALI),
      body({ guestLabel: "Pending", partySize: 4, tourCapacityMax: 10 })
    );
    const filler = await createBooking(
      opsAuth(TENANT_DENALI),
      body({ guestLabel: "Filler", partySize: 8, tourCapacityMax: 10 })
    );
    await approveBooking(opsAuth(TENANT_DENALI), filler.id);
    await assert.rejects(
      () => approveBooking(opsAuth(TENANT_DENALI), pending.id),
      /BOOKING_CAPACITY_REJECTED/
    );
  });

  it("4) two workspace types: different capacity policies same process", async () => {
    const denaliCaps = getBookingWorkspaceCapabilities("denali");
    const ws2Caps = getBookingWorkspaceCapabilities("booking-ws2");
    assert.equal(denaliCaps?.capacity.mode, "booking-owned");
    assert.equal(ws2Caps?.capacity.mode, "booking-owned");

    const caseA = body({
      guestLabel: BOOKING_POLICY_CASE_A_GUEST_LABEL,
      partySize: 1,
      tourCapacityMax: 10,
      tourId: "00000000-0000-4000-8000-000000000902",
    });
    const ok = await createPublicGuestBooking(publicAuth(TENANT_DENALI), caseA);
    assert.equal(ok.status, "pending");
    await assert.rejects(
      () => createPublicGuestBooking(publicAuth(TENANT_WS2), caseA),
      /BOOKING_CAPACITY_REJECTED/
    );
    assert.notEqual(
      getOrCreateBookingRuntimeForWorkspaceType("denali").service,
      getOrCreateBookingRuntimeForWorkspaceType("booking-ws2").service
    );
  });

  it("5) concurrency: parallel approve of competing pendings — only one wins", async () => {
    const a = await createBooking(
      opsAuth(TENANT_DENALI),
      body({ guestLabel: "Race A", partySize: 6, tourCapacityMax: 10 })
    );
    const b = await createBooking(
      opsAuth(TENANT_DENALI),
      body({ guestLabel: "Race B", partySize: 6, tourCapacityMax: 10 })
    );

    const results = await Promise.allSettled([
      approveBooking(opsAuth(TENANT_DENALI), a.id),
      approveBooking(opsAuth(TENANT_DENALI), b.id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1, "exactly one approve must succeed");
    assert.equal(rejected.length, 1, "exactly one approve must fail capacity");
    const err = (rejected[0] as PromiseRejectedResult).reason;
    assert.match(String(err?.message ?? err), /BOOKING_CAPACITY_REJECTED/);
  });

  it("approve capacity assert runs inside repository TX (source)", () => {
    const serviceSrc = readFileSync(join(here, "bookings.service.ts"), "utf8");
    const approveBlock = serviceSrc.slice(
      serviceSrc.indexOf("async approveBooking("),
      serviceSrc.indexOf("async rejectBooking(")
    );
    assert.match(approveBlock, /assertCapacityInTx/);
    assert.doesNotMatch(approveBlock, /assertApproveCapacity/);
    assert.ok(
      approveBlock.indexOf("approveWithOutbox") < approveBlock.indexOf("invokeApproveReaction")
    );

    const mem = readFileSync(join(here, "in-memory-bookings.repository.ts"), "utf8");
    const memApprove = mem.slice(mem.indexOf("async approveWithOutbox"), mem.indexOf("async bulkApproveWithOutbox"));
    assert.match(memApprove, /assertCapacityInTx/);
    assert.ok(memApprove.indexOf("assertCapacityInTx") < memApprove.indexOf("status: \"approved\""));

    const prisma = readFileSync(join(here, "prisma-bookings.repository.ts"), "utf8");
    const prismaApprove = prisma.slice(
      prisma.indexOf("async approveWithOutbox"),
      prisma.indexOf("async bulkApproveWithOutbox")
    );
    assert.match(prismaApprove, /assertCapacityInTx/);
    assert.match(prismaApprove, /await acquireTourCapacityLock/);
    assert.ok(
      prismaApprove.indexOf("await acquireTourCapacityLock") <
        prismaApprove.indexOf("input.assertCapacityInTx")
    );
  });
});
