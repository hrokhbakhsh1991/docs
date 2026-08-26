import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { denaliPrepareDraftEnvelope } from "../src/draft/denali-wizard-draft-binding";
import { emptyDenaliTourWizardDraft, getCanonicalStringValue, setCanonicalStringValue } from "../src/draft/denali-tour-wizard-draft";
import { buildDenaliWizardStepChangeFromLatestRef } from "../src/ui/logic/denali-wizard-step-change";

describe("denali-wizard-step-change.spec.ts", () => {
  it("DN-WIZ-STEP-01 uses latest envelope ref when advancing step", () => {
    const base = denaliPrepareDraftEnvelope(emptyDenaliTourWizardDraft(), {
      currentStepIndex: 0,
      wizardSessionId: "sess-step",
    });
    const latestForm = setCanonicalStringValue(base.form, "title", "Latest title");
    const latest = denaliPrepareDraftEnvelope(latestForm, { ...base.meta });
    let current = base;

    const prepared = buildDenaliWizardStepChangeFromLatestRef(
      () => current,
      1,
      denaliPrepareDraftEnvelope
    );

    assert.notEqual(prepared, null);
    assert.equal(prepared!.meta.currentStepIndex, 1);
    assert.equal(getCanonicalStringValue(prepared!.form, "title"), "");

    current = latest;
    const rebased = buildDenaliWizardStepChangeFromLatestRef(
      () => current,
      1,
      denaliPrepareDraftEnvelope
    );

    assert.notEqual(rebased, null);
    assert.equal(rebased!.meta.currentStepIndex, 1);
    assert.equal(getCanonicalStringValue(rebased!.form, "title"), "Latest title");
  });

  it("DN-WIZ-STEP-02 no-op when step index unchanged", () => {
    const envelope = denaliPrepareDraftEnvelope(emptyDenaliTourWizardDraft(), {
      currentStepIndex: 2,
      wizardSessionId: "sess-step",
    });
    const prepared = buildDenaliWizardStepChangeFromLatestRef(
      () => envelope,
      2,
      denaliPrepareDraftEnvelope
    );
    assert.equal(prepared, null);
  });
});
