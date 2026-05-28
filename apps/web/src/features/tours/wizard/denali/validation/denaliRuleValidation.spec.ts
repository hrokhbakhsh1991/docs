import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { normalizeDenaliWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import {
  getDenaliWizardStepIssues,
  getDenaliWizardSubmitIssues,
} from "@/features/tours/wizard/schemas/denaliTourCreateValidation";

import {
  getDenaliStepPickShape,
  getDenaliWizardVisibleSteps,
  hasDenaliWizardClassification,
  isDenaliStepVisibleInModel,
  resolveDenaliRuleModelFromForm,
  resolveDenaliRuleSetFromTemplate,
  withDenaliWizardRailTestingOverrides,
} from "./denaliRuleAccess";
import { validateDenaliWizardForm } from "./denaliWizardFormZod";
import { collectDenaliRuleRequiredIssues } from "../rules/denaliRuleRequired";
import { denaliRuleSet } from "../rules/denaliRuleModel";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";

test("isDenaliStepVisibleInModel: denali_logistics true for mountain when location fields exist", () => {
  const model = denaliRuleSet.mountain.single_day!;
  assert.equal(isDenaliStepVisibleInModel(model, "denali_logistics"), true);
  assert.equal(
    model.fields.some((f) => f.path === "gatheringPoints" && !f.hidden),
    true,
  );
});

test("isDenaliStepVisibleInModel: event hides logistics location fields in model", () => {
  const model = denaliRuleSet.event.single_day!;
  const gathering = model.fields.find((f) => f.path === "gatheringPoints");
  assert.equal(gathering?.hidden, true);
  assert.equal(
    isDenaliStepVisibleInModel(model, "denali_logistics"),
    true,
    "transport + gear still visible on logistics step",
  );
});

test("getDenaliWizardVisibleSteps: all content steps including denali_photos before tour type", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "" as typeof form.basicInfo.tourType;
  assert.equal(hasDenaliWizardClassification(form), false);
  const steps = getDenaliWizardVisibleSteps(form, denaliRuleSet);
  assert.ok(steps.includes("denali_photos"), `expected photos on rail; got ${steps.join(",")}`);
  assert.ok(!steps.includes("review"));
});

test("getDenaliWizardVisibleSteps keeps denali_photos when overlay hides photos field", () => {
  const mergedRuleSet = resolveDenaliRuleSetFromTemplate({
    id: "t-hide-photos",
    workspaceId: "w1",
    baseProfile: "denali_pilot",
    stepOverrides: { skip: [], insert: [] },
    fieldRulesOverlay: { photos: { visibility: "hidden" } },
    presetId: null,
    canonicalData: {},
    wizardContractVersion: 1,
    formProfileVersion: 1,
  });
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  const model = mergedRuleSet.mountain.single_day!;
  assert.equal(
    isDenaliStepVisibleInModel(model, "denali_photos"),
    true,
    "content fields on denali_photos keep the step visible even when gallery is hidden",
  );
  const steps = getDenaliWizardVisibleSteps(form, mergedRuleSet);
  assert.ok(
    steps.includes("denali_photos"),
    `photos step remains on rail; rail=${steps.join(",")}`,
  );
});

test("getDenaliWizardVisibleSteps includes review and logistics after classification", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  assert.equal(hasDenaliWizardClassification(form), true);
  const steps = getDenaliWizardVisibleSteps(form, denaliRuleSet);
  assert.ok(steps.includes("review"));
  assert.ok(steps.includes("denali_logistics"));
});


test("withDenaliWizardRailTestingOverrides forces logistics and photos when overlay drops logistics pill", () => {
  const model = denaliRuleSet.mountain.single_day!;
  const logisticsPaths = model.fields
    .filter((field) => field.step === "denali_logistics")
    .map((field) => field.path);
  const fieldRulesOverlay = Object.fromEntries(
    logisticsPaths.map((path) => [path, { visibility: "hidden" as const }]),
  );
  const mergedRuleSet = resolveDenaliRuleSetFromTemplate({
    id: "t-force-rail",
    workspaceId: "w1",
    baseProfile: "denali_pilot",
    stepOverrides: { skip: [], insert: [] },
    fieldRulesOverlay,
    presetId: null,
    canonicalData: {},
    wizardContractVersion: 1,
    formProfileVersion: 1,
  });
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  const raw = getDenaliWizardVisibleSteps(form, mergedRuleSet);
  assert.ok(!raw.includes("denali_logistics"));
  const forced = withDenaliWizardRailTestingOverrides(raw, { enabled: true });
  assert.ok(forced.includes("denali_logistics"));
  assert.ok(forced.includes("denali_photos"));
});

test("getDenaliWizardVisibleSteps omits denali_logistics when overlay hides every logistics field", () => {
  const model = denaliRuleSet.mountain.single_day!;
  const logisticsPaths = model.fields
    .filter((field) => field.step === "denali_logistics")
    .map((field) => field.path);
  assert.ok(logisticsPaths.length > 0);

  const fieldRulesOverlay = Object.fromEntries(
    logisticsPaths.map((path) => [path, { visibility: "hidden" as const }]),
  );
  const template: TenantWizardTemplate = {
    id: "t-hide-logistics",
    workspaceId: "w1",
    baseProfile: "denali_pilot",
    stepOverrides: { skip: [], insert: [] },
    fieldRulesOverlay,
    presetId: null,
    canonicalData: {},
    wizardContractVersion: 1,
    formProfileVersion: 1,
  };
  const mergedRuleSet = resolveDenaliRuleSetFromTemplate(template);
  const mergedModel = mergedRuleSet.mountain.single_day!;
  assert.equal(isDenaliStepVisibleInModel(mergedModel, "denali_logistics"), false);

  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  const steps = getDenaliWizardVisibleSteps(form, mergedRuleSet);
  assert.ok(
    !steps.includes("denali_logistics"),
    `logistics pill should be hidden; rail=${steps.join(",")}`,
  );
  assert.ok(steps.includes("denali_basic"));
  assert.ok(steps.includes("denali_pricing"));
});

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
  form.tripDetails = {
    ...form.tripDetails,
    logistics: { gatheringPoints: form.tripDetails?.logistics?.gatheringPoints ?? [] },
  };
  form.basicInfo.startDateTime = "2026-08-01T08:00:00.000Z";
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
  form.basicInfo.tourType = "mountain_day";
  const model = resolveDenaliRuleModelFromForm(form);
  assert.equal(model?.category, "mountain");
  assert.equal(model?.duration, "single_day");
});

test("getDenaliWizardSubmitIssues includes denali_pricing mountain participant fields", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
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
  form.basicInfo.tourType = "mountain_day";
  form.participantRequirements.fitnessLevel = undefined;
  const issues = getDenaliWizardStepIssues(form, "denali_pricing");
  assert.ok(issues.some((i) => i.path.join(".") === "participantRequirements.fitnessLevel"));
});

test("collectDenaliRuleRequiredIssues submit scope checks dong and paid price", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  const model = resolveDenaliRuleModelFromForm(form)!;
  form.transport.transportMode = "shared_cars";
  form.transport.dongAmount = undefined;
  form.pricingPayment.requiresPayment = true;
  form.pricingPayment.basePricePerPerson = undefined;

  const issues = collectDenaliRuleRequiredIssues(form, model, { mode: "submit" });
  assert.ok(issues.some((i) => i.path.join(".") === "transport.dongAmount"));
  assert.ok(issues.some((i) => i.path.join(".") === "pricingPayment.basePricePerPerson"));
});
