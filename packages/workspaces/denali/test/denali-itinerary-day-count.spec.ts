import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { countInclusiveLocalCalendarDays } from "../src/adapters/denaliDatetime";
import { computeDenaliTourDayCount } from "../src/adapters/denaliItinerarySync";
import { estimateDenaliTourDayCount } from "../src/ui/logic/denali-photo-types";

const PHOTOS_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/ui/fields/denali-photos-field.tsx"),
  "utf8"
);
const ITINERARY_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/ui/fields/denali-itinerary-field.tsx"),
  "utf8"
);

describe("denali-itinerary-day-count.spec.ts", () => {
  const start = new Date(2026, 5, 15, 8, 0, 0).toISOString();
  const sameDayLater = new Date(2026, 5, 15, 18, 0, 0).toISOString();
  const nextDay = new Date(2026, 5, 16, 18, 0, 0).toISOString();
  const twoDaysLater = new Date(2026, 5, 17, 18, 0, 0).toISOString();
  const previousDay = new Date(2026, 5, 14, 18, 0, 0).toISOString();

  it("DN-MULTI-CAL-01 same local YMD counts as one day (no min-2 clamp)", () => {
    assert.equal(countInclusiveLocalCalendarDays(start, sameDayLater), 1);
    assert.equal(estimateDenaliTourDayCount(start, sameDayLater), 1);
    assert.equal(computeDenaliTourDayCount(start, sameDayLater, true), 1);
    assert.equal(computeDenaliTourDayCount(start, sameDayLater, false), 1);
  });

  it("DN-MULTI-CAL-02 next local calendar day counts as two", () => {
    assert.equal(countInclusiveLocalCalendarDays(start, nextDay), 2);
    assert.equal(estimateDenaliTourDayCount(start, nextDay), 2);
    assert.equal(computeDenaliTourDayCount(start, nextDay, true), 2);
    assert.equal(countInclusiveLocalCalendarDays(start, twoDaysLater), 3);
  });

  it("DN-MULTI-CAL-03 inverted or empty range is undefined (estimate) / 1 (sync fallback)", () => {
    assert.equal(countInclusiveLocalCalendarDays(start, previousDay), undefined);
    assert.equal(estimateDenaliTourDayCount(start, previousDay), undefined);
    assert.equal(estimateDenaliTourDayCount(start, ""), undefined);
    assert.equal(computeDenaliTourDayCount(start, previousDay, true), 1);
  });

  it("DN-MULTI-CAL-04 itinerary row count is not a day (photos/itinerary size from calendar)", () => {
    assert.equal(/itinerary\.length\s*>=\s*2/.test(PHOTOS_SRC), false);
    assert.match(PHOTOS_SRC, /estimateDenaliTourDayCount/);
    assert.equal(/Math\.max\(stored\.length,\s*2\)/.test(ITINERARY_SRC), false);
  });
});
