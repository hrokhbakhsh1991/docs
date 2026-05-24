import test from "node:test";
import assert from "node:assert/strict";

import { BadRequestException } from "@nestjs/common";

import { TOUR_FORM_PROFILE_VALUES, type TourFormProfile } from "@repo/types";

import type { CreateTourDto } from "../dto/create-tour.dto";
import { TourEntity, TourLifecycleStatus } from "../entities/tour.entity";
import { TourDetails } from "../entities/tour-details.entity";
import {
  VALIDATION_PROFILE_REQUIRED_FIELD,
  assertProfileRequiredFieldsForPublish,
  assertProfileRequiredFieldsForSubmit,
  tourEntityToProfileRequiredSubmitShape,
} from "./assert-profile-required-fields-for-submit";

function minimalDto(overrides: Partial<CreateTourDto> = {}): CreateTourDto {
  return {
    title: "1234567890ab",
    total_capacity: 10,
    lifecycle_status: TourLifecycleStatus.DRAFT,
    ...overrides,
  };
}

function expectRequiredFieldError(
  fn: () => void,
  expectedFields: readonly string[],
): void {
  try {
    fn();
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as {
      error?: { code?: string; fields?: string[] };
    };
    assert.equal(body.error?.code, VALIDATION_PROFILE_REQUIRED_FIELD);
    assert.deepEqual([...(body.error?.fields ?? [])].sort(), [...expectedFields].sort());
  }
}

test("passes when all submit-required fields are present for general", () => {
  assert.doesNotThrow(() =>
    assertProfileRequiredFieldsForSubmit(
      "general",
      minimalDto({
        cost_context: { totalCost: 1_000_000 },
        tripDetails: {
          itinerary: {
            segmentActivities: [{ dayNumber: 1, segments: [{ title: "leg" }] }],
          },
          logistics: { primaryTransportMode: "bus" },
        },
      } as CreateTourDto),
    ),
  );
});

const PROFILE_INVALID_PAYLOADS: ReadonlyArray<{
  profile: TourFormProfile;
  label: string;
  dto: CreateTourDto;
  expectedFields: readonly string[];
}> = [
  {
    profile: "general",
    label: "title only",
    dto: minimalDto(),
    expectedFields: ["itinerary.days", "logistics.primaryTransportMode", "pricing.basePrice"],
  },
  {
    profile: "mountain_outdoor",
    label: "title only",
    dto: minimalDto(),
    expectedFields: ["itinerary.days", "logistics.primaryTransportMode", "pricing.basePrice"],
  },
  {
    profile: "nature_trip",
    label: "title only",
    dto: minimalDto(),
    expectedFields: ["itinerary.days", "logistics.primaryTransportMode", "pricing.basePrice"],
  },
  {
    profile: "cultural_tour",
    label: "title only",
    dto: minimalDto(),
    expectedFields: ["itinerary.days", "logistics.primaryTransportMode", "pricing.basePrice"],
  },
  {
    profile: "urban_event",
    label: "empty title",
    dto: minimalDto({ title: "   " }),
    expectedFields: ["overview.title"],
  },
  {
    profile: "cinema_event",
    label: "title without transport",
    dto: minimalDto({
      cost_context: { totalCost: 500_000 },
      tripDetails: {
        itinerary: { highlights: ["show"] },
        logistics: {},
      },
    } as CreateTourDto),
    expectedFields: ["logistics.primaryTransportMode"],
  },
];

for (const { profile, label, dto, expectedFields } of PROFILE_INVALID_PAYLOADS) {
  test(`contract: ${profile} — ${label} → 400 ${VALIDATION_PROFILE_REQUIRED_FIELD}`, () => {
    expectRequiredFieldError(
      () => assertProfileRequiredFieldsForSubmit(profile, dto),
      expectedFields,
    );
  });
}

test("urban_event: title-only payload passes submit-required assert", () => {
  assert.doesNotThrow(() =>
    assertProfileRequiredFieldsForSubmit("urban_event", minimalDto()),
  );
});

test("cinema_event: full required subset passes", () => {
  assert.doesNotThrow(() =>
    assertProfileRequiredFieldsForSubmit(
      "cinema_event",
      minimalDto({
        tripDetails: {
          logistics: { primaryTransportMode: "bus" },
        },
      } as CreateTourDto),
    ),
  );
});

test("denali_pilot: empty primaryTransportMode with empty transportModes passes submit gate", () => {
  assert.doesNotThrow(() =>
    assertProfileRequiredFieldsForSubmit(
      "denali_pilot",
      minimalDto({
        cost_context: { totalCost: 500_000 },
        transportModes: [],
        tripDetails: {
          itinerary: {
            segmentActivities: [{ dayNumber: 1, segments: [{ title: "leg" }] }],
          },
          logistics: {},
        },
      } as CreateTourDto),
    ),
  );
});

test("tourEntityToProfileRequiredSubmitShape maps title, cost, and tripDetails", () => {
  const tour = new TourEntity();
  tour.title = "1234567890ab";
  tour.totalCapacity = 10;
  tour.lifecycleStatus = TourLifecycleStatus.DRAFT;
  tour.costContext = { currency: "IRR", totalCost: 2_000_000 };
  tour.details = new TourDetails();
  tour.details.tripDetails = {
    schemaVersion: 1,
    logistics: { primaryTransportMode: "bus" },
    itinerary: {
      segmentActivities: [{ dayNumber: 1, segments: [{ title: "leg" }] }],
    },
  } as TourDetails["tripDetails"];

  const shape = tourEntityToProfileRequiredSubmitShape(tour);
  assert.equal(shape.title, tour.title);
  assert.equal(shape.cost_context?.totalCost, 2_000_000);
  assert.equal(shape.tripDetails?.logistics?.primaryTransportMode, "bus");
});

test("assertProfileRequiredFieldsForPublish rejects incomplete general tour entity", () => {
  const tour = new TourEntity();
  tour.title = "1234567890ab";
  tour.totalCapacity = 10;
  tour.lifecycleStatus = TourLifecycleStatus.DRAFT;
  tour.formProfileSnapshot = "general";

  expectRequiredFieldError(
    () =>
      assertProfileRequiredFieldsForPublish(
        "general",
        tourEntityToProfileRequiredSubmitShape(tour),
      ),
    ["itinerary.days", "logistics.primaryTransportMode", "pricing.basePrice"],
  );
});

test("assertProfileRequiredFieldsForPublish passes urban_event with title only on entity", () => {
  const tour = new TourEntity();
  tour.title = "1234567890ab";
  tour.totalCapacity = 10;
  tour.lifecycleStatus = TourLifecycleStatus.DRAFT;
  tour.formProfileSnapshot = "urban_event";

  assert.doesNotThrow(() =>
    assertProfileRequiredFieldsForPublish(
      "urban_event",
      tourEntityToProfileRequiredSubmitShape(tour),
    ),
  );
});

test("error code is stable across profiles", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    try {
      assertProfileRequiredFieldsForSubmit(profile, minimalDto({ title: "" }));
    } catch (e: unknown) {
      if (profile === "urban_event") {
        assert.ok(e instanceof BadRequestException);
        const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
        assert.equal(body.error?.code, VALIDATION_PROFILE_REQUIRED_FIELD);
      }
    }
  }
});
