import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyDenaliTourWizardDraft,
  setCanonicalStringValue,
} from "../src/draft/denali-tour-wizard-draft";
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
});
