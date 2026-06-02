import assert from "node:assert/strict";
import test from "node:test";

import { mapTemplateToRuleModel } from "@/features/tours/wizard/domain/ruleModelConverter";

test("form-rule-engine re-export: mapTemplateToRuleModel exposes formRuleConfigs", () => {
  const model = mapTemplateToRuleModel(null);
  assert.ok(model.formRuleConfigs.some((r) => r.path === "basicInfo.destinationId"));
});
