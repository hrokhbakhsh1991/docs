import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { getDenaliWizardStepIssues } from "@/features/tours/wizard/schemas/denaliTourCreateValidation";

import { applyDenaliInvariantState } from "../../validation/denaliInvariantEngine";

test("DenaliBasicInfoStep navigation: clear hidden fields when moving forward", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.endDateTime = "2026-06-03T18:00:00.000Z";

  const safe = applyDenaliInvariantState(form);

  assert.equal(safe.basicInfo.endDateTime, undefined, "endDateTime should be cleared for mountain_day");
});

test("DenaliBasicInfoStep navigation: empty meetingPoint does not block denali_basic", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.meetingPoint = undefined;

  const meetingPointIssues = getDenaliWizardStepIssues(form, "denali_basic").filter((issue) =>
    issue.path.join(".").includes("meetingPoint"),
  );
  assert.equal(meetingPointIssues.length, 0);
});

test("DenaliBasicInfoStep navigation: preserve valid fields on next step (photos)", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.title = "Valid Mountain Tour Title";

  const issues = getDenaliWizardStepIssues(form, "denali_basic");
  assert.equal(issues.length, 0, "no issues on basic step with valid data");

  const photosStepIssues = getDenaliWizardStepIssues(form, "denali_photos");
  assert.equal(
    photosStepIssues.length,
    0,
    "data from basic step does not cause issues on photos step",
  );
});
