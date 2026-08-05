import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveWizardValidationHeadingKey } from "../src/wizard-surface-contracts.js";

describe("wizard-surface-contracts.spec.ts", () => {
  it("defaults missing heading to create/submit copy", () => {
    assert.equal(resolveWizardValidationHeadingKey(undefined), "review.validationHeading");
  });

  it("preserves explicit step-nav heading", () => {
    assert.equal(
      resolveWizardValidationHeadingKey("review.stepValidationHeading"),
      "review.stepValidationHeading"
    );
  });
});
