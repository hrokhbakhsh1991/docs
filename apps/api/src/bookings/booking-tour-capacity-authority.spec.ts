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
import { peekOutboxByAggregateForTests } from "./in-memory-bookings.repository.ts";

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

function opsAuth(tenantId: string): BookingActorContext {
  return {
    tenantId,
    userId: "00000000-0000-4000-8000-000000000202",
    role: "admin",
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
      resolveTourCapacityMaxMany: async (_tenantId, tourIds) =>
        Object.fromEntries(tourIds.map((id) => [id, 10])),
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
      assistedRegistrationMembers: {
        findTenantMember: async () => null,
      },
      tourCapacity,
      workspaceType: "denali",
      tenantWorkspaceBinding: new HostBookingTenantWorkspaceBindingAdapter(),
      capabilities: toBookingRuntimeCapabilities(capabilities),
      productionGradeIntegrity: false,
      postCancelSideEffects: {
        run: async () => ({
          refundDrafted: false,
          refundId: null,
          eligibleRefundMinor: "0",
          waitlistPromoted: false,
        }),
      },
      registrationSlo: { record: () => undefined },
      financialDisplayState: {
        resolve: () => undefined,
      },
      serialMutation: { run: async (fn) => fn() },
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

  it("operator capacity admission promotes a waitlist booking once and is idempotent", async () => {
    let capacity = 1;
    const tourCapacity: BookingTourCapacityPort = {
      kind: "fixture-capacity-admission",
      resolveTourCapacityMax: async () => capacity,
      resolveTourCapacityMaxMany: async (_tenantId, tourIds) =>
        Object.fromEntries(tourIds.map((id) => [id, capacity])),
      increaseTourCapacity: async ({ delta }) => {
        const previousCapacity = capacity;
        capacity += delta;
        return { previousCapacity, nextCapacity: capacity };
      },
      restoreTourCapacityIfUnchanged: async ({ expectedCapacity, restoreCapacity }) => {
        if (capacity !== expectedCapacity) return false;
        capacity = restoreCapacity;
        return true;
      },
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
      assistedRegistrationMembers: { findTenantMember: async () => null },
      tourCapacity,
      workspaceType: "denali",
      tenantWorkspaceBinding: new HostBookingTenantWorkspaceBindingAdapter(),
      capabilities: toBookingRuntimeCapabilities(capabilities),
      productionGradeIntegrity: false,
      postCancelSideEffects: {
        run: async () => ({
          refundDrafted: false,
          refundId: null,
          eligibleRefundMinor: "0",
          waitlistPromoted: false,
        }),
      },
      registrationSlo: { record: () => undefined },
      financialDisplayState: { resolve: () => undefined },
      serialMutation: { run: async (fn) => fn() },
    });

    const pending = await service.createBooking(opsAuth(TENANT_DENALI), {
      tourId: TOUR_ID,
      tourTitle: "Capacity Admission Tour",
      guestLabel: "Waitlisted Group",
      guestEmail: "waitlist@example.com",
      guestPhone: "+15550009991",
      partySize: 2,
      departureAt: "2030-08-01T09:00:00.000Z",
      registrationIntake: {},
    });
    await service.waitlistBooking(opsAuth(TENANT_DENALI), pending.id);

    const repository = getBookingsRepository();
    const approveWithOutbox = repository.approveWithOutbox.bind(repository);
    let failApprovalOnce = true;
    repository.approveWithOutbox = async (input) => {
      if (failApprovalOnce) {
        failApprovalOnce = false;
        throw new Error("injected pre-commit approval failure");
      }
      return approveWithOutbox(input);
    };
    try {
      await assert.rejects(
        () => service.promoteWaitlistWithCapacityIncrease(opsAuth(TENANT_DENALI), pending.id),
        /injected pre-commit approval failure/
      );
      assert.equal(capacity, 1, "a definitely uncommitted promotion restores capacity");
      assert.equal((await repository.getById(pending.id, TENANT_DENALI))?.status, "waitlisted");
    } finally {
      repository.approveWithOutbox = approveWithOutbox;
    }

    let loseCommittedResponseOnce = true;
    repository.approveWithOutbox = async (input) => {
      const committed = await approveWithOutbox(input);
      if (loseCommittedResponseOnce) {
        loseCommittedResponseOnce = false;
        throw new Error("injected lost response after commit");
      }
      return committed;
    };
    let promoted: Awaited<ReturnType<typeof service.promoteWaitlistWithCapacityIncrease>>;
    try {
      promoted = await service.promoteWaitlistWithCapacityIncrease(
        opsAuth(TENANT_DENALI),
        pending.id
      );
    } finally {
      repository.approveWithOutbox = approveWithOutbox;
    }

    assert.deepEqual(promoted, {
      id: pending.id,
      status: "approved",
      paymentStatus: "unpaid",
      capacityAdded: 2,
      previousCapacity: 1,
      nextCapacity: 3,
    });
    assert.equal(capacity, 3);

    const retry = await service.promoteWaitlistWithCapacityIncrease(
      opsAuth(TENANT_DENALI),
      pending.id
    );
    assert.deepEqual(retry, promoted);
    assert.equal(capacity, 3, "replaying the same promotion must not add capacity twice");
    const events = peekOutboxByAggregateForTests({
      tenantId: TENANT_DENALI,
      aggregateId: pending.id,
    });
    assert.equal(
      events.filter(
        (event) => event.eventType === "registration.waitlist_promoted_with_capacity_increase"
      ).length,
      1
    );

    await assert.rejects(
      () =>
        service.promoteWaitlistWithCapacityIncrease(
          opsAuth(TENANT_DENALI),
          pending.id + "-missing"
        ),
      /BOOKING_NOT_FOUND/
    );
    assert.equal(capacity, 3);
  });

  it("does not promote a dong waitlist party when the added global capacity has no car seats", async () => {
    let capacity = 10;
    const tourCapacity: BookingTourCapacityPort = {
      kind: "fixture-car-seat-capacity-admission",
      resolveTourCapacityMax: async () => capacity,
      resolveTourCapacityMaxMany: async (_tenantId, tourIds) =>
        Object.fromEntries(tourIds.map((id) => [id, capacity])),
      increaseTourCapacity: async ({ delta }) => {
        const previousCapacity = capacity;
        capacity += delta;
        return { previousCapacity, nextCapacity: capacity };
      },
      restoreTourCapacityIfUnchanged: async ({ expectedCapacity, restoreCapacity }) => {
        if (capacity !== expectedCapacity) return false;
        capacity = restoreCapacity;
        return true;
      },
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
      assistedRegistrationMembers: { findTenantMember: async () => null },
      tourCapacity,
      workspaceType: "denali",
      tenantWorkspaceBinding: new HostBookingTenantWorkspaceBindingAdapter(),
      capabilities: toBookingRuntimeCapabilities(capabilities),
      productionGradeIntegrity: false,
      postCancelSideEffects: {
        run: async () => ({
          refundDrafted: false,
          refundId: null,
          eligibleRefundMinor: "0",
          waitlistPromoted: false,
        }),
      },
      registrationSlo: { record: () => undefined },
      financialDisplayState: { resolve: () => undefined },
      serialMutation: { run: async (fn) => fn() },
    });
    let phoneCounter = 10;
    const create = (label: string, transport: Readonly<Record<string, unknown>>) =>
      service.createBooking(opsAuth(TENANT_DENALI), {
        tourId: TOUR_ID,
        tourTitle: "Car Seat Admission Tour",
        guestLabel: label,
        guestEmail: `${label.toLowerCase().replaceAll(" ", ".")}@example.com`,
        guestPhone: `+155500000${String(phoneCounter++).padStart(2, "0")}`,
        partySize: 1,
        departureAt: "2030-08-01T09:00:00.000Z",
        registrationIntake: { transport },
      });

    const driver = await create("Car Seat Driver", {
      kind: "personal_car",
      personalCarOccupants: 1,
    });
    await service.approveBooking(opsAuth(TENANT_DENALI), driver.id);
    const queuedDong = await create("Queued Dong", { kind: "no_car_dong" });
    await service.waitlistBooking(opsAuth(TENANT_DENALI), queuedDong.id);
    const seatedDong = await create("Seated Dong", { kind: "no_car_dong" });
    await service.approveBooking(opsAuth(TENANT_DENALI), seatedDong.id);

    await assert.rejects(
      () => service.promoteWaitlistWithCapacityIncrease(opsAuth(TENANT_DENALI), queuedDong.id),
      /BOOKING_TRANSPORT_CAPACITY_REJECTED/
    );
    assert.equal(
      (await getBookingsRepository().getById(queuedDong.id, TENANT_DENALI))?.status,
      "waitlisted"
    );
    assert.equal(capacity, 10, "failed admission must compensate the global capacity increase");
  });

  it("approves a waitlisted dong after a driver adds seats without inflating tour capacity", async () => {
    let capacity = 10;
    const tourCapacity: BookingTourCapacityPort = {
      kind: "fixture-car-seat-normal-promotion",
      resolveTourCapacityMax: async () => capacity,
      resolveTourCapacityMaxMany: async (_tenantId, tourIds) =>
        Object.fromEntries(tourIds.map((id) => [id, capacity])),
      increaseTourCapacity: async ({ delta }) => {
        const previousCapacity = capacity;
        capacity += delta;
        return { previousCapacity, nextCapacity: capacity };
      },
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
      assistedRegistrationMembers: { findTenantMember: async () => null },
      tourCapacity,
      workspaceType: "denali",
      tenantWorkspaceBinding: new HostBookingTenantWorkspaceBindingAdapter(),
      capabilities: toBookingRuntimeCapabilities(capabilities),
      productionGradeIntegrity: false,
      postCancelSideEffects: {
        run: async () => ({
          refundDrafted: false,
          refundId: null,
          eligibleRefundMinor: "0",
          waitlistPromoted: false,
        }),
      },
      registrationSlo: { record: () => undefined },
      financialDisplayState: { resolve: () => undefined },
      serialMutation: { run: async (fn) => fn() },
    });
    let phoneCounter = 30;
    const create = (label: string, transport: Readonly<Record<string, unknown>>) =>
      service.createBooking(opsAuth(TENANT_DENALI), {
        tourId: TOUR_ID,
        tourTitle: "Car Seat Normal Promotion Tour",
        guestLabel: label,
        guestEmail: `${label.toLowerCase().replaceAll(" ", ".")}@example.com`,
        guestPhone: `+155500000${String(phoneCounter++).padStart(2, "0")}`,
        partySize: 1,
        departureAt: "2030-08-01T09:00:00.000Z",
        registrationIntake: { transport },
      });

    const firstDriver = await create("First Driver", {
      kind: "personal_car",
      personalCarOccupants: 1,
    });
    await service.approveBooking(opsAuth(TENANT_DENALI), firstDriver.id);
    const seatedDong = await create("Seated Dong", { kind: "no_car_dong" });
    await service.approveBooking(opsAuth(TENANT_DENALI), seatedDong.id);
    const queuedDong = await create("Queued Dong", { kind: "no_car_dong" });
    await service.waitlistBooking(opsAuth(TENANT_DENALI), queuedDong.id);

    const secondDriver = await create("Second Driver", {
      kind: "personal_car",
      personalCarOccupants: 1,
    });
    await service.approveBooking(opsAuth(TENANT_DENALI), secondDriver.id);

    const promoted = await service.approveBooking(opsAuth(TENANT_DENALI), queuedDong.id);
    assert.equal(promoted.status, "approved");
    assert.equal(
      (await getBookingsRepository().getById(queuedDong.id, TENANT_DENALI))?.status,
      "approved"
    );
    assert.equal(capacity, 10, "a new car seat must not mutate the tour-wide capacity");
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
        resolveTourCapacityMaxMany: async (_tenantId, tourIds) =>
          Object.fromEntries(tourIds.map((id) => [id, null])),
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
        assistedRegistrationMembers: {
          findTenantMember: async () => null,
        },
        tourCapacity,
        workspaceType: "denali",
        tenantWorkspaceBinding: new HostBookingTenantWorkspaceBindingAdapter(),
        capabilities: toBookingRuntimeCapabilities(capabilities),
        productionGradeIntegrity: true,
        postCancelSideEffects: {
          run: async () => ({
            refundDrafted: false,
            refundId: null,
            eligibleRefundMinor: "0",
            waitlistPromoted: false,
          }),
        },
        registrationSlo: { record: () => undefined },
        financialDisplayState: {
          resolve: () => undefined,
        },
        serialMutation: { run: async (fn) => fn() },
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
