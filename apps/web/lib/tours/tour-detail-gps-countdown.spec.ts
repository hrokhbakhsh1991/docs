import assert from "node:assert/strict";
import test from "node:test";

import {
  formatGpsUnlockCountdown,
  isGpsUnlockPending,
} from "./tour-detail-gps-countdown";

test("formatGpsUnlockCountdown returns null when unlock is in the past", () => {
  const unlockAt = "2020-01-01T12:00:00.000Z";
  const now = new Date("2026-01-01T00:00:00.000Z");
  assert.equal(formatGpsUnlockCountdown(unlockAt, now, "en"), null);
  assert.equal(isGpsUnlockPending(unlockAt, now), false);
});

test("formatGpsUnlockCountdown returns relative label when unlock is in the future", () => {
  const now = new Date("2026-05-20T12:00:00.000Z");
  const unlockAt = "2026-05-22T12:00:00.000Z";
  const label = formatGpsUnlockCountdown(unlockAt, now, "en");
  assert.ok(label);
  assert.match(label!, /day/i);
  assert.equal(isGpsUnlockPending(unlockAt, now), true);
});

test("formatGpsUnlockCountdown uses hours for same-day unlock", () => {
  const now = new Date("2026-05-22T06:00:00.000Z");
  const unlockAt = "2026-05-22T12:00:00.000Z";
  const label = formatGpsUnlockCountdown(unlockAt, now, "en");
  assert.ok(label);
  assert.match(label!, /hour/i);
});
