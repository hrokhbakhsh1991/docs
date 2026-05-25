import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import {
  assertUniqueDenaliFieldPaths,
  denaliRuleSet,
  findDenaliRuleField,
  type DenaliRuleModel,
} from "./denaliRuleModel";
import {
  isDenaliFieldRequiredOnStep,
  isDenaliFieldVisibleOnStep,
} from "./denaliUIAdapter";
import { evaluateFormFieldRule } from "./evaluateFormRules";

const ADMIN_CAPACITY_PATH = "transport.adminCapacityApproval";
const PRICE_PATH = "pricing.basePricePerPerson";
const LOGISTICS_STEP = "denali_logistics" as const;
const PRICING_STEP = "denali_pricing" as const;

function mountainDayForm() {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  return form;
}

test("denaliRuleSet rejects duplicate field paths at build time (no last-rule-wins)", () => {
  const duplicate: DenaliRuleModel = {
    category: "mountain",
    duration: "single_day",
    fields: [
      {
        path: "title",
        required: true,
        hidden: false,
        step: "denali_basic",
      },
      {
        path: "title",
        required: false,
        hidden: true,
        step: "denali_basic",
      },
    ],
  };

  assert.throws(
    () => assertUniqueDenaliFieldPaths(duplicate),
    /duplicate field path "title"/,
  );
});

test("visibility conflict: static show + contextual hide → field hidden (AND, hide wins)", () => {
  const form = mountainDayForm();
  form.transport.transportMode = "bus";

  const model = denaliRuleSet.mountain.single_day!;
  const field = findDenaliRuleField(model, ADMIN_CAPACITY_PATH)!;
  assert.equal(field.hidden, false, "model says show");

  const visible = isDenaliFieldVisibleOnStep(model, LOGISTICS_STEP, ADMIN_CAPACITY_PATH, form);
  assert.equal(visible, false, "transport rule hides adminCapacityApproval without allowPersonalCar");

  const rule = evaluateFormFieldRule(form, ADMIN_CAPACITY_PATH, LOGISTICS_STEP);
  assert.equal(rule.staticHidden, false);
  assert.equal(rule.visible, false);
});

test("visibility conflict: static hide + contextual show → field hidden (static hide wins)", () => {
  const form = mountainDayForm();
  form.transport.transportMode = "bus";
  form.transport.allowPersonalCar = true;

  const syntheticModel: DenaliRuleModel = {
    category: "mountain",
    duration: "single_day",
    fields: [
      {
        path: ADMIN_CAPACITY_PATH,
        required: false,
        hidden: true,
        step: LOGISTICS_STEP,
      },
    ],
  };

  const visible = isDenaliFieldVisibleOnStep(
    syntheticModel,
    LOGISTICS_STEP,
    ADMIN_CAPACITY_PATH,
    form,
  );
  assert.equal(visible, false, "field.hidden must win even when allowPersonalCar would show adminCapacityApproval");
});

test("required conflict: static required + contextual optional → not required (contextual wins)", () => {
  const form = mountainDayForm();
  form.pricingPayment.requiresPayment = false;

  const model = denaliRuleSet.mountain.single_day!;
  const field = findDenaliRuleField(model, PRICE_PATH)!;
  assert.equal(field.required, false, "model marks price optional");

  const syntheticRequired: DenaliRuleModel = {
    ...model,
    fields: model.fields.map((row) =>
      row.path === PRICE_PATH ? { ...row, required: true } : row,
    ),
  };

  const required = isDenaliFieldRequiredOnStep(
    syntheticRequired,
    PRICING_STEP,
    PRICE_PATH,
    form,
  );
  assert.equal(required, false, "requiresPayment=false overrides static required:true");
});

test("required conflict: static optional + contextual required → required (contextual wins)", () => {
  const form = mountainDayForm();
  form.pricingPayment.requiresPayment = true;

  const model = denaliRuleSet.mountain.single_day!;
  const field = findDenaliRuleField(model, PRICE_PATH)!;
  assert.equal(field.required, false);

  const required = isDenaliFieldRequiredOnStep(model, PRICING_STEP, PRICE_PATH, form);
  assert.equal(required, true);

  const rule = evaluateFormFieldRule(form, PRICE_PATH, PRICING_STEP);
  assert.equal(rule.staticRequired, false);
  assert.equal(rule.required, true);
});

test("required cannot override visibility: hidden field is never required", () => {
  const form = mountainDayForm();
  form.transport.transportMode = "bus";

  const required = isDenaliFieldRequiredOnStep(
    denaliRuleSet.mountain.single_day!,
    LOGISTICS_STEP,
    ADMIN_CAPACITY_PATH,
    form,
  );
  assert.equal(required, false, "invisible fields are never required");
});
