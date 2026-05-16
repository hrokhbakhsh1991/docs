import assert from "node:assert/strict";
import test from "node:test";

import { BadRequestException } from "@nestjs/common";

import { TourDetails } from "../entities/tour-details.entity";
import { TourEntity, TourLifecycleStatus } from "../entities/tour.entity";
import {
  VALIDATION_PROFILE_EDIT_REQUIRED_FIELD,
  assertEditRequiredTripDetailsForPublish,
} from "./assert-edit-required-trip-details-for-publish";

test("mountain_outdoor: passes when all edit-required tripDetails fields are set", () => {
  assert.doesNotThrow(() =>
    assertEditRequiredTripDetailsForPublish("mountain_outdoor", {
      overview: { difficultyLevel: 5 },
      participation: { minimumAge: 18, gearRequiredIds: ["00000000-0000-4000-8000-000000000099"] },
      logistics: {
        meetingPoint: "Tehran",
        departureDate: "2026-08-01",
      },
    }),
  );
});

test("mountain_outdoor: missing departureDate → VALIDATION_PROFILE_EDIT_REQUIRED_FIELD", () => {
  try {
    assertEditRequiredTripDetailsForPublish("mountain_outdoor", {
      overview: { difficultyLevel: 5 },
      participation: { minimumAge: 18, gearRequiredIds: ["id"] },
      logistics: { meetingPoint: "Tehran" },
    });
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as {
      error?: { code?: string; fields?: string[] };
    };
    assert.equal(body.error?.code, VALIDATION_PROFILE_EDIT_REQUIRED_FIELD);
    assert.ok(body.error?.fields?.includes("logistics.departureDate"));
  }
});

test("urban_event: no edit-required enforcement", () => {
  assert.doesNotThrow(() =>
    assertEditRequiredTripDetailsForPublish("urban_event", {}),
  );
});

test("integration: publish gate on entity missing gearRequiredIds", () => {
  const tour = new TourEntity();
  tour.title = "1234567890ab";
  tour.totalCapacity = 10;
  tour.lifecycleStatus = TourLifecycleStatus.DRAFT;
  tour.formProfileSnapshot = "mountain_outdoor";
  tour.details = new TourDetails();
  tour.details.tripDetails = {
    schemaVersion: 1,
    overview: { difficultyLevel: 3 },
    participation: { minimumAge: 21 },
    logistics: { meetingPoint: "Base", departureDate: "2026-09-01" },
  } as TourDetails["tripDetails"];

  try {
    assertEditRequiredTripDetailsForPublish(
      "mountain_outdoor",
      tour.details.tripDetails as Record<string, unknown>,
    );
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { fields?: string[] } };
    assert.ok(body.error?.fields?.includes("participation.gearRequiredIds"));
  }
});
