import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { findDenaliRuleField } from "./denaliRuleModel";
import { denaliRuleSet } from "./denaliRuleModel";
import {
  evaluateFormFieldRule,
  evaluateFormRules,
} from "./evaluateFormRules";

const ADMIN_CAPACITY_PATH = "transport.adminCapacityApproval";
const LOGISTICS_STEP = "denali_logistics" as const;

function busWithPersonalCarForm() {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.transport.transportMode = "bus";
  form.transport.allowPersonalCar = true;
  return form;
}

test("denaliRuleModel declares transport.adminCapacityApproval on logistics step (static optional)", () => {
  const model = denaliRuleSet.mountain.single_day!;
  const field = findDenaliRuleField(model, ADMIN_CAPACITY_PATH);
  assert.ok(field, "adminCapacityApproval must exist on rule model");
  assert.equal(field.step, LOGISTICS_STEP);
  assert.equal(field.hidden, false);
  assert.equal(field.required, false);
});

test("evaluateFormFieldRule: bus + allowPersonalCar → adminCapacityApproval visible", () => {
  const form = busWithPersonalCarForm();

  const rule = evaluateFormFieldRule(form, ADMIN_CAPACITY_PATH, LOGISTICS_STEP);

  assert.equal(rule.canonicalPath, ADMIN_CAPACITY_PATH);
  assert.equal(rule.formPath, ADMIN_CAPACITY_PATH);
  assert.equal(rule.visible, true, "bus + allowPersonalCar should show adminCapacityApproval");
  assert.equal(rule.required, false);
});

test("evaluateFormFieldRule: bus without allowPersonalCar → adminCapacityApproval not visible", () => {
  const form = busWithPersonalCarForm();
  form.transport.allowPersonalCar = undefined;

  const rule = evaluateFormFieldRule(form, ADMIN_CAPACITY_PATH, LOGISTICS_STEP);

  assert.equal(rule.visible, false);
  assert.equal(rule.required, false);
});

test("evaluateFormRules includes adminCapacityApproval row when personal car is permitted", () => {
  const form = busWithPersonalCarForm();

  const rules = evaluateFormRules(form, LOGISTICS_STEP);
  const row = rules.find((entry) => entry.canonicalPath === ADMIN_CAPACITY_PATH);

  assert.ok(row, "evaluateFormRules should return adminCapacityApproval for logistics step");
  assert.equal(row.visible, true);
  assert.equal(row.required, false);
});
