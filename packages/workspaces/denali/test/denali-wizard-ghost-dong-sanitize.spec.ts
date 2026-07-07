import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getCanonicalStringFromDraft,
  setCanonicalValueOnDraft,
} from "../src/wizard/canonical-draft-access";
import { buildDenaliWizardRuleEvalContext } from "../src/wizard/denali-wizard-rule-eval-context";
import { loadDenaliWizardRulesModule } from "../src/wizard/denali-wizard-host-hooks";
import { sanitizeDenaliWizardDraftEnvelope } from "../src/wizard/denali-wizard-draft-sanitize";

describe("denali-wizard-ghost-dong-sanitize.spec.ts (P15-W)", () => {
  it("DN-GHOST-01 sanitize clears transport.dongAmount when mode is not shared_cars", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const ctx = buildDenaliWizardRuleEvalContext();
    let envelope = setCanonicalValueOnDraft({ data: {} }, "category", "mountain_day");
    envelope = setCanonicalValueOnDraft(envelope, "transport.mode", "shared_cars");
    envelope = setCanonicalValueOnDraft(envelope, "transport.dongAmount", "50000");
    envelope = setCanonicalValueOnDraft(envelope, "transport.mode", "bus");

    const sanitized = sanitizeDenaliWizardDraftEnvelope(envelope, rules, ctx);
    assert.equal(getCanonicalStringFromDraft(sanitized, "transport.dongAmount"), "");
  });
});
