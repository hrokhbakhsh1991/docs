import test from "node:test";
import assert from "node:assert/strict";

import {
  TOUR_DURATION_DAYS_MAX,
  TOUR_DURATION_DAYS_MIN,
  computeTourDurationDays,
} from "./tour-duration";

test("computeTourDurationDays returns 1 when departure equals return (inclusive)", () => {
  assert.equal(computeTourDurationDays("2099-05-01", "2099-05-01"), 1);
});

test("computeTourDurationDays counts inclusive day span across months", () => {
  assert.equal(computeTourDurationDays("2099-04-29", "2099-05-02"), 4);
});

test("computeTourDurationDays returns undefined for non-string inputs", () => {
  assert.equal(computeTourDurationDays(undefined, undefined), undefined);
  assert.equal(computeTourDurationDays("2099-05-01", undefined), undefined);
  assert.equal(computeTourDurationDays(undefined, "2099-05-01"), undefined);
});

test("computeTourDurationDays rejects malformed YMD", () => {
  assert.equal(computeTourDurationDays("2099-5-1", "2099-05-02"), undefined);
  assert.equal(computeTourDurationDays("not-a-date", "2099-05-02"), undefined);
});

test("computeTourDurationDays rejects return before departure", () => {
  assert.equal(computeTourDurationDays("2099-05-10", "2099-05-09"), undefined);
});

test("computeTourDurationDays rejects spans outside [1, 60]", () => {
  assert.equal(computeTourDurationDays("2099-05-01", "2099-08-01"), undefined);
  assert.equal(TOUR_DURATION_DAYS_MIN, 1);
  assert.equal(TOUR_DURATION_DAYS_MAX, 60);
});

test("computeTourDurationDays accepts the 60-day upper bound", () => {
  assert.equal(computeTourDurationDays("2099-05-01", "2099-06-29"), 60);
});
