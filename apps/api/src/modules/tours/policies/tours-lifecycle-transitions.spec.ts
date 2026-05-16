import assert from "node:assert/strict";
import test from "node:test";

import { BadRequestException } from "@nestjs/common";

import { TourDetails } from "../entities/tour-details.entity";
import { TourEntity, TourLifecycleStatus } from "../entities/tour.entity";
import {
  assertTourPublishableBeforePatch,
  assertTourStateReadyForOpenAfterPatch,
  assertTourStateReadyForOpenOnCreate,
} from "./assert-tour-publish-transition";
import {
  assertTourIsOpenForRegistration,
  assertTourOpenReadiness,
  assertValidLifecycleTransition,
} from "./tour-lifecycle.policy";

function draftTour(overrides: Partial<TourEntity> = {}): TourEntity {
  const tour = new TourEntity();
  tour.id = "00000000-0000-4000-8000-000000000001";
  tour.title = "1234567890ab";
  tour.totalCapacity = 10;
  tour.acceptedCount = 0;
  tour.lifecycleStatus = TourLifecycleStatus.DRAFT;
  tour.formProfileSnapshot = "general";
  Object.assign(tour, overrides);
  return tour;
}

const ALLOWED_TRANSITIONS: ReadonlyArray<[TourLifecycleStatus, TourLifecycleStatus]> = [
  [TourLifecycleStatus.DRAFT, TourLifecycleStatus.OPEN],
  [TourLifecycleStatus.DRAFT, TourLifecycleStatus.CANCELLED],
  [TourLifecycleStatus.OPEN, TourLifecycleStatus.CLOSED],
  [TourLifecycleStatus.OPEN, TourLifecycleStatus.CANCELLED],
  [TourLifecycleStatus.CLOSED, TourLifecycleStatus.CANCELLED],
];

const FORBIDDEN_TRANSITIONS: ReadonlyArray<[TourLifecycleStatus, TourLifecycleStatus]> = [
  [TourLifecycleStatus.OPEN, TourLifecycleStatus.DRAFT],
  [TourLifecycleStatus.CLOSED, TourLifecycleStatus.OPEN],
  [TourLifecycleStatus.CLOSED, TourLifecycleStatus.DRAFT],
  [TourLifecycleStatus.DRAFT, TourLifecycleStatus.CLOSED],
  [TourLifecycleStatus.CANCELLED, TourLifecycleStatus.OPEN],
];

for (const [from, to] of ALLOWED_TRANSITIONS) {
  test(`assertValidLifecycleTransition allows ${from} → ${to}`, () => {
    assert.doesNotThrow(() => assertValidLifecycleTransition(from, to));
  });
}

for (const [from, to] of FORBIDDEN_TRANSITIONS) {
  test(`assertValidLifecycleTransition rejects ${from} → ${to}`, () => {
    try {
      assertValidLifecycleTransition(from, to);
      assert.fail("expected BadRequestException");
    } catch (e: unknown) {
      assert.ok(e instanceof BadRequestException);
      const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
      assert.equal(body.error?.code, "INVALID_LIFECYCLE_TRANSITION");
    }
  });
}

test("assertValidLifecycleTransition: same state is no-op", () => {
  assert.doesNotThrow(() =>
    assertValidLifecycleTransition(TourLifecycleStatus.DRAFT, TourLifecycleStatus.DRAFT),
  );
});

test("assertTourOpenReadiness rejects empty title", () => {
  try {
    assertTourOpenReadiness({ title: "   ", totalCapacity: 10, details: null });
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "TOUR_NOT_PUBLISHABLE");
  }
});

test("assertTourOpenReadiness rejects non-positive capacity", () => {
  try {
    assertTourOpenReadiness({ title: "1234567890ab", totalCapacity: 0, details: null });
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "TOUR_NOT_PUBLISHABLE");
  }
});

test("T1 create→OPEN: assertTourStateReadyForOpenOnCreate does not require DRAFT lifecycle", () => {
  const openTour = draftTour({
    lifecycleStatus: TourLifecycleStatus.OPEN,
    formProfileSnapshot: "urban_event",
  });
  assert.doesNotThrow(() => assertTourStateReadyForOpenOnCreate("urban_event", openTour));
});

test("T1 PATCH→OPEN: assertTourPublishableBeforePatch requires DRAFT", () => {
  const openTour = draftTour({ lifecycleStatus: TourLifecycleStatus.OPEN });
  try {
    assertTourPublishableBeforePatch(openTour);
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { message?: string } };
    assert.match(body.error?.message ?? "", /Only draft tours can be published/);
  }
});

test("assertTourPublishableBeforePatch passes for ready DRAFT", () => {
  assert.doesNotThrow(() => assertTourPublishableBeforePatch(draftTour()));
});

test("assertTourStateReadyForOpenAfterPatch: urban_event title-only passes", () => {
  const tour = draftTour({ formProfileSnapshot: "urban_event" });
  assert.doesNotThrow(() => assertTourStateReadyForOpenAfterPatch("urban_event", tour));
});

test("assertTourStateReadyForOpenAfterPatch: mountain_outdoor missing edit-required fails", () => {
  const tour = draftTour({ formProfileSnapshot: "mountain_outdoor" });
  tour.costContext = { totalCost: 2_000_000 };
  tour.details = new TourDetails();
  tour.details.tripDetails = {
    schemaVersion: 1,
    overview: { difficultyLevel: 5 },
    participation: { minimumAge: 18 },
    logistics: {
      meetingPoint: "Camp",
      departureDate: "2026-07-01",
      primaryTransportMode: "bus",
    },
    itinerary: {
      segmentActivities: [{ dayNumber: 1, segments: [{ title: "leg" }] }],
    },
  } as TourDetails["tripDetails"];
  try {
    assertTourStateReadyForOpenAfterPatch("mountain_outdoor", tour);
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "VALIDATION_PROFILE_EDIT_REQUIRED_FIELD");
  }
});

test("assertTourStateReadyForOpenAfterPatch: general missing submit fields fails", () => {
  const tour = draftTour({ formProfileSnapshot: "general" });
  try {
    assertTourStateReadyForOpenAfterPatch("general", tour);
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "VALIDATION_PROFILE_REQUIRED_FIELD");
  }
});

test("assertTourStateReadyForOpenAfterPatch: general with tripDetails subset passes", () => {
  const tour = draftTour({ formProfileSnapshot: "general" });
  tour.costContext = { totalCost: 1_000_000 };
  tour.details = new TourDetails();
  tour.details.tripDetails = {
    schemaVersion: 1,
    logistics: { primaryTransportMode: "bus" },
    itinerary: {
      segmentActivities: [{ dayNumber: 1, segments: [{ title: "leg" }] }],
    },
  } as TourDetails["tripDetails"];
  assert.doesNotThrow(() => assertTourStateReadyForOpenAfterPatch("general", tour));
});

test("assertTourIsOpenForRegistration: OPEN allowed, DRAFT rejected", () => {
  assert.doesNotThrow(() =>
    assertTourIsOpenForRegistration(draftTour({ lifecycleStatus: TourLifecycleStatus.OPEN })),
  );
  try {
    assertTourIsOpenForRegistration(draftTour());
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "TOUR_NOT_OPEN");
  }
});

test("PATCH→OPEN matrix: DRAFT tour with zero capacity fails post-merge publish gate", () => {
  const tour = draftTour({ totalCapacity: 0, formProfileSnapshot: "urban_event" });
  try {
    assertTourStateReadyForOpenAfterPatch("urban_event", tour);
    assert.fail("expected BadRequestException");
  } catch (e: unknown) {
    assert.ok(e instanceof BadRequestException);
    const body = (e as BadRequestException).getResponse() as { error?: { code?: string } };
    assert.equal(body.error?.code, "TOUR_NOT_PUBLISHABLE");
  }
});
