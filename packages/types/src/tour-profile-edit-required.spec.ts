import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_FORM_PROFILE_VALUES } from "./tour-form-profile";
import { getEditRequiredTripDetailsPathsForProfile } from "./tour-profile-edit-required";

test("mountain_outdoor: edit-required paths match descriptor required presets", () => {
  const paths = getEditRequiredTripDetailsPathsForProfile("mountain_outdoor");
  assert.deepEqual(paths, [
    "logistics.departureDate",
    "logistics.meetingPoint",
    "overview.difficultyLevel",
    "participation.gearRequiredIds",
    "participation.minimumAge",
  ]);
});

test("non-mountain profiles: no edit-required paths at publish", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    if (profile === "mountain_outdoor") continue;
    assert.deepEqual(
      getEditRequiredTripDetailsPathsForProfile(profile),
      [],
      `expected no edit-required paths for ${profile}`,
    );
  }
});
