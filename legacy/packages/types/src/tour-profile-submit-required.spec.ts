import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { TOUR_FORM_PROFILE_VALUES } from "./tour-form-profile";
import {
  WIZARD_SUBMIT_REQUIRED_FIELD_PATHS,
  getRequiredSubmitFieldPathsForProfile,
} from "./tour-profile-submit-required";

describe("tour-profile-submit-required", () => {
  it("declares exactly four canonical submit-required paths", () => {
    assert.equal(WIZARD_SUBMIT_REQUIRED_FIELD_PATHS.length, 4);
  });

  it("general: all four paths required at submit", () => {
    assert.deepEqual(getRequiredSubmitFieldPathsForProfile("general"), [
      "overview.title",
      "pricing.basePrice",
      "itinerary.days",
      "logistics.primaryTransportMode",
    ]);
  });

  it("urban_event: only overview.title", () => {
    assert.deepEqual(getRequiredSubmitFieldPathsForProfile("urban_event"), ["overview.title"]);
  });

  it("cinema_event: title + primary transport", () => {
    assert.deepEqual(getRequiredSubmitFieldPathsForProfile("cinema_event"), [
      "overview.title",
      "logistics.primaryTransportMode",
    ]);
  });

  it("mountain_outdoor, nature_trip, cultural_tour match general", () => {
    const general = [...getRequiredSubmitFieldPathsForProfile("general")];
    for (const profile of ["mountain_outdoor", "nature_trip", "cultural_tour"] as const) {
      assert.deepEqual([...getRequiredSubmitFieldPathsForProfile(profile)], general, profile);
    }
  });

  it("every profile returns a sorted subset of canonical paths", () => {
    const canonical = new Set<string>(WIZARD_SUBMIT_REQUIRED_FIELD_PATHS);
    for (const profile of TOUR_FORM_PROFILE_VALUES) {
      const paths = getRequiredSubmitFieldPathsForProfile(profile);
      for (const p of paths) {
        assert.ok(canonical.has(p), `${profile}: unexpected path ${p}`);
      }
    }
  });
});
