import test from "node:test";
import assert from "node:assert/strict";

import type { TourTripDetails } from "./tourTripDetails.schema";
import { compactTripDetailsForApi, TourTripDetailsSchema } from "./tourTripDetails.schema";

/** Valid v4 UUID for fixture tour theme ids. */
const THEME_ID_FIXTURE = "22222222-2222-4222-8222-222222222222";

test("compactTripDetailsForApi returns undefined for empty / whitespace-only payload", () => {
  assert.equal(compactTripDetailsForApi(undefined), undefined);
  assert.equal(compactTripDetailsForApi({} as TourTripDetails), undefined);
  assert.equal(
    compactTripDetailsForApi({
      overview: { mainDestination: "   " },
    } as TourTripDetails),
    undefined,
  );
});

test("compactTripDetailsForApi trims strings, filters empty list entries, and keeps enums", () => {
  const out = compactTripDetailsForApi({
    overview: {
      mainDestination: "  Damavand  ",
      tourThemeIds: [THEME_ID_FIXTURE],
      tourThemeLabels: { [THEME_ID_FIXTURE]: "Photography trips" },
      tripStyles: ["adventure", "photography"],
    },
    itinerary: {
      highlights: ["sunrise", "  "],
      dayPlans: [
        { day: 1, title: " Hike ", distanceKm: 8, elevationGainM: 100 },
        { day: Number.NaN, title: "x" } as never,
        { day: 2 },
      ],
    },
  } as unknown as TourTripDetails);
  assert.deepEqual(out, {
    overview: {
      mainDestination: "Damavand",
      tourThemeIds: [THEME_ID_FIXTURE],
      tourThemeLabels: { [THEME_ID_FIXTURE]: "Photography trips" },
      tripStyles: ["adventure", "photography"],
    },
    itinerary: {
      highlights: ["sunrise"],
      dayPlans: [{ day: 1, title: "Hike", distanceKm: 8, elevationGainM: 100 }, { day: 2 }],
    },
  });
});

test("compactTripDetailsForApi drops dayPlans rows without a valid day", () => {
  const out = compactTripDetailsForApi({
    itinerary: {
      dayPlans: [{ title: "Only title" } as never],
    },
  } as unknown as TourTripDetails);
  assert.equal(out, undefined);
});

test("audience overlap → error on tripDetails.participation.notSuitableFor", () => {
  const result = TourTripDetailsSchema.safeParse({
    participation: { suitableFor: ["kids"], notSuitableFor: ["kids"] },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const hasPath = result.error.issues.some(
    (issue) => issue.path.join(".") === "participation.notSuitableFor",
  );
  assert.equal(hasPath, true);
});

test("shortIntro over 250 characters fails", () => {
  const result = TourTripDetailsSchema.safeParse({
    overview: { shortIntro: "x".repeat(251) },
  });
  assert.equal(result.success, false);
});

test("compactTripDetailsForApi drops deprecated overview.bestFor", () => {
  const raw = {
    overview: { bestFor: ["legacy"], shortIntro: "ok" },
  } as unknown as TourTripDetails;
  const out = compactTripDetailsForApi(raw);
  assert.ok(out && typeof out.overview === "object" && out.overview !== null);
  assert.equal("bestFor" in (out!.overview as Record<string, unknown>), false);
  assert.equal((out!.overview as Record<string, unknown>).shortIntro, "ok");
});
