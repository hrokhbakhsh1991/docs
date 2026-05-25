import assert from "node:assert/strict";
import test from "node:test";

import { denaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";

import { mapTemplateToRuleModel } from "./ruleModelConverter";

test("mapTemplateToRuleModel applies overlay hidden/required to denali rule set", () => {
  const mapped = mapTemplateToRuleModel({
    baseProfile: "denali",
    stepOverrides: { skip: [], insert: [] },
    fieldRulesOverlay: {
      destinationId: { visibility: "hidden" },
      "transport.dongAmount": { required: "required" },
    },
  });

  const mountainSingle = mapped.ruleSet.mountain.single_day!;
  const destination = mountainSingle.fields.find((f) => f.path === "destinationId");
  assert.ok(destination);
  assert.equal(destination.hidden, true);

  const dong = mountainSingle.fields.find((f) => f.path === "transport.dongAmount");
  assert.ok(dong);
  assert.equal(dong.required, true);

  assert.notEqual(mapped.ruleSet, denaliRuleSet);
  assert.equal(denaliRuleSet.mountain.single_day!.fields.find((f) => f.path === "destinationId")!.hidden, false);
});

test("mapTemplateToRuleModel null template returns base denali rule set clone", () => {
  const mapped = mapTemplateToRuleModel(null);
  assert.equal(mapped.profile, "denali_pilot");
  assert.equal(mapped.fieldOverlay.size, 0);
  assert.notEqual(mapped.ruleSet, denaliRuleSet);
  assert.equal(
    mapped.ruleSet.mountain.single_day!.fields.length,
    denaliRuleSet.mountain.single_day!.fields.length,
  );
});
