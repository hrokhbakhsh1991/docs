import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "../schemas/denaliCore.schema";

import { denaliRuleSet } from "./denaliRuleModel";
import { isDenaliFieldVisibleOnStep } from "./denaliUIAdapter";
import { isDenaliMountaineeringTourType, isPeakExperienceVisible } from "./predicates";

const MIN_REQUIRED_PEAKS_PATH = "participantRequirements.minRequiredPeaks";
const PRICING_STEP = "denali_pricing" as const;

function formWith(
  tourType: string,
  requiresManualAdminApproval: boolean,
) {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = tourType as typeof form.basicInfo.tourType;
  form.basicInfo.requiresManualAdminApproval = requiresManualAdminApproval;
  return form;
}

test("isDenaliMountaineeringTourType matches mountain_day and mountain_multi only", () => {
  assert.equal(isDenaliMountaineeringTourType("mountain_day"), true);
  assert.equal(isDenaliMountaineeringTourType("mountain_multi"), true);
  assert.equal(isDenaliMountaineeringTourType("nature_day"), false);
  assert.equal(isDenaliMountaineeringTourType("event_reading"), false);
});

test("isPeakExperienceVisible requires mountaineering tour and manual admin approval", () => {
  assert.equal(isPeakExperienceVisible(formWith("mountain_day", true)), true);
  assert.equal(isPeakExperienceVisible(formWith("mountain_multi", true)), true);
  assert.equal(isPeakExperienceVisible(formWith("mountain_day", false)), false);
  assert.equal(isPeakExperienceVisible(formWith("nature_day", true)), false);
});

test("registry contextual visibility for minRequiredPeaks follows peak predicate", () => {
  const model = denaliRuleSet.mountain.single_day!;

  assert.equal(
    isDenaliFieldVisibleOnStep(model, PRICING_STEP, MIN_REQUIRED_PEAKS_PATH, formWith("mountain_day", true)),
    true,
  );
  assert.equal(
    isDenaliFieldVisibleOnStep(model, PRICING_STEP, MIN_REQUIRED_PEAKS_PATH, formWith("mountain_day", false)),
    false,
  );
  assert.equal(
    isDenaliFieldVisibleOnStep(model, PRICING_STEP, MIN_REQUIRED_PEAKS_PATH, formWith("nature_day", true)),
    false,
  );
});
