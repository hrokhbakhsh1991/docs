import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDenaliTourCreateDefaultValues } from "../src/schemas/denaliCore.schema";
import { evaluateFormFieldRule } from "../src/rules/evaluateFormRules";
import { isDenaliFieldVisibleOnStep } from "../src/rules/denaliUIAdapter";
import { findDenaliRuleField } from "../src/rules/denaliRuleModel";
import { evaluateDenaliContextualVisibility } from "../src/rules/denaliContextualRules";
import { resolveDenaliRuleModelFromForm } from "../src/normalize/resolveRuleModel";

describe("category-field-visibility.spec.ts", () => {
  it("DN-CAT-VIS-01 category stays visible on denali_basic when tour kind is selected", () => {
    const form = buildDenaliTourCreateDefaultValues();
    form.basicInfo.tourType = "mountain_day";

    const model = resolveDenaliRuleModelFromForm(form);
    assert.notEqual(model, null);

    const field = findDenaliRuleField(model!, "category");
    assert.notEqual(field, undefined, "category must exist in rule model");
    assert.equal(field?.hidden, false);
    assert.equal(
      evaluateDenaliContextualVisibility("category", form),
      true,
      "category contextual visibility"
    );
    assert.equal(field?.step, "denali_basic");

    const directVisible = isDenaliFieldVisibleOnStep(
      model,
      "denali_basic",
      "category",
      form
    );
    assert.equal(directVisible, true, "direct isDenaliFieldVisibleOnStep with category path");

    const rule = evaluateFormFieldRule(form, "category", "denali_basic");
    assert.equal(
      rule.visible,
      true,
      `evaluateFormFieldRule: ${JSON.stringify(rule)}`
    );

    const visible = isDenaliFieldVisibleOnStep(
      model,
      "denali_basic",
      "basicInfo.tourType",
      form
    );
    assert.equal(visible, true, "isDenaliFieldVisibleOnStep should keep category visible");
  });
});
