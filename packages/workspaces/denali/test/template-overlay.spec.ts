import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findDenaliRuleField } from "../src/rules/denaliRuleModel";
import { denaliRuleSet } from "../src/rules/denaliRuleModel";
import {
  applyOverlayToRuleSet,
  parseFieldRulesOverlay,
  resolveDenaliRuleSetFromOverlay,
} from "../src/rules/templateOverlay";
import { resolveDenaliRuleSetFromTemplate } from "../src/normalize/resolveRuleModel";

describe("template-overlay.spec.ts", () => {
  it("DENALI-OVERLAY-01 hides destination via overlay", () => {
    const overlay = parseFieldRulesOverlay({
      destinationId: { visibility: "hidden" },
    });
    const merged = applyOverlayToRuleSet(denaliRuleSet, overlay);
    const model = merged.mountain.single_day;
    assert.ok(model != null);
    assert.equal(findDenaliRuleField(model, "destinationId")?.hidden, true);
  });

  it("DENALI-OVERLAY-02 does not unhide matrix-hard-hidden peakHeight", () => {
    const baseField = findDenaliRuleField(denaliRuleSet.nature.single_day!, "tripDetails.overview.peakHeight");
    assert.ok(baseField?.hidden);
    const merged = resolveDenaliRuleSetFromOverlay({
      "tripDetails.overview.peakHeight": { visibility: "always" },
    });
    assert.equal(
      findDenaliRuleField(merged.nature.single_day!, "tripDetails.overview.peakHeight")?.hidden,
      true
    );
  });

  it("DENALI-OVERLAY-03 resolveDenaliRuleSetFromTemplate applies overlay", () => {
    const ruleSet = resolveDenaliRuleSetFromTemplate({
      fieldRulesOverlay: { destinationId: { visibility: "hidden" } },
    });
    const model = ruleSet.mountain.multi_day;
    assert.ok(model != null);
    assert.equal(findDenaliRuleField(model, "destinationId")?.hidden, true);
  });
});
