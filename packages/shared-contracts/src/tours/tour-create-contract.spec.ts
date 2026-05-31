import test from "node:test";
import assert from "node:assert/strict";

import { compactTripDetailsForApi } from "./compact-trip-details-for-api";
import { tourCreatePostContractSchema } from "./tour-create-contract";
import { tourTripDetailsWireSchema } from "./tour-trip-details-wire.schema";

test("tourCreatePostContractSchema rejects unknown root keys", () => {
  const result = tourCreatePostContractSchema.safeParse({
    title: "Valid tour title here",
    total_capacity: 10,
    lifecycle_status: "Draft",
    ghostField: true,
  });
  assert.equal(result.success, false);
});

test("tourCreatePostContractSchema rejects invalid nested tripDetails logistics enum", () => {
  const result = tourCreatePostContractSchema.safeParse({
    title: "Valid tour title here",
    total_capacity: 10,
    lifecycle_status: "Draft",
    tripDetails: {
      logistics: {
        mealPlan: "not_a_real_plan",
      },
    },
  });
  assert.equal(result.success, false);
});

test("tourCreatePostContractSchema accepts structured tripDetails baseline", () => {
  const result = tourCreatePostContractSchema.safeParse({
    title: "Valid tour title here",
    total_capacity: 10,
    lifecycle_status: "Draft",
    tripDetails: {
      overview: {
        shortIntro: "Short teaser",
        tripStyles: ["adventure"],
      },
      logistics: {
        departureDate: "2026-06-01",
        returnDate: "2026-06-03",
        accommodationTypes: ["hotel"],
        mealPlan: "breakfast",
      },
      participation: {
        suitableFor: ["families"],
      },
      itinerary: {
        dayPlans: [{ day: 1, title: "Day one" }],
      },
    },
  });
  assert.equal(result.success, true);
});

test("compactTripDetailsForApi normalizes accommodationTypes and validates wire schema", () => {
  const out = compactTripDetailsForApi({
    logistics: {
      accommodationTypes: [" Hotel ", "hotel"],
      mealPlan: "breakfast",
    },
  });
  assert.deepEqual(out?.logistics?.accommodationTypes, ["hotel"]);
  assert.equal(tourTripDetailsWireSchema.safeParse(out).success, true);
});

test("compactTripDetailsForApi throws on structurally invalid nested payload", () => {
  assert.throws(
    () =>
      compactTripDetailsForApi({
        overview: { tripStyles: ["not_a_valid_style"] },
      }),
    /wire contract violation/,
  );
});
