/**
 * Temporary audit: invariant engine must purge ghost transport fields for mountain + mode "none".
 * Delete when registry-driven clearing is covered by permanent specs.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { applyDenaliStructuralInvariants } from "@/features/tours/wizard/denali/validation/denaliInvariantEngine";
import {
  clearDenaliNonVisibleFormValues,
  resolveDenaliRuleModelFromForm,
} from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import { isDenaliFieldVisibleInModel } from "@/features/tours/wizard/denali/rules/denaliUIAdapter";
import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

function hydrateMountainWizardForm() {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.transport.transportMode = "none";
  return form;
}

test("corruption: ghost transport.transportCost cleared after structural invariants + visibility purge", () => {
  const form = hydrateMountainWizardForm();
  form.transport.transportCost = 99_000;

  const model = resolveDenaliRuleModelFromForm(form);
  assert.ok(model, "mountain_day must resolve a DenaliRuleModel");

  assert.equal(
    isDenaliFieldVisibleInModel(model, "transport.transportCost", form),
    false,
    "precondition: transportCost must be hidden for mountain + transportMode none",
  );
  assert.equal(form.transport.transportCost, 99_000, "precondition: corruption injected");

  const afterStructural = applyDenaliStructuralInvariants(form);
  const result = clearDenaliNonVisibleFormValues(afterStructural, model);

  assert.equal(
    result.transport.transportCost,
    undefined,
    "invariant engine must clear transport.transportCost when field is not visible",
  );
});
