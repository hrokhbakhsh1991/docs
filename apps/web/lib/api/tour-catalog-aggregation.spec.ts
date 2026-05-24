import assert from "node:assert/strict";
import test from "node:test";

import { mergeResolvedGearIntoTour, mergeResolvedThemesIntoTour } from "./tour-catalog-aggregation";

test("mergeResolvedGearIntoTour assigns resolved names from catalog", () => {
  const tour: Record<string, unknown> = {
    details: {
      tripDetails: {
        participation: {
          gearRequiredIds: ["g1"],
          gearOptionalIds: ["g2"],
        },
      },
    },
  };

  mergeResolvedGearIntoTour(
    tour,
    [
      { id: "g1", name: "Boots" },
      { id: "g2", name: "Poles" },
    ],
    { tourId: "t1", catalog: "equipment" },
  );

  const resolved = (
    tour.details as { tripDetails: { participation: { resolvedGear: unknown } } }
  ).tripDetails.participation.resolvedGear as {
    required: { id: string; name: string }[];
    optional: { id: string; name: string }[];
  };

  assert.deepEqual(resolved.required, [{ id: "g1", name: "Boots" }]);
  assert.deepEqual(resolved.optional, [{ id: "g2", name: "Poles" }]);
});

test("mergeResolvedGearIntoTour falls back to id labels when catalog is unavailable", () => {
  const tour: Record<string, unknown> = {
    details: {
      tripDetails: {
        participation: { gearRequiredIds: ["g1"], gearOptionalIds: ["g2"] },
      },
    },
  };

  mergeResolvedGearIntoTour(tour, null, { tourId: "t1", catalog: "equipment" });

  const participation = (
    tour.details as { tripDetails: { participation: Record<string, unknown> } }
  ).tripDetails.participation;

  assert.deepEqual(participation.resolvedGear, {
    required: [{ id: "g1", name: "g1" }],
    optional: [{ id: "g2", name: "g2" }],
  });
});

test("mergeResolvedThemesIntoTour prefers catalog then snapshot labels", () => {
  const tour: Record<string, unknown> = {
    details: {
      tripDetails: {
        overview: {
          tourThemeIds: ["th1", "th2"],
          tourThemeLabels: { th2: "Snapshot name" },
        },
      },
    },
  };

  mergeResolvedThemesIntoTour(tour, [{ id: "th1", name: "Alpine" }], { tourId: "t1" });

  const overview = (
    (tour.details as Record<string, unknown>).tripDetails as {
      overview: { resolvedThemes: { id: string; name: string }[] };
    }
  ).overview;
  const resolved = overview.resolvedThemes;

  assert.deepEqual(resolved, [
    { id: "th1", name: "Alpine" },
    { id: "th2", name: "Snapshot name" },
  ]);
});
