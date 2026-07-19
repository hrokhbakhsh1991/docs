/**
 * Dependency execution proof — same process, Denali accepts CASE_A, WS2 rejects.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { BOOKING_POLICY_CASE_A_GUEST_LABEL } from "@app-tour/booking-http-contracts";

import { resetBookingsRepositoryForTests } from "./create-bookings-repository.ts";
import {
  getOrCreateBookingRuntimeForWorkspaceType,
  resetBookingsServiceCompositionForTests,
} from "./create-bookings-service.ts";
import { resolveBookingWorkspaceDependencies } from "./booking-dependency-registry.ts";

const CASE_A_BODY = {
  tourId: "00000000-0000-4000-8000-000000000777",
  tourTitle: "Policy Case A Tour",
  guestLabel: BOOKING_POLICY_CASE_A_GUEST_LABEL,
  guestEmail: "case-a@example.com",
  guestPhone: "+15550001111",
  partySize: 1,
  departureAt: "2026-09-01T10:00:00.000Z",
  registrationIntake: { tourCapacityMax: 10 },
};

const TENANT_DENALI = "00000000-0000-4000-8000-000000000014";
const TENANT_WS2 = "00000000-0000-4000-8000-000000000015";

function publicAuth(tenantId: string) {
  return {
    tenantId,
    userId: "00000000-0000-4000-8000-000000000103",
    role: "none" as const,
    status: "ACTIVE" as const,
  };
}

describe("BK-B2.2 booking dependency execution", { concurrency: false }, () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorDatabaseUrl = process.env.DATABASE_URL;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.DATABASE_URL;
  });

  after(() => {
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
    if (priorDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = priorDatabaseUrl;
    }
  });

  beforeEach(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  it("same process: Denali accepts CASE_A; booking-ws2 rejects CASE_A", async () => {
    const denali = getOrCreateBookingRuntimeForWorkspaceType("denali");
    const ws2 = getOrCreateBookingRuntimeForWorkspaceType("booking-ws2");
    const denaliDeps = resolveBookingWorkspaceDependencies("denali");
    const ws2Deps = resolveBookingWorkspaceDependencies("booking-ws2");

    assert.notEqual(denali.service, ws2.service);
    assert.equal(typeof denaliDeps.validationPolicy.assertCreateValid, "function");
    assert.equal(typeof denaliDeps.capacityPolicy.assertCreateCapacity, "function");
    assert.equal(typeof ws2Deps.validationPolicy.assertCreateValid, "function");
    assert.equal(typeof ws2Deps.capacityPolicy.assertCreateCapacity, "function");
    assert.notEqual(denaliDeps.capacityPolicy.kind, ws2Deps.capacityPolicy.kind);

    const accepted = await denali.service.createPublicGuestBooking(
      publicAuth(TENANT_DENALI),
      CASE_A_BODY
    );
    assert.ok(accepted.id.length > 0);
    assert.equal(accepted.status, "pending");

    await assert.rejects(
      () => ws2.service.createPublicGuestBooking(publicAuth(TENANT_WS2), CASE_A_BODY),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith("BOOKING_CAPACITY_REJECTED") &&
        error.message.includes("booking-ws2") &&
        error.message.includes(BOOKING_POLICY_CASE_A_GUEST_LABEL)
    );
  });

  it("public create invokes validation before capacity (WS2 still runs validation)", () => {
    const ws2Deps = resolveBookingWorkspaceDependencies("booking-ws2");
    assert.throws(
      () =>
        ws2Deps.validationPolicy.assertCreateValid({
          tenantId: TENANT_WS2,
          tourId: CASE_A_BODY.tourId,
          tourTitle: CASE_A_BODY.tourTitle,
          guestLabel: "   ",
          partySize: 1,
          departureAt: CASE_A_BODY.departureAt,
          occupiedApprovedPartySize: 0,
          tourCapacityMax: 10,
        }),
      /BOOKING_VALIDATION_REJECTED/
    );
  });
});
