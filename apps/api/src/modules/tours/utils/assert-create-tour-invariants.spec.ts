import test from "node:test";
import assert from "node:assert/strict";

import { BadRequestException } from "@nestjs/common";

import { TourLifecycleStatus } from "../entities/tour.entity";
import type { CreateTourDto } from "../dto/create-tour.dto";
import type { TourTripDetails } from "../types/tour-trip-details.types";
import {
  assertCreateTourInvariants,
  assertIncomingCreateTourDtoBeforeFormProfileStrip,
  assertIncomingTripDetailsPatchFragmentBeforeFormProfileStrip,
  assertTripDetailsForFormProfile,
  assertWorkspaceCapacity,
  validateTripDetailsCanonical,
} from "./assert-create-tour-invariants";

function minimalDto(overrides: Partial<CreateTourDto> = {}): CreateTourDto {
  return {
    title: "1234567890ab",
    total_capacity: 10,
    lifecycle_status: TourLifecycleStatus.DRAFT,
    ...overrides
  };
}

test("allows private_car when fuelShareToman is set", () => {
  assert.doesNotThrow(() =>
    assertCreateTourInvariants(
      minimalDto({
        tripDetails: {
          logistics: {
            primaryTransportMode: "private_car",
            fuelShareToman: 100_000
          }
        }
      } as CreateTourDto)
    )
  );
});

test("rejects private_car without fuelShareToman", () => {
  try {
    assertCreateTourInvariants(
      minimalDto({
        tripDetails: {
          logistics: { primaryTransportMode: "private_car" }
        }
      } as CreateTourDto)
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { message?: string } };
    assert.match(body.error?.message ?? "", /fuelShareToman/);
  }
});

test("rejects bus plus private_car in transportModes without fuelShareToman", () => {
  try {
    assertCreateTourInvariants(
      minimalDto({
        transportModes: ["bus", "private_car"],
        tripDetails: {
          logistics: { primaryTransportMode: "bus" }
        }
      } as CreateTourDto)
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { message?: string } };
    assert.match(body.error?.message ?? "", /fuelShareToman/);
  }
});

test("allows bus plus private_car when fuelShareToman is set", () => {
  assert.doesNotThrow(() =>
    assertCreateTourInvariants(
      minimalDto({
        transportModes: ["bus", "private_car"],
        tripDetails: {
          logistics: { primaryTransportMode: "bus", fuelShareToman: 250_000 }
        }
      } as CreateTourDto)
    )
  );
});

test("validateTripDetailsCanonical rejects invalid merged tripDetails (ages)", () => {
  try {
    validateTripDetailsCanonical({
      participation: { minimumAge: 18, maximumAge: 10 }
    } as never);
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
  }
});

test("validateTripDetailsCanonical allows equal meeting times on different return dates", () => {
  assert.doesNotThrow(() =>
    validateTripDetailsCanonical({
      logistics: {
        departureDate: "2026-06-01",
        returnDate: "2026-06-03",
        departureMeetingTime: "08:00",
        returnMeetingTime: "08:00",
      },
    } as never),
  );
});

test("validateTripDetailsCanonical accepts multi-day dayPlans with equal meeting times", () => {
  assert.doesNotThrow(() =>
    validateTripDetailsCanonical({
      logistics: {
        departureDate: "2026-06-01",
        returnDate: "2026-06-03",
        departureMeetingTime: "08:00",
        returnMeetingTime: "08:00",
      },
      itinerary: {
        dayPlans: [
          { day: 1, description: "Approach" },
          { day: 2, description: "Summit" },
        ],
      },
    } as never),
  );
});

test("validateTripDetailsCanonical rejects return meeting time not after departure on same day", () => {
  try {
    validateTripDetailsCanonical({
      logistics: {
        departureDate: "2026-06-01",
        returnDate: "2026-06-01",
        departureMeetingTime: "18:00",
        returnMeetingTime: "08:00",
      },
    } as never);
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { message?: string } };
    assert.match(body.error?.message ?? "", /returnMeetingTime must be after departureMeetingTime/);
  }
});

test("rejects segmentActivities day beyond schedule duration", () => {
  try {
    assertCreateTourInvariants(
      minimalDto({
        tripDetails: {
          logistics: {
            departureDate: "2026-01-01",
            returnDate: "2026-01-02"
          },
          itinerary: {
            segmentActivities: [
              {
                dayNumber: 5,
                segments: []
              }
            ]
          }
        }
      } as unknown as CreateTourDto)
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { message?: string } };
    assert.match(body.error?.message ?? "", /scheduled date range/);
  }
});

test("assertTripDetailsForFormProfile delegates to canonical rules (general profile)", () => {
  assert.throws(
    () =>
      assertTripDetailsForFormProfile("general", {
        participation: { minimumAge: 30, maximumAge: 20 },
      } as never),
    BadRequestException,
  );
});

test("assertTripDetailsForFormProfile rejects non-empty root transportModes for urban_event", () => {
  try {
    assertTripDetailsForFormProfile(
      "urban_event",
      { logistics: { primaryTransportMode: "bus", fuelShareToman: 1 } } as never,
      ["bus"],
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "VALIDATION_PROFILE_TRANSPORT_NOT_ALLOWED");
  }
});

test("assertTripDetailsForFormProfile allows empty transportModes for urban_event", () => {
  assert.doesNotThrow(() =>
    assertTripDetailsForFormProfile(
      "urban_event",
      { logistics: { primaryTransportMode: "bus", fuelShareToman: 1 } } as never,
      [],
    ),
  );
});

test("assertTripDetailsForFormProfile rejects phantom participation for cinema_event", () => {
  try {
    assertTripDetailsForFormProfile(
      "cinema_event",
      {
        participation: { requirements: "ghost" },
        logistics: { primaryTransportMode: "bus", fuelShareToman: 1 },
      } as never,
      [],
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "VALIDATION_PROFILE_PHANTOM_PARTICIPATION");
  }
});

test("assertTripDetailsForFormProfile rejects phantom itinerary dayPlans for urban_event", () => {
  try {
    assertTripDetailsForFormProfile(
      "urban_event",
      {
        logistics: { departureDate: "2026-01-01", returnDate: "2026-01-03", fuelShareToman: 1, primaryTransportMode: "bus" },
        itinerary: { dayPlans: [{ day: 1, title: "x" }] },
      } as never,
      [],
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "VALIDATION_PROFILE_PHANTOM_ITINERARY");
  }
});

test("assertTripDetailsForFormProfile rejects phantom segmentActivities for cinema_event", () => {
  try {
    assertTripDetailsForFormProfile(
      "cinema_event",
      {
        logistics: { departureDate: "2026-01-01", returnDate: "2026-01-03", fuelShareToman: 1, primaryTransportMode: "bus" },
        itinerary: { segmentActivities: [{ dayNumber: 1, segments: [] }] },
      } as never,
      [],
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "VALIDATION_PROFILE_PHANTOM_ITINERARY");
  }
});

test("assertTripDetailsForFormProfile allows stripped cinema_event shape", () => {
  assert.doesNotThrow(() =>
    assertTripDetailsForFormProfile(
      "cinema_event",
      {
        logistics: { primaryTransportMode: "bus", fuelShareToman: 100 },
        itinerary: { highlights: ["only"] },
      } as never,
      ["bus"],
    ),
  );
});

test("assertIncomingCreateTourDtoBeforeFormProfileStrip rejects urban ghost participation", () => {
  try {
    assertIncomingCreateTourDtoBeforeFormProfileStrip("urban_event", {
      ...minimalDto(),
      transportModes: [],
      tripDetails: {
        participation: { minimumAge: 1 },
        logistics: { departureDate: "2026-01-01", returnDate: "2026-01-02", primaryTransportMode: "bus", fuelShareToman: 1 },
      },
    } as CreateTourDto);
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "VALIDATION_PROFILE_INCOMING_PHANTOM_PARTICIPATION");
  }
});

test("assertIncomingCreateTourDtoBeforeFormProfileStrip rejects urban non-empty transportModes", () => {
  try {
    assertIncomingCreateTourDtoBeforeFormProfileStrip("urban_event", {
      ...minimalDto(),
      transportModes: ["bus"],
      tripDetails: {
        logistics: { departureDate: "2026-01-01", returnDate: "2026-01-02", primaryTransportMode: "bus", fuelShareToman: 1 },
      },
    } as CreateTourDto);
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "VALIDATION_PROFILE_INCOMING_TRANSPORT_NOT_ALLOWED");
  }
});

test("assertIncomingTripDetailsPatchFragment allows empty patch with no transport for urban", () => {
  assert.doesNotThrow(() =>
    assertIncomingTripDetailsPatchFragmentBeforeFormProfileStrip("urban_event", {}, undefined),
  );
});

test("assertIncomingTripDetailsPatchFragment rejects urban transport in request", () => {
  try {
    assertIncomingTripDetailsPatchFragmentBeforeFormProfileStrip("urban_event", {}, ["bus"]);
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "VALIDATION_PROFILE_INCOMING_TRANSPORT_NOT_ALLOWED");
  }
});

test("assertIncomingTripDetailsPatchFragment rejects urban participation in patch", () => {
  try {
    assertIncomingTripDetailsPatchFragmentBeforeFormProfileStrip(
      "urban_event",
      { participation: { minimumAge: 18 } },
      undefined,
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "VALIDATION_PROFILE_INCOMING_PHANTOM_PARTICIPATION");
  }
});

test("assertIncomingTripDetailsPatchFragment rejects cinema participation in patch", () => {
  try {
    assertIncomingTripDetailsPatchFragmentBeforeFormProfileStrip(
      "cinema_event",
      { participation: { gearRequiredIds: ["uuid"] } },
      undefined,
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "VALIDATION_PROFILE_INCOMING_PHANTOM_PARTICIPATION");
  }
});

test("assertIncomingTripDetailsPatchFragment rejects urban non-whitelist logistics key in patch", () => {
  try {
    assertIncomingTripDetailsPatchFragmentBeforeFormProfileStrip(
      "urban_event",
      { logistics: { primaryTransportMode: "bus", fuelShareToman: 1 } },
      undefined,
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "VALIDATION_PROFILE_INCOMING_LOGISTICS_EXTRA");
  }
});

test("assertIncomingTripDetailsPatchFragment rejects urban itinerary.dayPlans in patch", () => {
  try {
    assertIncomingTripDetailsPatchFragmentBeforeFormProfileStrip(
      "urban_event",
      { itinerary: { dayPlans: [{ dayNumber: 1, title: "day" }] } },
      undefined,
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "VALIDATION_PROFILE_INCOMING_PHANTOM_ITINERARY");
  }
});

test("assertIncomingTripDetailsPatchFragment rejects cinema itinerary.segmentActivities in patch", () => {
  try {
    assertIncomingTripDetailsPatchFragmentBeforeFormProfileStrip(
      "cinema_event",
      { itinerary: { segmentActivities: [{ dayNumber: 1, segments: [] }] } },
      undefined,
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "VALIDATION_PROFILE_INCOMING_PHANTOM_ITINERARY");
  }
});

test("assertIncomingTripDetailsPatchFragment allows urban whitelist logistics in patch", () => {
  assert.doesNotThrow(() =>
    assertIncomingTripDetailsPatchFragmentBeforeFormProfileStrip(
      "urban_event",
      {
        logistics: {
          departureDate: "2026-06-01",
          returnDate: "2026-06-02",
          meetingPoint: "Tehran",
        },
      },
      undefined,
    ),
  );
});

test("assertDenaliPilotTripDetails rejects missing denaliTourKind", () => {
  try {
    assertTripDetailsForFormProfile(
      "denali_pilot",
      {
        overview: { difficultyLevel: 5 },
        participation: {
          minimumAge: 18,
          fitnessLevel: "moderate",
          sportsInsuranceRequired: true,
        },
        logistics: { primaryTransportMode: "bus", groupSizeMax: 10 },
      } as never,
      ["bus"],
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "WORKSPACE_RULE_DENALI_TOUR_KIND_REQUIRED");
  }
});

test("assertDenaliPilotTripDetails rejects empty denaliTourKind", () => {
  try {
    assertTripDetailsForFormProfile(
      "denali_pilot",
      {
        overview: { denaliTourKind: "  " },
        logistics: { primaryTransportMode: "bus" },
      } as never,
      ["bus"],
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "WORKSPACE_RULE_DENALI_TOUR_KIND_REQUIRED");
  }
});

test("assertDenaliPilotTripDetails rejects invalid denaliTourKind", () => {
  try {
    assertTripDetailsForFormProfile(
      "denali_pilot",
      {
        overview: { denaliTourKind: "not_a_kind" },
        logistics: { primaryTransportMode: "bus" },
      } as never,
      ["bus"],
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "WORKSPACE_RULE_DENALI_TOUR_KIND_INVALID");
  }
});

test("assertDenaliPilotTripDetails rejects difficulty on event_cinema", () => {
  try {
    assertTripDetailsForFormProfile(
      "denali_pilot",
      {
        overview: { denaliTourKind: "event_cinema", difficultyLevel: 5 },
        logistics: { primaryTransportMode: "bus" },
      } as never,
      ["bus"],
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "WORKSPACE_RULE_DENALI_EVENT_DIFFICULTY_FORBIDDEN");
  }
});

test("assertDenaliPilotTripDetails requires fuelShareToman for dong + private_car", () => {
  try {
    assertTripDetailsForFormProfile(
      "denali_pilot",
      {
        overview: { denaliTourKind: "mountain_day" },
        logistics: {
          primaryTransportMode: "bus",
          privateCarMode: "car_share_fixed_dong",
        },
      } as never,
      ["bus", "private_car"],
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "WORKSPACE_RULE_DENALI_DONG_AMOUNT_REQUIRED");
  }
});

function validDenaliMountainTripDetails(
  overrides: {
    overview?: Record<string, unknown>;
    logistics?: Record<string, unknown>;
    participation?: Record<string, unknown> | null;
  } = {},
): TourTripDetails {
  const baseParticipation = {
    minimumAge: 18,
    fitnessLevel: "moderate",
    sportsInsuranceRequired: true,
  };
  return {
    overview: { denaliTourKind: "mountain_day", difficultyLevel: 5, ...overrides.overview },
    logistics: {
      primaryTransportMode: "bus",
      groupSizeMax: 12,
      privateCarMode: "no_private_car",
      ...overrides.logistics,
    },
    participation:
      overrides.participation === null
        ? undefined
        : ({
            ...baseParticipation,
            ...overrides.participation,
          } as TourTripDetails["participation"]),
  } as TourTripDetails;
}

function validDenaliMountainCreateDto(
  overrides: Partial<CreateTourDto> = {},
): CreateTourDto {
  return minimalDto({
    total_capacity: 12,
    tripDetails: validDenaliMountainTripDetails(),
    ...overrides,
  });
}

test("assertCreateTourInvariants rejects denali_pilot create without denaliTourKind when tripDetails present", () => {
  try {
    assertCreateTourInvariants(
      validDenaliMountainCreateDto({
        tripDetails: {
          overview: {},
          logistics: { primaryTransportMode: "bus", groupSizeMax: 10 },
        } as TourTripDetails,
      }),
      "denali_pilot",
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "WORKSPACE_RULE_DENALI_TOUR_KIND_REQUIRED");
  }
});

test("assertCreateTourInvariants rejects denali_pilot total_capacity zero", () => {
  try {
    assertCreateTourInvariants(
      validDenaliMountainCreateDto({ total_capacity: 0 }),
      "denali_pilot",
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "WORKSPACE_RULE_DENALI_TOTAL_CAPACITY_INVALID");
  }
});

test("assertDenaliPilotTripDetails rejects logistics.groupSizeMax zero", () => {
  try {
    assertTripDetailsForFormProfile(
      "denali_pilot",
      validDenaliMountainTripDetails({ logistics: { groupSizeMax: 0 } }),
      ["bus"],
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "WORKSPACE_RULE_DENALI_GROUP_SIZE_MAX_INVALID");
  }
});

test("assertDenaliPilotTripDetails rejects mountain_day without fitnessLevel", () => {
  try {
    assertTripDetailsForFormProfile(
      "denali_pilot",
      validDenaliMountainTripDetails({
        participation: {
          minimumAge: 18,
          sportsInsuranceRequired: true,
          fitnessLevel: undefined,
        },
      }),
      ["bus"],
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "WORKSPACE_RULE_DENALI_PARTICIPATION_FITNESS_LEVEL_REQUIRED");
  }
});

test("assertDenaliPilotTripDetails allows mountain_day when sportsInsuranceRequired is false", () => {
  assertTripDetailsForFormProfile(
    "denali_pilot",
    validDenaliMountainTripDetails({
      participation: {
        minimumAge: 18,
        fitnessLevel: "moderate",
        sportsInsuranceRequired: false,
      },
    }),
    ["bus"],
  );
});

test("assertDenaliPilotTripDetails rejects mountain_day without minimumAge", () => {
  try {
    assertTripDetailsForFormProfile(
      "denali_pilot",
      validDenaliMountainTripDetails({
        participation: {
          fitnessLevel: "moderate",
          sportsInsuranceRequired: true,
          minimumAge: undefined,
        },
      }),
      ["bus"],
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "WORKSPACE_RULE_DENALI_PARTICIPATION_MINIMUM_AGE_REQUIRED");
  }
});

test("assertDenaliPilotTripDetails does not require mountain participation for nature_day", () => {
  assert.doesNotThrow(() =>
    assertTripDetailsForFormProfile(
      "denali_pilot",
      {
        overview: { denaliTourKind: "nature_day" },
        logistics: { primaryTransportMode: "bus", groupSizeMax: 10 },
      } as never,
      ["bus"],
    ),
  );
});

test("assertCreateTourInvariants allows valid denali_pilot mountain_day payload", () => {
  assert.doesNotThrow(() => assertCreateTourInvariants(validDenaliMountainCreateDto(), "denali_pilot"));
});

test("assertDenaliPilotTripDetails allows valid mountain_day with dong amount", () => {
  assert.doesNotThrow(() =>
    assertTripDetailsForFormProfile(
      "denali_pilot",
      validDenaliMountainTripDetails({
        logistics: {
          primaryTransportMode: "bus",
          privateCarMode: "car_share_fixed_dong",
          fuelShareToman: 150_000,
          groupSizeMax: 12,
        },
      }),
      ["bus", "private_car"],
    ),
  );
});

test("assertDenaliPilotTripDetails rejects null tripDetails", () => {
  try {
    assertTripDetailsForFormProfile("denali_pilot", null, []);
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "WORKSPACE_RULE_DENALI_TRIP_DETAILS_REQUIRED");
  }
});

test("assertIncomingCreateTourDto allows urban logistics after class-transformer (undefined DTO keys ignored)", () => {
  const { plainToInstance } = require("class-transformer") as typeof import("class-transformer");
  const { CreateTourDto } = require("../dto/create-tour.dto") as typeof import("../dto/create-tour.dto");
  const dto = plainToInstance(CreateTourDto, {
    title: "1234567890 urban logistics dto",
    total_capacity: 1,
    lifecycle_status: "Draft",
    formProfile: "urban_event",
    tourType: "city",
    tripDetails: {
      logistics: { departureDate: "2026-08-10", returnDate: "2026-08-11" },
    },
  });
  assert.doesNotThrow(() => assertIncomingCreateTourDtoBeforeFormProfileStrip("urban_event", dto));
});

test("assertWorkspaceCapacity(nature_trip) enforces Arctic min capacity via strategy registry", () => {
  assert.doesNotThrow(() => assertWorkspaceCapacity("nature_trip", 5));
  try {
    assertWorkspaceCapacity("nature_trip", 4);
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "WORKSPACE_RULE_ARCTIC_MIN_CAPACITY");
  }
});
