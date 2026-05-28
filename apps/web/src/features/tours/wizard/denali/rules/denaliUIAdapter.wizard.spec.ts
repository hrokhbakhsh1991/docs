import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { createInitialDenaliCanonicalModel } from "../denaliCanonicalFormAdapter";

import { getDenaliUIForWizard, getDenaliUIFromForm } from "./denaliUIAdapter";

test("getDenaliUIForWizard returns null ruleModel before tour type is selected", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = undefined as unknown as typeof form.basicInfo.tourType;
  const canonical = createInitialDenaliCanonicalModel(form);
  const ui = getDenaliUIForWizard(canonical, form);
  assert.equal(ui.ruleModel, null);
  assert.equal(ui.isVisible("denali_basic", "destinationId"), false);
});

test("getDenaliUIForWizard projects ruleModel from canonical when tour type is selected", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "nature_day";
  const canonical = createInitialDenaliCanonicalModel(form);
  canonical.category = "nature";
  const ui = getDenaliUIForWizard(canonical, form);
  assert.ok(ui.ruleModel);
  assert.equal(ui.ruleModel!.category, "nature");
});

test("getDenaliUIForWizard keeps ruleModel null on empty tour type", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = undefined as unknown as typeof form.basicInfo.tourType;
  assert.equal(getDenaliUIFromForm(form).ruleModel, null);
  assert.equal(getDenaliUIForWizard(createInitialDenaliCanonicalModel(form), form).ruleModel, null);
});
