/**
 * Phase 12.6 — publish readiness web adapter
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";

import { loadDenaliWizardRulesModule } from "@app-tour/workspace-denali/host/wizard/rules-loader";
import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { setCanonicalStringValue } from "../src/tours/tour-wizard-draft-path";
import { buildDenaliWizardRuleEvalContext } from "@app-tour/workspace-denali/host/wizard/submit";
import {
  validateDenaliPublishReadinessSync,
  validateDenaliPublishTransitionSync,
} from "@app-tour/workspace-denali/host/ui/chrome/wizard-validation";

describe("denali-publish-readiness.spec.ts", () => {
  it("WEB-12.6-01 publish transition runs rule-engine matrix via host hook", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const plugin = getDenaliWorkspacePlugin();
    const ctx = buildDenaliWizardRuleEvalContext();
    let draft = setCanonicalStringValue(emptyTourWizardDraft(), "category", "mountain_day");

    const skipped = validateDenaliPublishReadinessSync(plugin, draft, rules, ctx);
    assert.equal(skipped.ok, true);

    const blocked = validateDenaliPublishReadinessSync(plugin, draft, rules, ctx, {
      publishTransition: true,
    });
    assert.equal(blocked.ok, false);
    assert.ok(blocked.violations.length > 0);
  });

  it("WEB-12.6-02 validateDenaliPublishTransitionSync merges canonical and rule violations", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const plugin = getDenaliWorkspacePlugin();
    const ctx = buildDenaliWizardRuleEvalContext();
    const draft = emptyTourWizardDraft();

    const result = validateDenaliPublishTransitionSync(
      plugin,
      draft,
      rules,
      "00000000-0000-4000-8000-000000000014",
      ctx
    );
    assert.equal(result.ok, false);
    assert.ok(result.violations.length > 1);
  });
});
