import assert from "node:assert/strict";
import test from "node:test";

import {
  computeDenaliTourDayCount,
  syncDenaliItineraryRows,
} from "./denaliItinerarySync";

test("computeDenaliTourDayCount: inclusive calendar days for multi-day", () => {
  assert.equal(
    computeDenaliTourDayCount("2026-06-01T08:00:00.000Z", "2026-06-03T08:00:00.000Z", true),
    3,
  );
});

test("syncDenaliItineraryRows trims extra days and preserves text", () => {
  const synced = syncDenaliItineraryRows(
    [
      { day: 1, activities: "روز اول" },
      { day: 2, activities: "روز دوم" },
      { day: 3, activities: "روز سوم" },
    ],
    2,
  );
  assert.equal(synced.length, 2);
  assert.equal(synced[0]!.activities, "روز اول");
  assert.equal(synced[1]!.activities, "روز دوم");
});

test("syncDenaliItineraryRows preserves location and photos per day", () => {
  const photo = {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    url: "https://example.com/p.jpg",
    filename: "p.jpg",
  };
  const synced = syncDenaliItineraryRows(
    [
      {
        day: 1,
        activities: "a",
        locationText: "Camp A",
        location: { addressText: "Camp A", latitude: 35.7, longitude: 52.1 },
        photos: [photo],
      },
      { day: 2, activities: "b", locationText: "Camp B" },
    ],
    2,
  );
  assert.equal(synced[0]!.locationText, "Camp A");
  assert.equal(synced[0]!.location?.latitude, 35.7);
  assert.deepEqual(synced[0]!.photos, [photo]);
  assert.equal(synced[1]!.locationText, "Camp B");
  assert.equal(synced[1]!.photos, undefined);
});
