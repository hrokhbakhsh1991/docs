import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { denaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";

import { getDenaliWizardSteps } from "@/features/tours/wizard/denaliStepConfig";
import { resolveDenaliRegistryFieldLabel } from "./denaliRegistryFieldLabel";
import {
  buildDenaliPublishReadinessIssueViews,
  buildDenaliSubmitIssueViews,
  collectDenaliWizardSubmitIssuePresentation,
  groupDenaliSubmitIssuesByStep,
  resolvePublishReadinessFormPath,
} from "./denaliWizardSubmitIssuePresentation";
import { z } from "zod";
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

test("resolvePublishReadinessFormPath maps gathering geo message to gatheringPoints RHF path", () => {
  assert.equal(
    resolvePublishReadinessFormPath({
      code: "OUTDOOR_PUBLISH_REQUIRES_GEOLOCATION_ZONES",
      message: "logistics.gatheringPoints must include at least one station for denali_pilot publish.",
    }),
    "tripDetails.logistics.gatheringPoints",
  );
});

test("buildDenaliPublishReadinessIssueViews routes gathering readiness to denali_logistics", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  const views = buildDenaliPublishReadinessIssueViews(
    [
      {
        code: "OUTDOOR_PUBLISH_REQUIRES_GEOLOCATION_ZONES",
        message: "حداقل یک نقطه تجمع با آدرس و مختصات جغرافیایی لازم است.",
        path: "tripDetails.logistics.gatheringPoints",
      },
    ],
    form,
    denaliRuleSet,
    mockT,
  );
  assert.equal(views[0]?.formPath, "tripDetails.logistics.gatheringPoints");
  assert.equal(views[0]?.stepId, "denali_logistics");
});

test("buildDenaliSubmitIssueViews routes policies.* to denali_legal not denali_pricing", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";

  const policyIssue: z.ZodIssue = {
    code: z.ZodIssueCode.custom,
    path: ["policies", "cancellationDeadlineHours"],
    message: "مهلت لغو الزامی است.",
  };

  const views = buildDenaliSubmitIssueViews([policyIssue], form, denaliRuleSet, mockT);
  assert.equal(views.length, 1);
  assert.equal(views[0]!.formPath, "policies.cancellationDeadlineHours");
  assert.equal(views[0]!.stepId, "denali_legal");
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
