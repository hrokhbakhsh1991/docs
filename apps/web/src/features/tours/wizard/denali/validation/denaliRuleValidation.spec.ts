import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDenaliTourCreateTestValues,
  normalizeDenaliWizardForm,
} from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import {
  getDenaliWizardStepIssues,
  getDenaliWizardSubmitIssues,
} from "@/features/tours/wizard/schemas/denaliTourCreateValidation";

import { getDenaliStepPickShape, resolveDenaliRuleModelFromForm } from "./denaliRuleAccess";
import { validateDenaliWizardForm } from "./denaliWizardFormZod";
import { collectDenaliRuleRequiredIssues } from "../rules/denaliRuleRequired";
import { denaliRuleSet } from "../rules/denaliRuleModel";

test("getDenaliStepPickShape includes outdoor fields for mountain program step", () => {
  const model = denaliRuleSet.mountain.single_day!;
  const pick = getDenaliStepPickShape(model, "denali_program");
  assert.equal(pick.programNature, true);
  assert.equal(pick.participantRequirements, undefined);
});

test("event program step issues omit hidden outdoor fields", () => {
  const values = buildDenaliTourCreateTestValues();
  values.basicInfo.tourType = "event_cinema";
  values.programNature.difficultyLevel = undefined;
  values.programNature.hikingHoursApprox = undefined;
  const issues = getDenaliWizardStepIssues(values, "denali_program");
  assert.ok(!issues.some((i) => i.path.join(".") === "programNature.difficultyLevel"));
});

test("validateDenaliWizardForm omits hidden outdoor fields after normalize for event", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "event_cinema";
  form.programNature.difficultyLevel = 2;
  const normalized = normalizeDenaliWizardForm(form);
  assert.equal(normalized.programNature.difficultyLevel, undefined);
  const parsed = validateDenaliWizardForm(normalized);
  assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.issues));
});

test("normalize clears mountain participant fields when switching to event", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "event_cinema";
  form.participantRequirements.minimumAge = 18;
  form.participantRequirements.fitnessLevel = "medium";
  form.participantRequirements.sportsInsuranceRequired = true;
  const normalized = normalizeDenaliWizardForm(form);
  assert.equal(normalized.participantRequirements.minimumAge, undefined);
  assert.equal(normalized.participantRequirements.fitnessLevel, undefined);
  assert.equal(normalized.participantRequirements.sportsInsuranceRequired, undefined);
});

test("resolveDenaliRuleModelFromForm returns mountain single_day for defaults", () => {
  const form = buildDenaliTourCreateTestValues();
  const model = resolveDenaliRuleModelFromForm(form);
  assert.equal(model?.category, "mountain");
  assert.equal(model?.duration, "single_day");
});

test("getDenaliWizardSubmitIssues includes denali_pricing mountain participant fields", () => {
  const form = buildDenaliTourCreateTestValues();
  form.participantRequirements.fitnessLevel = undefined;
  const issues = getDenaliWizardSubmitIssues(form);
  assert.ok(
    issues.some((i) => i.path.join(".") === "participantRequirements.fitnessLevel"),
  );
});

test("getDenaliWizardStepIssues omits denali_pricing participant fields on program step", () => {
  const form = buildDenaliTourCreateTestValues();
  form.participantRequirements.fitnessLevel = undefined;
  const issues = getDenaliWizardStepIssues(form, "denali_program");
  assert.ok(!issues.some((i) => String(i.path[0]) === "participantRequirements"));
});

test("getDenaliWizardStepIssues includes participant fields on pricing step", () => {
  const form = buildDenaliTourCreateTestValues();
  form.participantRequirements.fitnessLevel = undefined;
  const issues = getDenaliWizardStepIssues(form, "denali_pricing");
  assert.ok(issues.some((i) => i.path.join(".") === "participantRequirements.fitnessLevel"));
});

test("collectDenaliRuleRequiredIssues submit scope checks dong and paid price", () => {
  const form = buildDenaliTourCreateTestValues();
  const model = resolveDenaliRuleModelFromForm(form)!;
  form.transport.transportMode = "shared_cars";
  form.transport.dongAmount = undefined;
  form.pricingPayment.requiresPayment = true;
  form.pricingPayment.basePricePerPerson = undefined;

  const issues = collectDenaliRuleRequiredIssues(form, model, { mode: "submit" });
  assert.ok(issues.some((i) => i.path.join(".") === "transport.dongAmount"));
  assert.ok(issues.some((i) => i.path.join(".") === "pricingPayment.basePricePerPerson"));
});
