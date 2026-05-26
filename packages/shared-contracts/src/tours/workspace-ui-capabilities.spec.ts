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
