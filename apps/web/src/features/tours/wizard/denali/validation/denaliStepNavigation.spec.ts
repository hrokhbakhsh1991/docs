import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { getDenaliWizardStepIssues } from "@/features/tours/wizard/schemas/denaliTourCreateValidation";
import { applyDenaliInvariantState } from "./denaliInvariantEngine";

test("step navigation: clear hidden fields when moving forward", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  
  // Set a field that should be hidden for mountain_day (e.g. endDateTime)
  form.basicInfo.endDateTime = "2026-06-03T18:00:00.000Z";
  
  // Apply invariants (simulating the gate at step transition or change)
  const safe = applyDenaliInvariantState(form);
  
  assert.equal(safe.basicInfo.endDateTime, undefined, "endDateTime should be cleared for mountain_day");
});

test("step navigation: empty meetingPoint does not block denali_basic", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.meetingPoint = undefined;

  const meetingPointIssues = getDenaliWizardStepIssues(form, "denali_basic").filter((issue) =>
    issue.path.join(".").includes("meetingPoint"),
  );
  assert.equal(meetingPointIssues.length, 0);
});

test("step navigation: seeds default difficulty when outdoor field is visible", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.programNature.difficultyLevel = undefined;

  const safe = applyDenaliInvariantState(form);

  assert.equal(safe.programNature.difficultyLevel, 5);
  const difficultyIssues = getDenaliWizardStepIssues(safe, "denali_program").filter((issue) =>
    issue.path.join(".").includes("difficultyLevel"),
  );
  assert.equal(difficultyIssues.length, 0);
});

test("step navigation: preserve valid fields on next step", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.title = "Valid Mountain Tour Title";
  
  const issues = getDenaliWizardStepIssues(form, "denali_basic");
  assert.equal(issues.length, 0, "no issues on basic step with valid data");
  
  // Simulate moving to next step
  const nextStepIssues = getDenaliWizardStepIssues(form, "denali_program");
  assert.equal(nextStepIssues.length, 0, "data from previous step doesn't cause issues on next step");
});
