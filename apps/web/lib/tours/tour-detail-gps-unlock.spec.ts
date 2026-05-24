import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_DETAIL_GPS_UNLOCK_HOURS_BEFORE, computeTourDetailGpsViewHints } from "./tour-detail-gps-unlock";

test("computeTourDetailGpsViewHints unlocks 48h before departure", () => {
  const tour = {
    details: {
      tripDetails: {
        logistics: {
          departureDate: "2030-06-01",
          departureMeetingTime: "06:00",
        },
      },
    },
  };
  const beforeUnlock = new Date("2030-05-29T05:59:00.000Z");
  const hints = computeTourDetailGpsViewHints(tour, beforeUnlock);
  assert.equal(hints.gpsUnlocked, false);
  assert.ok(hints.gpsUnlockAt);

  const afterUnlock = new Date("2030-05-30T06:00:00.000Z");
  const unlocked = computeTourDetailGpsViewHints(tour, afterUnlock);
  assert.equal(unlocked.gpsUnlocked, true);
});

test("GPS unlock constant is 48 hours", () => {
  assert.equal(TOUR_DETAIL_GPS_UNLOCK_HOURS_BEFORE, 48);
});
