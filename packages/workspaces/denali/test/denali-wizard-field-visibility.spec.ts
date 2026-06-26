import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyDenaliTourWizardDraft,
  setCanonicalStringValue,
} from "../src/draft/denali-tour-wizard-draft";
import { buildDenaliWizardRuleEvalContext } from "../src/wizard/denali-wizard-rule-eval-context";
import { isDenaliWizardFieldVisibleOnDraft } from "../src/wizard/denali-wizard-field-visibility";

describe("denali-wizard-field-visibility.spec.ts", () => {
  it("DN-VIS-01 returns false when tour kind is not classified", () => {
    const draft = emptyDenaliTourWizardDraft();
    assert.equal(
      isDenaliWizardFieldVisibleOnDraft(draft, "tripDetails.overview.peakHeight", "denali_basic"),
      false
    );
  });

  it("DN-VIS-02 matches evaluateFormFieldRule for mountain peak height", () => {
    const draft = setCanonicalStringValue(emptyDenaliTourWizardDraft(), "category", "mountain_day");
    assert.equal(
      isDenaliWizardFieldVisibleOnDraft(draft, "tripDetails.overview.peakHeight", "denali_basic"),
      true
    );
  });

  it("DN-VIS-03 gates socialMediaLink on telegramIntegrationActive", () => {
    const draft = setCanonicalStringValue(emptyDenaliTourWizardDraft(), "category", "mountain_day");
    const activeCtx = buildDenaliWizardRuleEvalContext({ telegramIntegrationActive: true });
    const inactiveCtx = buildDenaliWizardRuleEvalContext({ telegramIntegrationActive: false });
    const defaultCtx = buildDenaliWizardRuleEvalContext();

    assert.equal(
      isDenaliWizardFieldVisibleOnDraft(draft, "socialMediaLink", "denali_basic", activeCtx),
      true
    );
    assert.equal(
      isDenaliWizardFieldVisibleOnDraft(draft, "socialMediaLink", "denali_basic", inactiveCtx),
      false
    );
    assert.equal(
      isDenaliWizardFieldVisibleOnDraft(draft, "socialMediaLink", "denali_basic", defaultCtx),
      true
    );
  });
});
