import assert from "node:assert/strict";
import test from "node:test";

import { mapTemplateToRuleModel } from "@/features/tours/wizard/domain/ruleModelConverter";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import { collectDenaliRuleRequiredIssues } from "./denaliRuleRequired";
import { findDenaliRuleField } from "./denaliRuleModel";
import { getDenaliUIFromForm } from "./denaliUIAdapter";
import { resolveDenaliRuleSetFromTemplate } from "../validation/denaliRuleAccess";

const WORKSPACE_OVERLAY_TEMPLATE: TenantWizardTemplate = {
  id: "t-overlay",
  workspaceId: "w1",
  baseProfile: "denali_pilot",
  stepOverrides: { skip: [], insert: [] },
  fieldRulesOverlay: {
    requiresLocalGuide: { visibility: "hidden" },
    capacityMin: { visibility: "hidden" },
    socialMediaLink: { visibility: "hidden" },
    "transport.dongAmount": { required: "required" },
    capacityMax: { required: "optional" },
  },
  presetId: null,
  canonicalData: {},
  wizardContractVersion: 1,
  formProfileVersion: 1,
};

function mountainDayForm() {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.capacityMax = undefined;
  form.transport.transportMode = "shared_cars";
  form.transport.dongAmount = undefined;
  return form;
}

test("resolveDenaliRuleSetFromTemplate applies workspace overlay on mountain.single_day", () => {
  const ruleSet = resolveDenaliRuleSetFromTemplate(WORKSPACE_OVERLAY_TEMPLATE);
  const model = ruleSet.mountain.single_day!;

  assert.equal(findDenaliRuleField(model, "requiresLocalGuide")!.hidden, true);
  assert.equal(findDenaliRuleField(model, "capacityMin")!.hidden, true);
  assert.equal(findDenaliRuleField(model, "socialMediaLink")!.hidden, true);
  assert.equal(findDenaliRuleField(model, "transport.dongAmount")!.required, true);
  assert.equal(findDenaliRuleField(model, "capacityMax")!.required, false);
});

test("getDenaliUIFromForm reflects overlay visibility and required flags", () => {
  const form = mountainDayForm();
  const ruleSet = mapTemplateToRuleModel(WORKSPACE_OVERLAY_TEMPLATE).ruleSet;
  const ui = getDenaliUIFromForm(form, ruleSet);

  assert.equal(ui.isVisibleInModel("requiresLocalGuide", form), false);
  assert.equal(ui.isVisibleInModel("capacityMin", form), false);
  assert.equal(ui.isVisibleInModel("socialMediaLink", form), false);
  assert.equal(ui.isVisibleInModel("transport.dongAmount", form), true);
  assert.equal(ui.isRequiredInModel("transport.dongAmount", form), true);
  assert.equal(ui.isRequiredInModel("capacityMax", form), false);
});

test("collectDenaliRuleRequiredIssues: overlay requires dongAmount, not capacityMax", () => {
  const form = mountainDayForm();
  const model = resolveDenaliRuleSetFromTemplate(WORKSPACE_OVERLAY_TEMPLATE).mountain.single_day!;
  const issues = collectDenaliRuleRequiredIssues(form, model, { mode: "submit" });

  assert.ok(
    issues.some((issue) => issue.path.join(".") === "transport.dongAmount"),
    "transport.dongAmount should be required by overlay",
  );
  assert.ok(
    !issues.some((issue) => issue.path.join(".") === "basicInfo.capacityMax"),
    "capacityMax should not be required when overlay marks it optional",
  );
});
