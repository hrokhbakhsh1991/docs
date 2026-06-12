import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveWizardValidationFieldLabel } from "../src/wizard/wizard-validation-field-label";

describe("wizard-validation-field-label.spec.ts", () => {
  it("WEB-12-9-01 falls back to canonical path without label surface", () => {
    assert.equal(
      resolveWizardValidationFieldLabel({ canonicalPath: "basics.title" }),
      "basics.title"
    );
  });
});
