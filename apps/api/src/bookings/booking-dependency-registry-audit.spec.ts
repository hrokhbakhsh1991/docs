/**
 * Booking dependency registry audit — every manifest capability has runtime ownership.
 *
 * ACTIVE: validationPolicy, capacityPolicy, publicBooking, eventReaction
 * REMOVED: opsCapability (opsManifest owns ops UI)
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createBookingsService } from "./bookings.service.ts";
import { BookingCapabilityViolationError } from "./bookings.errors.ts";
import type { BookingAuthorizationPort } from "./ports/booking-authorization.port.ts";
import type { BookingClockPort } from "./ports/booking-clock.port.ts";
import type { BookingRepositoryPort } from "./ports/booking-repository.port.ts";
import {
  createPublicGuestBooking,
  getOrCreateBookingRuntimeForWorkspaceType,
  resetBookingsServiceCompositionForTests,
} from "./create-bookings-service.ts";
import { resolveBookingWorkspaceDependencies } from "./booking-dependency-registry.ts";
import { resetBookingsRepositoryForTests } from "./create-bookings-repository.ts";
import { OPERATOR_SMOKE } from "../../test/fixtures/operator-smoke-e2e-tenant.ts";
import { getBookingWorkspaceCapabilities } from "./workspace-booking-capabilities.generated.ts";
import { toBookingRuntimeCapabilities } from "./map-booking-runtime-capabilities.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("BK dependency registry audit", { concurrency: false }, () => {
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

  it("dependency bag has no opsCapability; generated bindings omit OpsCapability", () => {
    const deps = resolveBookingWorkspaceDependencies("denali");
    assert.deepEqual(Object.keys(deps).sort(), [
      "capacityPolicy",
      "publicBooking",
      "validationPolicy",
      "workspaceType",
    ]);
    const generated = readFileSync(
      join(here, "workspace-booking-dependency-bindings.generated.ts"),
      "utf8"
    );
    assert.doesNotMatch(generated, /opsCapability|OpsCapability|createOpsCapability/);
  });

  it("ACTIVE publicBooking is consulted on public create path", async () => {
    const deps = resolveBookingWorkspaceDependencies("denali");
    assert.equal(deps.publicBooking.supportsPublicCreate(), true);

    const src = readFileSync(join(here, "bookings.service.ts"), "utf8");
    assert.match(src, /this\.publicBooking\.supportsPublicCreate/);
    assert.match(src, /assertPublicCreateCapability|BOOKING_CAPABILITY_VIOLATION/);

    const created = await createPublicGuestBooking(
      {
        tenantId: OPERATOR_SMOKE.tenantId,
        userId: "00000000-0000-4000-8000-000000000103",
        role: "none",
        status: "ACTIVE",
      },
      {
        tourId: "00000000-0000-4000-8000-000000000881",
        tourTitle: "Public Capability Tour",
        guestLabel: "Audit Guest",
        guestEmail: "audit-public@example.com",
        partySize: 1,
        departureAt: "2026-11-01T10:00:00.000Z",
        registrationIntake: { tourCapacityMax: 10 },
      }
    );
    assert.equal(created.status, "pending");
  });

  it("publicBooking=false rejects public create (runtime ownership)", async () => {
    const authorization: BookingAuthorizationPort = { assertOpsAccess: () => undefined };
    const clock: BookingClockPort = { now: () => new Date("2026-07-01T12:00:00.000Z") };
    const repository = {
      listByTenant: async () => [],
      listByTenantPage: async () => ({ items: [], nextCursor: null }),
      countByTenantFilters: async () => 0,
      findActiveGuestDuplicate: async () => null,
      getBookingsSummaryStats: async () => ({
        pending: 0,
        approvedToday: 0,
        departures7d: 0,
        waitlist: 0,
        tourChips: [],
      }),
      countBookingsBySubmittedUser: async () => 0,
      countCancelledBookingsBySubmittedUser: async () => 0,
      countCompletedTripsBySubmittedUser: async () => 0,
      listRecentBySubmittedUser: async () => [],
      listApprovedTourIdsBySubmittedUser: async () => [],
      sumApprovedPartySizeByTourIds: async () => ({}),
      getById: async () => null,
      getByIds: async () => [],
      updatePaymentStatus: async () => null,
      mergeRegistrationIntake: async () => null,
      updateGuestProjectionAndIntake: async () => null,
      reclassifyOwnedOtherToSelf: async () => null,
      createBooking: async () => {
        throw new Error("create must not run when public create unsupported");
      },
      approveWithOutbox: async () => {
        throw new Error("not used");
      },
      bulkApproveWithOutbox: async () => [],
      rejectBooking: async () => {
        throw new Error("not used");
      },
      waitlistBooking: async () => {
        throw new Error("not used");
      },
      cancelBooking: async () => {
        throw new Error("not used");
      },
      seedBooking: () => undefined,
    } as unknown as BookingRepositoryPort;

    const caps = getBookingWorkspaceCapabilities("denali");
    assert.ok(caps);
    const service = createBookingsService({
      repository,
      authorization,
      clock,
      eventReaction: {
        kind: "test",
        approveOutboxEventType: "registration.approved",
        reactAfterApprove: async () => undefined,
      },
      publicBooking: {
        kind: "disabled-public",
        supportsPublicCreate: () => false,
      },
      validationPolicy: { kind: "test", assertCreateValid: () => undefined },
      capacityPolicy: { kind: "test", assertCreateCapacity: () => undefined },
      assistedRegistrationMembers: {
        findTenantMember: async () => null,
      },
      tourCapacity: {
        kind: "test-tour-capacity",
        resolveTourCapacityMax: async () => null,
        resolveTourCapacityMaxMany: async () => ({}),
      },
      workspaceType: "denali",
      tenantWorkspaceBinding: {
        assertTenantBoundToRuntime: async () => undefined,
      },
      capabilities: toBookingRuntimeCapabilities(caps),
      productionGradeIntegrity: false,
    });

    await assert.rejects(
      () =>
        service.createPublicGuestBooking(
          {
            tenantId: OPERATOR_SMOKE.tenantId,
            userId: "00000000-0000-4000-8000-000000000103",
            role: "none",
            status: "ACTIVE",
          },
          {
            tourId: "00000000-0000-4000-8000-000000000882",
            tourTitle: "Blocked",
            guestLabel: "Blocked",
            partySize: 1,
            departureAt: "2026-11-01T10:00:00.000Z",
          }
        ),
      (error: unknown) =>
        error instanceof BookingCapabilityViolationError &&
        error.capability === "publicCreate"
    );
  });

  it("ACTIVE eventReaction remains outside dependency bag (separate registry)", () => {
    const runtime = getOrCreateBookingRuntimeForWorkspaceType("denali");
    assert.ok(runtime.eventReaction);
    const deps = resolveBookingWorkspaceDependencies("denali");
    assert.equal("eventReaction" in deps, false);
    const depsSrc = readFileSync(
      join(here, "workspace-booking-dependency-bindings.generated.ts"),
      "utf8"
    );
    assert.doesNotMatch(depsSrc, /EventReaction|eventReaction/);
  });
});
