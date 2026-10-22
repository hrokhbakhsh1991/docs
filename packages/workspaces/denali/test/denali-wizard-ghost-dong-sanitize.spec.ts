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
  it("DN-GHOST-01 clears dongAmount when transport mode changes and personal cars are disabled", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const ctx = buildDenaliWizardRuleEvalContext();
    let envelope = setCanonicalValueOnDraft({ data: {} }, "category", "mountain_day");
    envelope = setCanonicalValueOnDraft(envelope, "transport.mode", "shared_cars");
    envelope = setCanonicalValueOnDraft(envelope, "transport.dongAmount", "50000");
    envelope = setCanonicalValueOnDraft(envelope, "transport.mode", "bus");

    const sanitized = sanitizeDenaliWizardDraftEnvelope(envelope, rules, ctx);
    assert.equal(getCanonicalStringFromDraft(sanitized, "transport.dongAmount"), "");
  });

  it("preserves dongAmount for organized transport when personal cars are allowed", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const ctx = buildDenaliWizardRuleEvalContext();
    let envelope = setCanonicalValueOnDraft({ data: {} }, "category", "mountain_day");
    envelope = setCanonicalValueOnDraft(envelope, "transport.mode", "train");
    envelope = setCanonicalValueOnDraft(envelope, "transport.allowPersonalCar", true);
    envelope = setCanonicalValueOnDraft(envelope, "transport.dongAmount", "100000");

    const sanitized = sanitizeDenaliWizardDraftEnvelope(envelope, rules, ctx);
    assert.equal(getCanonicalStringFromDraft(sanitized, "transport.dongAmount"), "100000");
  });

  it("clears preserved dongAmount when personal cars are disabled", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const ctx = buildDenaliWizardRuleEvalContext();
    let envelope = setCanonicalValueOnDraft({ data: {} }, "category", "mountain_day");
    envelope = setCanonicalValueOnDraft(envelope, "transport.mode", "train");
    envelope = setCanonicalValueOnDraft(envelope, "transport.allowPersonalCar", true);
    envelope = setCanonicalValueOnDraft(envelope, "transport.dongAmount", "100000");
    envelope = setCanonicalValueOnDraft(envelope, "transport.allowPersonalCar", false);

    const sanitized = sanitizeDenaliWizardDraftEnvelope(envelope, rules, ctx);
    assert.equal(getCanonicalStringFromDraft(sanitized, "transport.dongAmount"), "");
  });
});
