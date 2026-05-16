import test from "node:test";
import assert from "node:assert/strict";

import { BadRequestException } from "@nestjs/common";

import { TourLifecycleStatus } from "../entities/tour.entity";
import type { CreateTourDto } from "../dto/create-tour.dto";
import {
  assertCreateTourInvariants,
  assertIncomingCreateTourDtoBeforeFormProfileStrip,
  assertIncomingTripDetailsPatchFragmentBeforeFormProfileStrip,
  assertTripDetailsForFormProfile,
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
