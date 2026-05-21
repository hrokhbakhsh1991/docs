import assert from "node:assert/strict";
import test from "node:test";

import { isDenaliAltitudeVisibleForThemeProfile } from "./denaliAltitudeVisibility";

test("isDenaliAltitudeVisibleForThemeProfile: mountain category + mountain_outdoor", () => {
  assert.equal(isDenaliAltitudeVisibleForThemeProfile("mountain_outdoor", "mountain"), true);
});

test("isDenaliAltitudeVisibleForThemeProfile: mountain category shows altitude regardless of theme profile", () => {
  assert.equal(isDenaliAltitudeVisibleForThemeProfile("nature_trip", "mountain"), true);
});

test("isDenaliAltitudeVisibleForThemeProfile: nature category always hidden", () => {
  assert.equal(isDenaliAltitudeVisibleForThemeProfile("nature_trip", "nature"), false);
  assert.equal(isDenaliAltitudeVisibleForThemeProfile("mountain_outdoor", "nature"), false);
});
