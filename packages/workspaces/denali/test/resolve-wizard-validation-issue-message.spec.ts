import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveWizardValidationIssueMessage } from "../src/ui/adapters/resolve-wizard-validation-issue-message";

const translator = {
  has: (key: string) => key === "REQUIRED_FIELD_EMPTY",
  translate: (_key: string, values: { field: string }) => `${values.field} is required by code.`,
  translateWorkspace: (key: string, values?: Record<string, string | number>) =>
    key === "validation.requiredField"
      ? `${String(values?.field)} is required.`
      : `${String(values?.field)} has an invalid value.`,
};

describe("resolveWizardValidationIssueMessage", () => {
  it("prefers a structural validation code", () => {
    assert.equal(
      resolveWizardValidationIssueMessage(
        { path: "title", code: "REQUIRED_FIELD_EMPTY", message: "internal" },
        translator,
        "Title"
      ),
      "Title is required by code."
    );
  });

  it("localizes canonical fallback copy", () => {
    assert.equal(
      resolveWizardValidationIssueMessage(
        { path: "title", message: `No value at canonical path "title"` },
        translator,
        "Title"
      ),
      "Title is required."
    );
  });

  it("does not expose an unknown internal validator message", () => {
    assert.equal(
      resolveWizardValidationIssueMessage(
        { path: "title", message: "private validator detail" },
        translator,
        "Title"
      ),
      "Title has an invalid value."
    );
  });
});
