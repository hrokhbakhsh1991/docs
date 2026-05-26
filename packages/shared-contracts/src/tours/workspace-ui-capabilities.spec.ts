import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_FORM_PROFILE_VALUES } from "@repo/types";

import { getWorkspaceUiCapabilityFlags } from "./workspace-ui-capabilities";

test("only denali_pilot requires geo publish and single-day logistics strip", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const flags = getWorkspaceUiCapabilityFlags(profile);
    if (profile === "denali_pilot") {
      assert.equal(flags.requiresGeoPublish, true);
      assert.equal(flags.appliesDenaliSingleDayLogisticsStrip, true);
    } else {
      assert.equal(flags.requiresGeoPublish, false, profile);
      assert.equal(flags.appliesDenaliSingleDayLogisticsStrip, false, profile);
    }
  }
});

test("allowsPeakExperience only for mountain_outdoor and denali_pilot", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const flags = getWorkspaceUiCapabilityFlags(profile);
    const expected = profile === "mountain_outdoor" || profile === "denali_pilot";
    assert.equal(flags.allowsPeakExperience, expected, profile);
  }
});

test("denaliThemeCategories match Denali wizard theme filter table", () => {
  const mountain = getWorkspaceUiCapabilityFlags("mountain_outdoor").denaliThemeCategories;
  assert.deepEqual(mountain, ["mountain"]);

  const nature = getWorkspaceUiCapabilityFlags("nature_trip").denaliThemeCategories;
  assert.deepEqual(nature, ["nature", "desert"]);

  const denali = getWorkspaceUiCapabilityFlags("denali_pilot").denaliThemeCategories;
  assert.deepEqual(denali, ["mountain", "nature", "desert"]);

  for (const profile of ["urban_event", "cinema_event", "cultural_tour"] as const) {
    assert.deepEqual(getWorkspaceUiCapabilityFlags(profile).denaliThemeCategories, ["event"], profile);
  }

  assert.deepEqual(getWorkspaceUiCapabilityFlags("general").denaliThemeCategories, []);
});

test("denali_pilot exposes default service catalog; other profiles have none", () => {
  const denali = getWorkspaceUiCapabilityFlags("denali_pilot");
  assert.equal(denali.availableServices.length, 2);
  assert.deepEqual(denali.availableServices.map((s) => s.id), ["breakfast", "nissan"]);

  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    if (profile === "denali_pilot") {
      continue;
    }
    assert.equal(
      getWorkspaceUiCapabilityFlags(profile).availableServices.length,
      0,
      profile,
    );
  }
});
