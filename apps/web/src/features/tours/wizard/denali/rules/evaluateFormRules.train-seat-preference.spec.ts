import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { findDenaliRuleField } from "./denaliRuleModel";
import { denaliRuleSet } from "./denaliRuleModel";
import {
  evaluateFormFieldRule,
  evaluateFormRules,
} from "./evaluateFormRules";

const SEAT_PATH = "transport.seatPreference";
const LOGISTICS_STEP = "denali_logistics" as const;

function trainLogisticsForm() {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.transport.transportMode = "train";
  return form;
}

test("denaliRuleModel declares transport.seatPreference on logistics step (static optional)", () => {
  const model = denaliRuleSet.mountain.single_day!;
  const field = findDenaliRuleField(model, SEAT_PATH);
  assert.ok(field, "seatPreference must exist on rule model");
  assert.equal(field.step, LOGISTICS_STEP);
  assert.equal(field.hidden, false);
  assert.equal(field.required, false);
});

test("evaluateFormFieldRule: transportMode train → seatPreference visible and required", () => {
  const form = trainLogisticsForm();

  const rule = evaluateFormFieldRule(form, SEAT_PATH, LOGISTICS_STEP);

  assert.equal(rule.canonicalPath, SEAT_PATH);
  assert.equal(rule.formPath, SEAT_PATH);
  assert.equal(rule.visible, true, "train should show seatPreference");
  assert.equal(rule.required, true, "train should require seatPreference");
});

test("evaluateFormFieldRule: transportMode bus → seatPreference not visible", () => {
  const form = trainLogisticsForm();
  form.transport.transportMode = "bus";

  const rule = evaluateFormFieldRule(form, SEAT_PATH, LOGISTICS_STEP);

  assert.equal(rule.visible, false);
  assert.equal(rule.required, false);
});

test("evaluateFormRules includes seatPreference row for train dummy state", () => {
  const form = trainLogisticsForm();

  const rules = evaluateFormRules(form, LOGISTICS_STEP);
  const seat = rules.find((row) => row.canonicalPath === SEAT_PATH);

  assert.ok(seat, "evaluateFormRules should return seatPreference for logistics step");
  assert.equal(seat.visible, true);
  assert.equal(seat.required, true);
});
