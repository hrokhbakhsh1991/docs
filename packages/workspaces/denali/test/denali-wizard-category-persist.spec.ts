import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readDenaliCanonicalBasics } from "../src/adapters/denaliCanonicalBasicsControl";
import { applyDenaliInvariantState } from "../src/normalize/invariantState";
import { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "../src/rules/generated/denaliCanonicalPathMap.generated";
import { buildDenaliTourCreateDefaultValues } from "../src/schemas/denaliCore.schema";
import { buildDenaliWizardRuleEvalContext } from "../src/wizard/denali-wizard-rule-eval-context";
import type { DenaliWizardRulesModule } from "../src/wizard/denali-wizard-rules-module";
import {
  getCanonicalStringFromDraft,
  setCanonicalValueOnDraft,
} from "../src/wizard/canonical-draft-access";
import { evaluateFormFieldRule } from "../src/rules/evaluateFormRules";
import { applyDenaliConditionalFieldRules } from "../src/wizard/apply-contextual-render-plan";
import { loadDenaliWizardRulesModule } from "../src/wizard/denali-wizard-host-hooks";
import { buildDenaliWizardRuleEvalContext } from "../src/wizard/denali-wizard-rule-eval-context";
import { sanitizeDenaliWizardDraftEnvelope } from "../src/wizard/denali-wizard-draft-sanitize";
import type { RenderStepPlan } from "@app-tour/platform-core";

function loadRulesModule(): DenaliWizardRulesModule {
  return Object.freeze({
    applyDenaliInvariantState,
    buildDefaultForm: buildDenaliTourCreateDefaultValues,
    readCanonicalBasics: readDenaliCanonicalBasics,
    canonicalToFormPathMap: DENALI_CANONICAL_TO_FORM_PATH_MAP,
    evaluateFormFieldRule,
  });
}

describe("denali-wizard-category-persist.spec.ts", () => {
  it("DN-CAT-03 sanitize does not persist duration/eventVariant alias keys", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const ctx = buildDenaliWizardRuleEvalContext();
    const env = sanitizeDenaliWizardDraftEnvelope(
      { data: { category: "nature_day", basics: { title: "Walk" }, program: { themeIds: [] } } },
      rules,
      ctx
    );
    assert.equal(getCanonicalStringFromDraft(env, "category"), "nature_day");
    assert.equal(getCanonicalStringFromDraft(env, "duration"), "");
    assert.equal(getCanonicalStringFromDraft(env, "eventVariant"), "");
  });

  it("DN-CAT-02 category stays visible after classification (tourType path ambiguity)", () => {
    const form = { basicInfo: { tourType: "mountain_day" as const } };
    const rule = evaluateFormFieldRule(form, "category", "denali_basic");
    assert.equal(rule.visible, true);
    assert.equal(rule.staticHidden, false);

    const steps: readonly RenderStepPlan[] = [
      {
        stepId: "denali_basic",
        fields: [
          {
            fieldId: "denali.tour-kind-basics",
            kind: "enum",
            canonicalPath: "category",
            required: true,
            hidden: false,
            stepId: "denali_basic",
            uiHints: { compositeId: "denali.tour-kind-basics" },
          },
          {
            fieldId: "title",
            kind: "text",
            canonicalPath: "title",
            required: true,
            hidden: false,
            stepId: "denali_basic",
          },
        ],
      },
    ];
    const draft = { data: { category: "mountain_day", basics: { title: "Typed" } } };
    const filtered = applyDenaliConditionalFieldRules(steps, draft, loadRulesModule());
    assert.equal(filtered[0]?.fields[0]?.canonicalPath, "category");
  });

  it("DN-CAT-01 sanitize does not strip category after classification is set", () => {
    const rules = loadRulesModule();
    const ctx = buildDenaliWizardRuleEvalContext();
    let envelope = setCanonicalValueOnDraft({ data: { program: { themeIds: [] } } }, "category", "nature_day");
    envelope = setCanonicalValueOnDraft(envelope, "title", "Forest walk");

    const sanitized = sanitizeDenaliWizardDraftEnvelope(envelope, rules, ctx);
    assert.equal(getCanonicalStringFromDraft(sanitized, "category"), "nature_day");
    assert.equal(getCanonicalStringFromDraft(sanitized, "title"), "Forest walk");
  });
});
