/**
 * Phase B2.1 — Booking capability gate is wired into composition entry points.
 * Behavioral: unsupported / unknown fail closed; supported Denali still works.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { OPERATOR_SMOKE } from "../../test/fixtures/operator-smoke-e2e-tenant.ts";
import { BookingWorkspaceUnsupportedError } from "./bookings.errors.ts";
import { resetBookingsRepositoryForTests } from "./create-bookings-repository.ts";
import {
  createBooking,
  createPublicGuestBooking,
  getOrCreateBookingRuntimeForWorkspaceType,
  resetBookingsServiceCompositionForTests,
  resolveBookingsServiceForTenant,
} from "./create-bookings-service.ts";
import { resolveBookingWorkspaceTypeForTenant } from "./resolve-booking-workspace-type-for-tenant.ts";
import {
  isBookingSupportedWorkspace,
  WORKSPACE_BOOKING_BINDINGS,
} from "./workspace-booking-bindings.generated.ts";

const DENALI = "denali";
const DENALI_TENANT_ID = OPERATOR_SMOKE.tenantId;
const URBAN_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const UNKNOWN_TENANT_ID = "00000000-0000-4000-8000-000000009999";

const denaliOpsAuth = {
  tenantId: DENALI_TENANT_ID,
  userId: OPERATOR_SMOKE.adminUserId,
  role: "admin" as const,
  status: "ACTIVE" as const,
};

const urbanOpsAuth = {
  tenantId: URBAN_TENANT_ID,
  userId: "00000000-0000-4000-8000-000000000201",
  role: "admin" as const,
  status: "ACTIVE" as const,
};

const sampleCreateBody = {
  tourId: OPERATOR_SMOKE.seedTourId,
  tourTitle: "B2.1 gate tour",
  guestLabel: "Gate Guest",
  guestEmail: "gate-guest@example.com",
  guestPhone: "+15550009999",
  partySize: 1,
  departureAt: "2026-08-01T10:00:00.000Z",
  registrationIntake: { tourCapacityMax: 10 },
};

describe("BK-B2.1 booking capability gate (runtime)", { concurrency: false }, () => {
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

  it("generated bindings support denali + booking-ws2; reject urban", () => {
    assert.equal(isBookingSupportedWorkspace("denali"), true);
    assert.equal(isBookingSupportedWorkspace("booking-ws2"), true);
    assert.equal(isBookingSupportedWorkspace("urban"), false);
    assert.equal(isBookingSupportedWorkspace("starter"), false);
    const types = WORKSPACE_BOOKING_BINDINGS.map((b) => b.workspaceType).sort();
    assert.deepEqual(types, ["booking-ws2", "denali"]);
  });

  it("A) unsupported workspace cannot create booking (ops + public)", async () => {
    await assert.rejects(
      () => createBooking(urbanOpsAuth, sampleCreateBody),
      (error: unknown) =>
        error instanceof BookingWorkspaceUnsupportedError &&
        error.message.includes("workspaceType=urban")
    );
    await assert.rejects(
      () =>
        createPublicGuestBooking(
          {
            tenantId: URBAN_TENANT_ID,
            userId: urbanOpsAuth.userId,
            role: "none",
            status: "ACTIVE",
          },
          sampleCreateBody
        ),
      (error: unknown) => error instanceof BookingWorkspaceUnsupportedError
    );
  });

  it("B) unknown / unregistered workspace cannot fallback to Denali", async () => {
    await assert.rejects(
      () => resolveBookingWorkspaceTypeForTenant(URBAN_TENANT_ID),
      (error: unknown) =>
        error instanceof BookingWorkspaceUnsupportedError &&
        error.message.includes("workspaceType=urban")
    );
    await assert.rejects(
      () => resolveBookingsServiceForTenant(URBAN_TENANT_ID),
      (error: unknown) => error instanceof BookingWorkspaceUnsupportedError
    );
    assert.throws(
      () => getOrCreateBookingRuntimeForWorkspaceType("urban"),
      (error: unknown) =>
        error instanceof BookingWorkspaceUnsupportedError &&
        error.message.includes("workspaceType=urban")
    );
    assert.throws(
      () => getOrCreateBookingRuntimeForWorkspaceType("starter"),
      (error: unknown) =>
        error instanceof BookingWorkspaceUnsupportedError &&
        error.message.includes("workspaceType=starter")
    );
    // Unknown tenant: platform fail-closed (WORKSPACE_TYPE_UNRESOLVED) is wrapped as
    // BookingWorkspaceUnsupportedError — never Denali, never raw HTTP 500.
    await assert.rejects(
      () => resolveBookingWorkspaceTypeForTenant(UNKNOWN_TENANT_ID),
      (error: unknown) =>
        error instanceof BookingWorkspaceUnsupportedError &&
        !error.message.includes("denali") &&
        error.message.includes("WORKSPACE_TYPE_UNRESOLVED")
    );
  });

  it("C) supported Denali behavior remains unchanged", async () => {
    assert.equal(await resolveBookingWorkspaceTypeForTenant(DENALI_TENANT_ID), DENALI);
    const service = await resolveBookingsServiceForTenant(DENALI_TENANT_ID);
    assert.equal(typeof service.createBooking, "function");
    const created = await createBooking(denaliOpsAuth, sampleCreateBody);
    assert.ok(typeof created.id === "string" && created.id.length > 0);
    assert.equal(created.status, "pending");
    const publicCreated = await createPublicGuestBooking(
      {
        tenantId: DENALI_TENANT_ID,
        userId: OPERATOR_SMOKE.memberUserId,
        role: "none",
        status: "ACTIVE",
      },
      {
        ...sampleCreateBody,
        guestEmail: "denali-public-gate@example.com",
        guestLabel: "Denali Public Gate",
      }
    );
    assert.ok(publicCreated.id.length > 0);
    assert.equal(publicCreated.status, "pending");
  });
});
