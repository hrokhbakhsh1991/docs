/**
 * Executable booking capability levels — runtime gates on graded matrix (not boolean alone).
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { BOOKING_POLICY_CASE_A_GUEST_LABEL } from "@app-tour/booking-http-contracts";

import {
  assertBookingRuntimeCapabilitiesMatchAdapters,
  assertBookingRuntimeCapabilityLevels,
  requireBookingWorkspaceCapabilities,
} from "./assert-booking-runtime-capabilities.ts";
import { BookingCapabilityViolationError } from "./bookings.errors.ts";
import { resolveBookingWorkspaceDependencies } from "./booking-dependency-registry.ts";
import { resolveWorkspaceBookingEventReaction } from "./booking-event-reaction-registry.ts";
import { resetBookingsRepositoryForTests } from "./create-bookings-repository.ts";
import {
  createPublicGuestBooking,
  resetBookingsServiceCompositionForTests,
} from "./create-bookings-service.ts";
import type { BookingActorContext } from "./ports/booking-actor-context.ts";
import {
  getBookingWorkspaceCapabilities,
  type BookingWorkspaceCapabilities,
} from "./workspace-booking-capabilities.generated.ts";

const TENANT_DENALI = "00000000-0000-4000-8000-000000000014";
const TENANT_WS2 = "00000000-0000-4000-8000-000000000015";

function publicAuth(tenantId: string): BookingActorContext {
  return {
    tenantId,
    userId: "00000000-0000-4000-8000-000000000301",
    role: "none",
    status: "ACTIVE",
  };
}

function cloneCaps(
  base: BookingWorkspaceCapabilities,
  patch: Partial<{
    publicCreate: BookingWorkspaceCapabilities["publicCreate"];
    validation: BookingWorkspaceCapabilities["validation"];
    capacity: BookingWorkspaceCapabilities["capacity"];
    eventReaction: BookingWorkspaceCapabilities["eventReaction"];
  }>
): BookingWorkspaceCapabilities {
  return {
    ...base,
    ...patch,
  };
}

describe("booking runtime capability levels (executable)", { concurrency: false }, () => {
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

  it("1) supported=true but missing required capability fails closed", () => {
    const denali = getBookingWorkspaceCapabilities("denali");
    assert.ok(denali);

    const missingValidation = cloneCaps(denali, {
      validation: { enabled: false, mode: "none" },
    });
    assert.throws(
      () =>
        assertBookingRuntimeCapabilitiesMatchAdapters("denali", missingValidation, {
          publicBooking: { kind: "x", supportsPublicCreate: () => true },
          validationPolicy: { kind: "x", assertCreateValid: () => undefined },
          capacityPolicy: { kind: "x", assertCreateCapacity: () => undefined },
          eventReaction: {
            kind: "x",
            approveOutboxEventType: "registration.approved",
            reactAfterApprove: async () => undefined,
          },
        }),
      (err: unknown) =>
        err instanceof BookingCapabilityViolationError && err.capability === "validationMode"
    );

    assert.throws(
      () => requireBookingWorkspaceCapabilities("urban"),
      (err: unknown) =>
        err instanceof BookingCapabilityViolationError && err.capability === "enabled"
    );
  });

  it("2) booking-ws2 and denali have different runtime behavior (capacityMode + CASE_A)", async () => {
    const denaliCaps = requireBookingWorkspaceCapabilities("denali");
    const ws2Caps = requireBookingWorkspaceCapabilities("booking-ws2");
    assert.equal(denaliCaps.capacity.mode, "booking-owned");
    assert.equal(ws2Caps.capacity.mode, "booking-owned");
    assert.equal(denaliCaps.capacity.mode, ws2Caps.capacity.mode);

    const denaliDeps = resolveBookingWorkspaceDependencies("denali");
    const ws2Deps = resolveBookingWorkspaceDependencies("booking-ws2");
    assertBookingRuntimeCapabilityLevels("denali", {
      publicBooking: denaliDeps.publicBooking,
      validationPolicy: denaliDeps.validationPolicy,
      capacityPolicy: denaliDeps.capacityPolicy,
      eventReaction: resolveWorkspaceBookingEventReaction("denali"),
    });
    assertBookingRuntimeCapabilityLevels("booking-ws2", {
      publicBooking: ws2Deps.publicBooking,
      validationPolicy: ws2Deps.validationPolicy,
      capacityPolicy: ws2Deps.capacityPolicy,
      eventReaction: resolveWorkspaceBookingEventReaction("booking-ws2"),
    });

    const body = {
      tourId: "00000000-0000-4000-8000-000000000883",
      tourTitle: "Capability Level Tour",
      guestLabel: BOOKING_POLICY_CASE_A_GUEST_LABEL,
      partySize: 1,
      departureAt: "2030-09-01T09:00:00.000Z",
      registrationIntake: { tourCapacityMax: 10 },
    };

    const ok = await createPublicGuestBooking(publicAuth(TENANT_DENALI), body);
    assert.equal(ok.status, "pending");
    await assert.rejects(
      () => createPublicGuestBooking(publicAuth(TENANT_WS2), body),
      /BOOKING_CAPACITY_REJECTED/
    );
  });

  it("3) capability downgrade is detected (hollow publicCreate)", () => {
    const denali = getBookingWorkspaceCapabilities("denali");
    assert.ok(denali);

    const hollowPublic = cloneCaps(denali, {
      publicCreate: { enabled: true, mode: "create-pipeline" },
    });
    assert.throws(
      () =>
        assertBookingRuntimeCapabilitiesMatchAdapters("denali", hollowPublic, {
          publicBooking: { kind: "hollow", supportsPublicCreate: () => false },
          validationPolicy: { kind: "x", assertCreateValid: () => undefined },
          capacityPolicy: { kind: "x", assertCreateCapacity: () => undefined },
          eventReaction: {
            kind: "x",
            approveOutboxEventType: "registration.approved",
            reactAfterApprove: async () => undefined,
          },
        }),
      (err: unknown) =>
        err instanceof BookingCapabilityViolationError &&
        err.capability === "publicCreate" &&
        err.message.includes("downgrade")
    );

    const missingReactionBinding = cloneCaps(denali, {
      eventReaction: { enabled: true, mode: "in-process" },
    });
    assert.throws(
      () =>
        assertBookingRuntimeCapabilitiesMatchAdapters("urban-fake", missingReactionBinding, {
          publicBooking: { kind: "x", supportsPublicCreate: () => true },
          validationPolicy: { kind: "x", assertCreateValid: () => undefined },
          capacityPolicy: { kind: "x", assertCreateCapacity: () => undefined },
          eventReaction: {
            kind: "x",
            approveOutboxEventType: "registration.approved",
            reactAfterApprove: async () => undefined,
          },
        }),
      (err: unknown) =>
        err instanceof BookingCapabilityViolationError &&
        err.capability === "eventReactionMode" &&
        err.message.includes("no event reaction binding")
    );
  });
});
