import assert from "node:assert/strict";
import test from "node:test";

import type { TourFormProfile } from "@repo/types";

import type { TourTripDetails } from "../types/tour-trip-details.types";

import { applyMountainOverviewFieldGatesForFormProfile } from "./tour-type-gates";

const NON_MOUNTAIN_PROFILES: readonly TourFormProfile[] = [
  "general",
  "urban_event",
  "nature_trip",
  "cultural_tour",
  "cinema_event",
];

test("applyMountainOverviewFieldGatesForFormProfile keeps maxAltitudeMeters for mountain_outdoor", () => {
  const td: TourTripDetails = { overview: { maxAltitudeMeters: 5000 } };
  const out = applyMountainOverviewFieldGatesForFormProfile("mountain_outdoor", td);
  assert.equal(out!.overview!.maxAltitudeMeters, 5000);
});

test("applyMountainOverviewFieldGatesForFormProfile strips maxAltitudeMeters for non-mountain profiles", () => {
  for (const profile of NON_MOUNTAIN_PROFILES) {
    const td: TourTripDetails = { overview: { maxAltitudeMeters: 5000 } };
    const out = applyMountainOverviewFieldGatesForFormProfile(profile, td);
    assert.strictEqual(out!.overview, undefined, `profile ${profile}: expected overview to be stripped`);
  }
});

test("applyMountainOverviewFieldGatesForFormProfile is a no-op for null / undefined inputs", () => {
  assert.equal(applyMountainOverviewFieldGatesForFormProfile("urban_event", null), null);
  assert.equal(applyMountainOverviewFieldGatesForFormProfile("urban_event", undefined), undefined);
});

test("applyMountainOverviewFieldGatesForFormProfile is a no-op when no mountain-only fields are present", () => {
  const td: TourTripDetails = { overview: { mainDestination: "X" } };
  const out = applyMountainOverviewFieldGatesForFormProfile("urban_event", td);
  assert.deepEqual(out, td);
});

test("applyMountainOverviewFieldGatesForFormProfile leaves overview undefined when only mountain-only field was present", () => {
  const td: TourTripDetails = { overview: { maxAltitudeMeters: 5000 } };
  const out = applyMountainOverviewFieldGatesForFormProfile("nature_trip", td);
  assert.equal(out!.overview, undefined);
});

test("applyMountainOverviewFieldGatesForFormProfile does not mutate the input object", () => {
  const td: TourTripDetails = { overview: { maxAltitudeMeters: 5000 } };
  applyMountainOverviewFieldGatesForFormProfile("urban_event", td);
  assert.equal(td.overview!.maxAltitudeMeters, 5000);
});
