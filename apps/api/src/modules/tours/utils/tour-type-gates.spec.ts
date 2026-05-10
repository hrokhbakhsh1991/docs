import assert from "node:assert/strict";
import test from "node:test";

import type { TourTripDetails } from "../types/tour-trip-details.types";

import { applyTourTypeFieldGates } from "./tour-type-gates";

test("applyTourTypeFieldGates keeps mountain-only fields for mountain tours", () => {
  const baseTripDetails: TourTripDetails = {
    overview: { maxAltitudeMeters: 5000 },
  };
  const out = applyTourTypeFieldGates(baseTripDetails, "mountain");
  assert.equal(out!.overview!.maxAltitudeMeters, 5000);
});

test("applyTourTypeFieldGates strips maxAltitudeMeters for non-mountain tours", () => {
  const baseTripDetails: TourTripDetails = {
    overview: { maxAltitudeMeters: 5000 },
  };
  for (const kind of ["city", "desert", "nature", "cultural"] as const) {
    const out = applyTourTypeFieldGates(baseTripDetails, kind);
    assert.strictEqual(out!.overview, undefined);
  }
});

test("applyTourTypeFieldGates is a no-op for null/undefined inputs", () => {
  assert.equal(applyTourTypeFieldGates(null, "city"), null);
  assert.equal(applyTourTypeFieldGates(undefined, "city"), undefined);
});

test("applyTourTypeFieldGates is a no-op when no mountain-only fields are present", () => {
  const td: TourTripDetails = { overview: { mainDestination: "X" } };
  const out = applyTourTypeFieldGates(td, "city");
  assert.deepEqual(out, td);
});

test("applyTourTypeFieldGates leaves overview undefined when only mountain-only field was present", () => {
  const td: TourTripDetails = {
    overview: { maxAltitudeMeters: 5000 },
  };
  const out = applyTourTypeFieldGates(td, "desert");
  assert.equal(out!.overview, undefined);
});

test("applyTourTypeFieldGates does not mutate the input object", () => {
  const td: TourTripDetails = {
    overview: { maxAltitudeMeters: 5000 },
  };
  applyTourTypeFieldGates(td, "city");
  assert.equal(td.overview!.maxAltitudeMeters, 5000);
});

test("applyTourTypeFieldGates treats null/undefined tourType as non-mountain (strips field)", () => {
  const baseTripDetails: TourTripDetails = {
    overview: { maxAltitudeMeters: 5000 },
  };
  const out = applyTourTypeFieldGates(baseTripDetails, null);
  assert.equal(out!.overview, undefined);
});
