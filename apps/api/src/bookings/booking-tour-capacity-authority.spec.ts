/**
 * Hostile: client registrationIntake.tourCapacityMax must not raise ceiling above tour SoT.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { resetBookingsRepositoryForTests } from "./create-bookings-repository.ts";
import {
  createPublicGuestBooking,
  resetBookingsServiceCompositionForTests,
} from "./create-bookings-service.ts";
import { createBookingsService } from "./bookings.service.ts";
import { resolveBookingWorkspaceDependencies } from "./booking-dependency-registry.ts";
import { resolveWorkspaceBookingEventReaction } from "./booking-event-reaction-registry.ts";
import { getBookingsRepository } from "./create-bookings-repository.ts";
import { HostBookingAuthorizationAdapter } from "./infrastructure/host-booking-authorization.adapter.ts";
import { HostBookingClockAdapter } from "./infrastructure/host-booking-clock.adapter.ts";
import { HostBookingTenantWorkspaceBindingAdapter } from "./infrastructure/host-booking-tenant-workspace-binding.adapter.ts";
import { assertBookingRuntimeCapabilityLevels } from "./assert-booking-runtime-capabilities.ts";
import { toBookingRuntimeCapabilities } from "./map-booking-runtime-capabilities.ts";
import type { BookingActorContext } from "./ports/booking-actor-context.ts";
import type { BookingTourCapacityPort } from "./ports/booking-tour-capacity.port.ts";

const TENANT_DENALI = "00000000-0000-4000-8000-000000000014";
const TOUR_ID = "00000000-0000-4000-8000-000000000991";

function publicAuth(tenantId: string): BookingActorContext {
  return {
    tenantId,
    userId: "00000000-0000-4000-8000-000000000301",
    role: "none",
    status: "ACTIVE",
  };
}

describe("booking tour capacity authority (hostile client inflation)", () => {
  before(() => {
    process.env.STORAGE_DRIVER = "memory";
  });

  beforeEach(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  after(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  it("P0: tour SoT capacityMax wins over inflated client registrationIntake", async () => {
    const tourCapacity: BookingTourCapacityPort = {
      kind: "fixture-tour-capacity",
      resolveTourCapacityMax: async () => 10,
    };
    const dependencies = resolveBookingWorkspaceDependencies("denali");
    const eventReaction = resolveWorkspaceBookingEventReaction("denali");
    const capabilities = assertBookingRuntimeCapabilityLevels("denali", {
      publicBooking: dependencies.publicBooking,
      validationPolicy: dependencies.validationPolicy,
      capacityPolicy: dependencies.capacityPolicy,
      eventReaction,
    });
    const service = createBookingsService({
      repository: getBookingsRepository(),
      authorization: new HostBookingAuthorizationAdapter(),
      clock: new HostBookingClockAdapter(),
      eventReaction,
      publicBooking: dependencies.publicBooking,
      validationPolicy: dependencies.validationPolicy,
      capacityPolicy: dependencies.capacityPolicy,
      tourCapacity,
      workspaceType: "denali",
      tenantWorkspaceBinding: new HostBookingTenantWorkspaceBindingAdapter(),
      capabilities: toBookingRuntimeCapabilities(capabilities),
    });

    await assert.rejects(
      () =>
        service.createPublicGuestBooking(publicAuth(TENANT_DENALI), {
          tourId: TOUR_ID,
          tourTitle: "Inflation Tour",
          guestLabel: "Attacker",
          guestEmail: "attacker@example.com",
          guestPhone: "+15550001111",
          partySize: 11,
          departureAt: "2030-08-01T09:00:00.000Z",
          registrationIntake: { tourCapacityMax: 999999 },
        }),
      /BOOKING_CAPACITY_REJECTED/
    );

    const ok = await service.createPublicGuestBooking(publicAuth(TENANT_DENALI), {
      tourId: TOUR_ID,
      tourTitle: "Inflation Tour",
      guestLabel: "Honest",
      guestEmail: "honest@example.com",
      guestPhone: "+15550002222",
      partySize: 2,
      departureAt: "2030-08-01T09:00:00.000Z",
      registrationIntake: { tourCapacityMax: 999999 },
    });
    assert.equal(ok.status, "pending");
  });

  it("façade path still accepts intake when tour SoT absent (fixture compat in test)", async () => {
    const created = await createPublicGuestBooking(publicAuth(TENANT_DENALI), {
      tourId: TOUR_ID,
      tourTitle: "Fixture Tour",
      guestLabel: "Fixture Guest",
      guestEmail: "fixture@example.com",
      guestPhone: "+15550003333",
      partySize: 1,
      departureAt: "2030-08-01T09:00:00.000Z",
      registrationIntake: { tourCapacityMax: 10 },
    });
    assert.equal(created.status, "pending");
  });

  it("P1: prodlike rejects create when tour SoT lacks capacityMax (no client ceiling)", async () => {
    const previous = process.env.APP_RUNTIME_PROFILE;
    // Resolve memory repo before prodlike — prodlike forbids memory storage driver boot.
    const repository = getBookingsRepository();
    process.env.APP_RUNTIME_PROFILE = "prodlike";
    try {
      const tourCapacity: BookingTourCapacityPort = {
        kind: "fixture-tour-capacity-missing",
        resolveTourCapacityMax: async () => null,
      };
      const dependencies = resolveBookingWorkspaceDependencies("denali");
      const eventReaction = resolveWorkspaceBookingEventReaction("denali");
      const capabilities = assertBookingRuntimeCapabilityLevels("denali", {
        publicBooking: dependencies.publicBooking,
        validationPolicy: dependencies.validationPolicy,
        capacityPolicy: dependencies.capacityPolicy,
        eventReaction,
      });
      const service = createBookingsService({
        repository,
        authorization: new HostBookingAuthorizationAdapter(),
        clock: new HostBookingClockAdapter(),
        eventReaction,
        publicBooking: dependencies.publicBooking,
        validationPolicy: dependencies.validationPolicy,
        capacityPolicy: dependencies.capacityPolicy,
        tourCapacity,
        workspaceType: "denali",
        tenantWorkspaceBinding: new HostBookingTenantWorkspaceBindingAdapter(),
        capabilities: toBookingRuntimeCapabilities(capabilities),
      });

      await assert.rejects(
        () =>
          service.createPublicGuestBooking(publicAuth(TENANT_DENALI), {
            tourId: TOUR_ID,
            tourTitle: "No SoT Tour",
            guestLabel: "Prodlike Guest",
            guestEmail: "prodlike@example.com",
            guestPhone: "+15550004444",
            partySize: 1,
            departureAt: "2030-08-01T09:00:00.000Z",
            registrationIntake: { tourCapacityMax: 99 },
          }),
        /BOOKING_CAPACITY_REJECTED: tourCapacityMax required/
      );
    } finally {
      if (previous === undefined) {
        delete process.env.APP_RUNTIME_PROFILE;
      } else {
        process.env.APP_RUNTIME_PROFILE = previous;
      }
    }
  });
});
