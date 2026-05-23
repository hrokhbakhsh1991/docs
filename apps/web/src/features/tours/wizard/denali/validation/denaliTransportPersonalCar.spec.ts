import assert from "node:assert/strict";
import test from "node:test";

import { getDenaliUIFromForm } from "../rules/denaliUIAdapter";
import { buildDenaliCreateTourPayloadProjection } from "../../domain/buildDenaliCreateTourPayloadProjection";
import { getDenaliWizardStepIssues, validateDenaliWizardForm } from "../../schemas/denaliTourCreateValidation";
import { buildDenaliTourCreateTestValues } from "../../schemas/denaliTourCreateBaseSchema";
import { normalizeDenaliWizardForm } from "./denaliRuleAccess";

function mountainForm() {
  return buildDenaliTourCreateTestValues();
}

test("ui: transportCost visible for organized modes not shared_cars", () => {
  const form = mountainForm();
  const ui = getDenaliUIFromForm(form);

  form.transport.transportMode = "bus";
  assert.equal(ui.isVisible("denali_logistics", "transport.transportCost", form), true);

  form.transport.transportMode = "train";
  assert.equal(ui.isVisible("denali_logistics", "transport.transportCost", form), true);

  form.transport.transportMode = "shared_cars";
  assert.equal(ui.isVisible("denali_logistics", "transport.transportCost", form), false);

  form.transport.transportMode = "none";
  assert.equal(ui.isVisible("denali_logistics", "transport.transportCost", form), false);
});

test("ui: allowPersonalCar visible only for bus, minibus, or train", () => {
  const form = mountainForm();
  const ui = getDenaliUIFromForm(form);

  form.transport.transportMode = "bus";
  assert.equal(
    ui.isVisible("denali_logistics", "transport.allowPersonalCar", form),
    true,
  );

  form.transport.transportMode = "minibus";
  assert.equal(
    ui.isVisible("denali_logistics", "transport.allowPersonalCar", form),
    true,
  );

  form.transport.transportMode = "train";
  assert.equal(
    ui.isVisible("denali_logistics", "transport.allowPersonalCar", form),
    true,
  );

  form.transport.transportMode = "organizer_vehicle";
  assert.equal(
    ui.isVisible("denali_logistics", "transport.allowPersonalCar", form),
    false,
  );
});

test("ui: dongAmount visible for bus when allowPersonalCar checked", () => {
  const form = mountainForm();
  const ui = getDenaliUIFromForm(form);

  form.transport.transportMode = "bus";
  form.transport.allowPersonalCar = undefined;
  assert.equal(ui.isVisible("denali_logistics", "transport.dongAmount", form), false);

  form.transport.allowPersonalCar = true;
  assert.equal(ui.isVisible("denali_logistics", "transport.dongAmount", form), true);
});

test("submit: bus + allowPersonalCar requires dongAmount", () => {
  const form = mountainForm();
  form.transport.transportMode = "bus";
  form.transport.allowPersonalCar = true;
  form.transport.dongAmount = undefined;

  const result = validateDenaliWizardForm(form);
  assert.ok(result.issues.some((i) => i.path.join(".") === "transport.dongAmount"));
});

test("submit: bus without allowPersonalCar passes without dong", () => {
  const form = mountainForm();
  form.transport.transportMode = "bus";
  form.transport.allowPersonalCar = undefined;
  form.transport.dongAmount = undefined;

  const result = validateDenaliWizardForm(form);
  assert.ok(!result.issues.some((i) => i.path.join(".") === "transport.dongAmount"));
});

test("transport step: bus + allowPersonalCar missing dong blocks step", () => {
  const form = mountainForm();
  form.transport.transportMode = "bus";
  form.transport.allowPersonalCar = true;
  form.transport.dongAmount = undefined;

  const issues = getDenaliWizardStepIssues(form, "denali_logistics");
  assert.ok(issues.some((i) => i.path.join(".") === "transport.dongAmount"));
});

test("normalize: bus clears allowPersonalCar and dong when switching to organizer_vehicle", () => {
  const form = mountainForm();
  form.transport.transportMode = "bus";
  form.transport.allowPersonalCar = true;
  form.transport.dongAmount = 40_000;

  form.transport.transportMode = "organizer_vehicle";
  const normalized = normalizeDenaliWizardForm(form);
  assert.equal(normalized.transport.allowPersonalCar, undefined);
  assert.equal(normalized.transport.dongAmount, undefined);
});

test("projection: bus + transportCost + allowPersonalCar persists all transport fields", () => {
  const form = mountainForm();
  form.transport.transportMode = "bus";
  form.transport.transportCost = 200_000;
  form.transport.allowPersonalCar = true;
  form.transport.dongAmount = 90_000;

  const dto = buildDenaliCreateTourPayloadProjection(form);
  const transport = (dto.tripDetails as any)?.transport as
    | { transportCost?: number; allowPersonalCar?: boolean; dongAmount?: number }
    | undefined;
  assert.equal(transport?.transportCost, 200_000);
  assert.equal(transport?.allowPersonalCar, true);
  assert.equal(transport?.dongAmount, 90_000);
  assert.equal(dto.tripDetails?.logistics?.fuelShareToman, 90_000);
  assert.equal(dto.tripDetails?.logistics?.primaryTransportMode, "bus");
});

test("projection: train maps to logistics primaryTransportMode train", () => {
  const form = mountainForm();
  form.transport.transportMode = "train";
  form.transport.transportCost = 350_000;

  const dto = buildDenaliCreateTourPayloadProjection(form);
  assert.equal(dto.tripDetails?.logistics?.primaryTransportMode, "train");
  const transport = (dto.tripDetails as any)?.transport as { transportCost?: number } | undefined;
  assert.equal(transport?.transportCost, 350_000);
});

test("projection: bus without allowPersonalCar omits dong and transport slice", () => {
  const form = mountainForm();
  form.transport.transportMode = "bus";
  form.transport.allowPersonalCar = undefined;

  const dto = buildDenaliCreateTourPayloadProjection(form);
  assert.equal((dto.tripDetails as any)?.transport, undefined);
  assert.equal(dto.tripDetails?.logistics?.fuelShareToman, undefined);
});
