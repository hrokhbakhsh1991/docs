import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { denaliPrepareDraftEnvelope } from "@app-tour/workspace-denali";

import type { NewTourWizardDraftEnvelope } from "../src/draft/denali-wizard-draft-types";
import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "../src/tours/tour-wizard-draft-path";
import { persistDenaliWizardDraftChange } from "@app-tour/workspace-denali/host/ui/chrome/draft-persist";

function freshEnvelope(sessionId = "sess-persist"): NewTourWizardDraftEnvelope {
  return denaliPrepareDraftEnvelope(emptyTourWizardDraft(), {
    currentStepIndex: 0,
    wizardSessionId: sessionId,
    freshStart: true,
  });
}

describe("denali-wizard-draft-persist.spec.ts", () => {
  it("WEB-WIZ-PERSIST-01 skips setEnvelope when sanitized form is unchanged", () => {
    const envelope = freshEnvelope();
    let setCount = 0;
    persistDenaliWizardDraftChange(envelope.form, {
      getEnvelope: () => envelope,
      setEnvelope: () => {
        setCount += 1;
      },
      denaliRules: null,
      denaliPlugin: null,
      wizardRuleEvalContext: undefined,
    });
    assert.equal(setCount, 0);
  });

  it("WEB-WIZ-PERSIST-02 persists title change onto envelope", () => {
    const envelope = freshEnvelope();
    let last: NewTourWizardDraftEnvelope | null = null;
    const next = setCanonicalStringValue(envelope.form, "title", "تور جدید");
    persistDenaliWizardDraftChange(next, {
      getEnvelope: () => envelope,
      setEnvelope: (prepared) => {
        last = prepared;
      },
      denaliRules: null,
      denaliPlugin: null,
      wizardRuleEvalContext: undefined,
    });
    assert.notEqual(last, null);
    assert.equal(getCanonicalStringValue(last!.form, "title"), "تور جدید");
  });

  it("WEB-WIZ-PERSIST-03 rebases stale incoming onto latest envelope form", () => {
    const envelope = freshEnvelope();
    const latest = setCanonicalStringValue(envelope.form, "title", "Latest title");
    const latestEnvelope = denaliPrepareDraftEnvelope(latest, { ...envelope.meta });
    const staleBase = setCanonicalStringValue(envelope.form, "title", "Stale title");
    const staleEdit = setCanonicalStringValue(staleBase, "title", "Edited title");
    let last: NewTourWizardDraftEnvelope | null = null;
    persistDenaliWizardDraftChange(staleEdit, {
      getEnvelope: () => latestEnvelope,
      setEnvelope: (prepared) => {
        last = prepared;
      },
      denaliRules: null,
      denaliPlugin: null,
      wizardRuleEvalContext: undefined,
    });
    assert.notEqual(last, null);
    assert.equal(getCanonicalStringValue(last!.form, "title"), "Edited title");
  });
});
