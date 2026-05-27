import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { denaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";

import { getDenaliWizardSteps } from "@/features/tours/wizard/denaliStepConfig";
import { resolveDenaliRegistryFieldLabel } from "./denaliRegistryFieldLabel";
import {
  collectDenaliWizardSubmitIssuePresentation,
  groupDenaliSubmitIssuesByStep,
} from "./denaliWizardSubmitIssuePresentation";
import { getDenaliWizardSubmitIssues } from "./validation/denaliWizardFormZod";

const mockT = ((key: string) => `t:${key}`) as Parameters<
  typeof resolveDenaliRegistryFieldLabel
>[1];

test("resolveDenaliRegistryFieldLabel maps transport.dongAmount via registry", () => {
  assert.equal(
    resolveDenaliRegistryFieldLabel("transport.dongAmount", mockT),
    "t:transport.dongAmount",
  );
});

test("resolveDenaliRegistryFieldLabel normalizes itinerary index paths", () => {
  assert.equal(
    resolveDenaliRegistryFieldLabel("programNature.itinerary.0.title", mockT),
    "t:program.itineraryOutline",
  );
});

test("collectDenaliWizardSubmitIssuePresentation groups issues by wizard step", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.title = "";
  form.transport.transportMode = "bus";
  form.transport.allowPersonalCar = true;
  form.transport.dongAmount = undefined;

  const issues = getDenaliWizardSubmitIssues(form);
  assert.ok(issues.length >= 2, `fixture should produce multiple submit issues, got ${issues.length}`);

  const { byStep, views } = collectDenaliWizardSubmitIssuePresentation({
    form,
    ruleSet: denaliRuleSet,
    stepOrder: getDenaliWizardSteps(),
    t: mockT,
  });

  assert.ok(byStep.length >= 2);
  assert.equal(byStep.some((group) => group.stepId === "denali_basic"), true);
  assert.equal(byStep.some((group) => group.stepId === "denali_logistics"), true);
  assert.equal(views.every((view) => view.label.startsWith("t:")), true);
  assert.equal(groupDenaliSubmitIssuesByStep(views, ["denali_basic", "denali_logistics"]).length, byStep.length);
});

test("collectDenaliWizardSubmitIssuePresentation groups shortDescription under denali_photos", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.programNature.shortDescription = "";

  const { byStep } = collectDenaliWizardSubmitIssuePresentation({
    form,
    ruleSet: denaliRuleSet,
    stepOrder: getDenaliWizardSteps(),
    t: mockT,
  });

  const photosGroup = byStep.find((group) => group.stepId === "denali_photos");
  const programGroup = byStep.find((group) => group.stepId === "denali_program");

  assert.ok(photosGroup, "shortDescription issue should appear on photos step");
  assert.ok(
    photosGroup!.issues.some((issue) => issue.formPath.includes("shortDescription")),
    "photos group should include shortDescription path",
  );
  assert.equal(programGroup, undefined, "program step should not own shortDescription issues");
});

test("groupDenaliSubmitIssuesByStep preserves rail order basic before photos before program", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.title = "";
  form.programNature.shortDescription = "";

  const issues = getDenaliWizardSubmitIssues(form);
  const views = issues.map((issue) => ({
    formPath: issue.path.join("."),
    canonicalPath: issue.path.join("."),
    label: "label",
    message: issue.message,
    stepId: issue.path.join(".").includes("shortDescription")
      ? ("denali_photos" as const)
      : ("denali_basic" as const),
  }));

  const grouped = groupDenaliSubmitIssuesByStep(views, getDenaliWizardSteps());
  const stepIds = grouped.map((group) => group.stepId);

  assert.deepEqual(stepIds.slice(0, 2), ["denali_basic", "denali_photos"]);
  assert.ok(stepIds.indexOf("denali_basic") < stepIds.indexOf("denali_photos"));
});
