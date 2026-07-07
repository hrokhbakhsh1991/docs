import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDenaliWizardRuleEvalContext } from "../src/wizard/denali-wizard-rule-eval-context";
import { loadDenaliWizardRulesModule } from "../src/wizard/denali-wizard-host-hooks";
import { sanitizeDenaliWizardDraftRecord } from "../src/wizard/denali-wizard-draft-sanitize";
import {
  getCanonicalStringFromDraft,
  setCanonicalValueOnDraft,
} from "../src/wizard/canonical-draft-access";

describe("denali-wizard-title-sanitize-fixpoint.spec.ts", () => {
  it("DN-TITLE-01 repeated sanitize reaches fixpoint for title typing", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const ctx = buildDenaliWizardRuleEvalContext();
    let envelope = setCanonicalValueOnDraft(
      { data: { program: { themeIds: [] } } },
      "category",
      "mountain_day"
    );
    envelope = setCanonicalValueOnDraft(envelope, "title", "Hello world");
    let draft: Record<string, unknown> = { data: envelope.data };

    for (let i = 0; i < 5; i += 1) {
      const before = JSON.stringify(draft);
      draft = sanitizeDenaliWizardDraftRecord(draft, rules, ctx);
      const after = JSON.stringify(draft);
      if (i > 0) {
        assert.equal(before, after, `sanitize changed output on iteration ${i}`);
      }
    }
    assert.equal(
      getCanonicalStringFromDraft({ data: draft.data as Record<string, unknown> }, "title"),
      "Hello world"
    );
  });
});
