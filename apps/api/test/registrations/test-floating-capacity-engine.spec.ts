import assert from "node:assert/strict";
import test from "node:test";

import { RegistrationStatus } from "../../src/modules/registrations/registration.entity";
import { RegistrationsService } from "../../src/modules/registrations/registrations.service";
import type { ParticipantMetadataDto } from "../../src/modules/registrations/dto/participant-metadata.dto";
import type { TourEntity } from "../../src/modules/tours/entities/tour.entity";
import {
  resolveEffectiveCapacity,
  resolvePublicRegistrationCapacityBranch,
  shouldPublicRegistrationRouteToWaitlist,
  type EffectiveCapacityContext,
  type EffectiveCapacityTourInput,
} from "../../src/modules/registrations/utils/floating-capacity-engine";

const BUS_BASELINE = 50;
const FIVE_DRIVERS_THREE_SEATS: EffectiveCapacityContext["acceptedDrivers"] = Array.from(
  { length: 5 },
  () => ({ vehicleSeatCapacity: 3 }),
);

function tourInput(
  strategy: EffectiveCapacityTourInput["capacityStrategy"],
): EffectiveCapacityTourInput {
  return { totalCapacity: BUS_BASELINE, capacityStrategy: strategy };
}

test("Scenario A: 50 bus seats (FIXED) → effective capacity 50", () => {
  const effective = resolveEffectiveCapacity(tourInput("FIXED"));
  assert.equal(effective, 50);
});

test("Scenario B: 50 bus seats (FLOATING) + 5 drivers × 3 seats → effective capacity 65", () => {
  const effective = resolveEffectiveCapacity(tourInput("FLOATING"), {
    acceptedDrivers: FIVE_DRIVERS_THREE_SEATS,
  });
  assert.equal(effective, 65);
});

test("Scenario C: bus scalar full (50/50) but FLOATING effective 65 — routes to registration not waitlist", () => {
  const mockResolve = () => 65;

  assert.equal(
    shouldPublicRegistrationRouteToWaitlist(
      {
        acceptedCount: 50,
        tour: tourInput("FLOATING"),
        context: { acceptedDrivers: FIVE_DRIVERS_THREE_SEATS },
      },
      mockResolve,
    ),
    false,
  );

  assert.equal(
    resolvePublicRegistrationCapacityBranch(
      {
        acceptedCount: 50,
        tour: tourInput("FLOATING"),
        context: { acceptedDrivers: FIVE_DRIVERS_THREE_SEATS },
      },
      mockResolve,
    ),
    "registration",
  );
});

test("Scenario C contrast: FIXED at 50/50 still routes to waitlist", () => {
  assert.equal(
    resolvePublicRegistrationCapacityBranch({
      acceptedCount: 50,
      tour: tourInput("FIXED"),
    }),
    "waitlist",
  );
});

test("Scenario C: after capacity gate passes, free auto-accept tour places car owner as ACCEPTED", () => {
  const service = new RegistrationsService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const placement = (
    service as unknown as {
      resolveInitialRegistrationPlacement(
        t: TourEntity,
        m?: ParticipantMetadataDto,
        td?: Record<string, unknown> | null,
      ): { status: RegistrationStatus; consumesAcceptedCapacity: boolean };
    }
  ).resolveInitialRegistrationPlacement(
    {
      autoAcceptRegistrations: true,
      costContext: { requiresPayment: false },
    } as TourEntity,
    {
      transportIntake: { isDriver: true },
    },
    null,
  );

  assert.equal(placement.status, RegistrationStatus.ACCEPTED);
  assert.equal(placement.consumesAcceptedCapacity, true);
});

test("FLOATING without driver bonus uses baseline only", () => {
  assert.equal(resolveEffectiveCapacity(tourInput("FLOATING"), { acceptedDrivers: [] }), 50);
});

test("mocked resolveEffectiveCapacity can force waitlist when accepted meets mock cap", () => {
  const mockResolve = () => 50;
  assert.equal(
    resolvePublicRegistrationCapacityBranch(
      {
        acceptedCount: 50,
        tour: tourInput("FLOATING"),
        context: { acceptedDrivers: FIVE_DRIVERS_THREE_SEATS },
      },
      mockResolve,
    ),
    "waitlist",
  );
});
