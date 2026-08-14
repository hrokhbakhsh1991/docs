import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { createBookingsService } from "./bookings.service.ts";
import type { BookingAssistedRegistrationMembersPort } from "./ports/booking-assisted-registration-members.port.ts";
import type { BookingAuthorizationPort } from "./ports/booking-authorization.port.ts";
import type { BookingClockPort } from "./ports/booking-clock.port.ts";
import type { BookingRepositoryPort } from "./ports/booking-repository.port.ts";
import type { WorkspaceBookingEventReactionPort } from "@app-tour/booking-http-contracts";
import { getBookingWorkspaceCapabilities } from "./workspace-booking-capabilities.generated.ts";
import { toBookingRuntimeCapabilities } from "./map-booking-runtime-capabilities.ts";

const here = dirname(fileURLToPath(import.meta.url));

function denaliCaps() {
  const caps = getBookingWorkspaceCapabilities("denali");
  assert.ok(caps);
  return toBookingRuntimeCapabilities(caps);
}

function read(rel: string): string {
  return readFileSync(join(here, rel), "utf8");
}

function stubEventReaction(): WorkspaceBookingEventReactionPort {
  return {
    kind: "test-event-reaction",
    approveOutboxEventType: "registration.approved",
    reactAfterApprove: async () => undefined,
  };
}

function stubPublicBooking(): import("@app-tour/booking-http-contracts").BookingPublicCapabilityPort {
  return {
    kind: "test-public-booking",
    supportsPublicCreate: () => true,
  };
}

function stubTenantBinding(): import("./ports/booking-tenant-workspace-binding.port.ts").BookingTenantWorkspaceBindingPort {
  return {
    assertTenantBoundToRuntime: async () => undefined,
  };
}

function stubValidation(): import("@app-tour/booking-http-contracts").BookingValidationPolicyPort {
  return {
    kind: "test-validation",
    assertCreateValid: () => undefined,
  };
}

function stubCapacity(): import("@app-tour/booking-http-contracts").BookingCapacityPolicyPort {
  return {
    kind: "test-capacity",
    assertCreateCapacity: () => undefined,
  };
}

function stubAssistedRegistrationMembers(): BookingAssistedRegistrationMembersPort {
  return {
    findTenantMember: async () => null,
  };
}

function fakeRepo(): BookingRepositoryPort {
  return {
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
    sumApprovedPartySizeByTourIds: async () => ({}),
    getById: async () => null,
    getByIds: async () => [],
    updatePaymentStatus: async () => null,
    mergeRegistrationIntake: async () => null,
    updateGuestProjectionAndIntake: async () => null,
    reclassifyOwnedOtherToSelf: async () => null,
    createBooking: async () => {
      throw new Error("not used");
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
  };
}

describe("bookings-service-di (B0.5)", () => {
  it("BK-DI-01 BookingsService source has no getBookingsRepository / create-bookings-repository", () => {
    const src = read("bookings.service.ts");
    assert.doesNotMatch(src, /getBookingsRepository/);
    assert.doesNotMatch(src, /create-bookings-repository/);
    assert.doesNotMatch(src, /@app-tour\/workspace-sdk/);
    assert.doesNotMatch(src, /const now = new Date\(\)/);
    assert.doesNotMatch(src, /in-memory-bookings/);
    assert.doesNotMatch(src, /prisma-bookings/);
    assert.doesNotMatch(src, /infrastructure\//);
    assert.match(src, /this\.clock\.now\(\)/);
    assert.match(src, /this\.authorization\.assertOpsAccess/);
    assert.match(src, /this\.repository\./);
  });

  it("BK-DI-04 BookingsService imports only ports and domain types", () => {
    const src = read("bookings.service.ts");
    const fromSpecs = [...src.matchAll(/from ["']([^"']+)["']/g)].map((m) => m[1]!);
    assert.ok(fromSpecs.length > 0);
    for (const from of fromSpecs) {
      const allowed =
        from === "./bookings.types" ||
        from === "./bookings.errors" ||
        from === "./booking-list-query" ||
        from === "./ports/booking-runtime-capabilities.port" ||
        from === "@app-tour/booking-http-contracts" ||
        from === "./ports/booking-actor-context" ||
        from === "./ports/booking-authorization.port" ||
        from === "./ports/booking-clock.port" ||
        from === "./ports/booking-assisted-registration-members.port" ||
        from === "./ports/booking-repository.port" ||
        from === "./ports/booking-tenant-workspace-binding.port" ||
        from === "./ports/booking-tour-capacity.port";
      assert.ok(allowed, `illegal BookingsService import from ${from}`);
    }
  });

  it("BK-DI-02 missing constructor deps fail fast", () => {
    const authorization: BookingAuthorizationPort = { assertOpsAccess: () => undefined };
    const clock: BookingClockPort = { now: () => new Date("2026-01-01T00:00:00.000Z") };
    assert.throws(
      () =>
        createBookingsService({
          repository: null as unknown as BookingRepositoryPort,
          authorization,
          clock,
          eventReaction: stubEventReaction(),
          publicBooking: stubPublicBooking(),
          validationPolicy: stubValidation(),
          capacityPolicy: stubCapacity(),
          assistedRegistrationMembers: stubAssistedRegistrationMembers(),
          tourCapacity: {
            kind: "test-tour-capacity",
            resolveTourCapacityMax: async () => null,
            resolveTourCapacityMaxMany: async () => ({}),
          },
          workspaceType: "denali",
          tenantWorkspaceBinding: stubTenantBinding(),
          capabilities: denaliCaps(),
      productionGradeIntegrity: false,
        }),
      /BOOKINGS_SERVICE_DEP_REQUIRED:repository/
    );
  });

  it("BK-DI-03 composition resolves service with injected ports", () => {
    const authorization: BookingAuthorizationPort = { assertOpsAccess: () => undefined };
    const clock: BookingClockPort = { now: () => new Date("2026-07-01T12:00:00.000Z") };
    const service = createBookingsService({
      repository: fakeRepo(),
      authorization,
      clock,
      eventReaction: stubEventReaction(),
      publicBooking: stubPublicBooking(),
      validationPolicy: stubValidation(),
      capacityPolicy: stubCapacity(),
      assistedRegistrationMembers: stubAssistedRegistrationMembers(),
      tourCapacity: {
        kind: "test-tour-capacity",
        resolveTourCapacityMax: async () => null,
        resolveTourCapacityMaxMany: async () => ({}),
      },
      workspaceType: "denali",
      tenantWorkspaceBinding: stubTenantBinding(),
      capabilities: denaliCaps(),
      productionGradeIntegrity: false,
    });
    assert.equal(typeof service.listBookings, "function");
    assert.equal(service.boundWorkspaceType, "denali");
  });
});
