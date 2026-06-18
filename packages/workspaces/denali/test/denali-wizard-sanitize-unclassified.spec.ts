import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readDenaliCanonicalBasics } from "../src/adapters/denaliCanonicalBasicsControl";
import { applyDenaliInvariantState } from "../src/normalize/invariantState";
import { evaluateDenaliContextualVisibility } from "../src/rules/denaliContextualRules";
import { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "../src/rules/generated/denaliCanonicalPathMap.generated";
import { buildDenaliTourCreateDefaultValues } from "../src/schemas/denaliCore.schema";
import { denaliTourKindToIsMultiDay } from "../src/types/legacy/denali-tour-kind";
import { sanitizeDenaliWizardDraftRecord } from "../src/wizard/denali-wizard-draft-sanitize";
import { buildDenaliWizardRuleEvalContext } from "../src/wizard/denali-wizard-rule-eval-context";
import type { DenaliWizardRulesModule } from "../src/wizard/denali-wizard-rules-module";

function loadRulesModule(): DenaliWizardRulesModule {
  return Object.freeze({
    applyDenaliInvariantState,
    buildDefaultForm: buildDenaliTourCreateDefaultValues,
    readCanonicalBasics: readDenaliCanonicalBasics,
    canonicalToFormPathMap: DENALI_CANONICAL_TO_FORM_PATH_MAP,
  });
}

describe("denali-wizard-sanitize-unclassified.spec.ts", () => {
  it("DN-SAN-01 denaliTourKindToIsMultiDay is safe when tour kind is unset", () => {
    assert.equal(denaliTourKindToIsMultiDay(undefined), false);
    assert.equal(denaliTourKindToIsMultiDay(null), false);
    assert.equal(denaliTourKindToIsMultiDay("mountain_multi"), true);
  });

  it("DN-SAN-02 contextual visibility does not throw before category selection", () => {
    const form = buildDenaliTourCreateDefaultValues();
    form.basicInfo.title = "Alpine day hike";

    assert.doesNotThrow(() => {
      assert.equal(evaluateDenaliContextualVisibility("schedule.endDateTime", form), true);
      assert.equal(evaluateDenaliContextualVisibility("schedule.startDateTime", form), true);
    });
  });

  it("DN-SAN-03 sanitize preserves draft edits when category is empty", () => {
    const rules = loadRulesModule();
    const ctx = buildDenaliWizardRuleEvalContext();
    const draft = {
      data: {
        basics: { title: "Typed before category" },
        program: { themeIds: [] },
      },
      meta: { currentStepIndex: 0 },
    };

    const sanitized = sanitizeDenaliWizardDraftRecord(draft, rules, ctx);
    assert.equal((sanitized.data as { basics: { title: string } }).basics.title, "Typed before category");
  });

  it("DN-SAN-04 applyDenaliInvariantState does not throw on default unclassified form", () => {
    const form = buildDenaliTourCreateDefaultValues();
    form.basicInfo.title = "Seed title";

    assert.doesNotThrow(() => {
      const next = applyDenaliInvariantState(form);
      assert.equal(next.basicInfo.title, "Seed title");
    });
  });
});
