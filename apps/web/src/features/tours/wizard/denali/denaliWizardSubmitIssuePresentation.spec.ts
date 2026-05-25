import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { denaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";

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
    stepOrder: [
      "denali_basic",
      "denali_program",
      "denali_logistics",
      "denali_pricing",
      "denali_photos",
      "review",
    ],
    t: mockT,
  });

  assert.ok(byStep.length >= 2);
  assert.equal(byStep.some((group) => group.stepId === "denali_basic"), true);
  assert.equal(byStep.some((group) => group.stepId === "denali_logistics"), true);
  assert.equal(views.every((view) => view.label.startsWith("t:")), true);
  assert.equal(groupDenaliSubmitIssuesByStep(views, ["denali_basic", "denali_logistics"]).length, byStep.length);
});
