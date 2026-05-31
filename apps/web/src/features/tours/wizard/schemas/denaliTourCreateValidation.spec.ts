import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDenaliTourCreateDefaultValues,
  normalizeDenaliWizardForm,
} from "./denaliCore.schema";
import { buildLayout } from "../shell/layout";
import {
  applyDenaliWizardStepValidation,
  getDenaliWizardStepIssues,
  getDenaliWizardSubmitIssues,
  validateDenaliWizardForm,
} from "./denaliTourCreateValidation";

test("normalizeDenaliWizardForm strips outdoor fields for event kinds", () => {
  const base = buildDenaliTourCreateDefaultValues();
  base.basicInfo.tourType = "event_cinema";
  const normalized = normalizeDenaliWizardForm(base);
  assert.equal(normalized.programNature.difficultyLevel, undefined);
  assert.equal(normalized.programNature.hikingHoursApprox, undefined);
});

test("getDenaliWizardStepIssues: transport step catches missing dong", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";
  form.transport.transportMode = "shared_cars";
  form.transport.dongAmount = undefined;
  const issues = getDenaliWizardStepIssues(form, "denali_logistics");
  assert.ok(issues.some((i) => i.path.join(".") === "transport.dongAmount"));
});

test("getDenaliWizardStepIssues: program step ignores participantRequirements", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.participantRequirements.minimumAge = undefined;
  const issues = getDenaliWizardStepIssues(form, "denali_program");
  assert.ok(!issues.some((i) => String(i.path[0]) === "participantRequirements"));
});

test("getDenaliWizardSubmitIssues aligns with validateDenaliWizardForm", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.participantRequirements.fitnessLevel = undefined;
  const issues = getDenaliWizardSubmitIssues(form);
  const validated = validateDenaliWizardForm(form);
  assert.equal(validated.success, false);
  assert.equal(issues.length, validated.issues.length);
});

test("applyDenaliWizardStepValidation on review runs submit gate", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.participantRequirements.fitnessLevel = undefined;
  const layout = buildLayout("denali_pilot");
  const errors: { path: string; message: string }[] = [];
  const ok = applyDenaliWizardStepValidation(
    form,
    "review",
    (path, opts) => {
      errors.push({ path: String(path), message: opts.message ?? "" });
    },
    () => {},
    layout,
  );
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.path === "participantRequirements.fitnessLevel"));
});

test("applyDenaliWizardStepValidation returns false when basic step invalid", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.title = "short";
  const layout = buildLayout("denali_pilot");
  const errors: { path: string; message: string }[] = [];
  const ok = applyDenaliWizardStepValidation(
    form,
    "denali_basic",
    (path, opts) => {
      errors.push({ path: String(path), message: opts.message ?? "" });
    },
    () => {},
    layout,
  );
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.path.startsWith("basicInfo")));
});
