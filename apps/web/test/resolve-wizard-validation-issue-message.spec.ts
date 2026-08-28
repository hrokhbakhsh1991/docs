/**
 * Phase 2 — validation issue message i18n (WEB-P11-5-07)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveWizardValidationIssueMessage } from "../src/wizard/resolve-wizard-validation-issue-message";

describe("resolve-wizard-validation-issue-message.spec.ts — Phase 2", () => {
  it("WEB-P11-5-07 prefers translated code over platform message", () => {
    const message = resolveWizardValidationIssueMessage(
      {
        path: "title",
        code: "REQUIRED_FIELD_EMPTY",
        message: 'Required text at "title" is empty',
      },
      {
        has: (key) => key === "REQUIRED_FIELD_EMPTY",
        translate: (key, values) => `${values.field} (translated:${key})`,
      },
      "Tour title"
    );
    assert.equal(message, "Tour title (translated:REQUIRED_FIELD_EMPTY)");
  });

  it("maps missing canonical-path platform copy to required-field text", () => {
    const message = resolveWizardValidationIssueMessage(
      {
        path: "participants.minimumAge",
        code: "UNKNOWN_CANONICAL_PATH",
        message: 'No value at canonical path "participants.minimumAge"',
      },
      {
        has: (key) => key === "REQUIRED_FIELD_EMPTY",
        translate: (key, values) => `${values.field} (translated:${key})`,
      },
      "Minimum age"
    );
    assert.equal(message, "Minimum age (translated:REQUIRED_FIELD_EMPTY)");
  });

  it("falls back to violation.message when code has no translation", () => {
    const message = resolveWizardValidationIssueMessage(
      {
        path: "title",
        code: "UNKNOWN_CODE",
        message: "Hardcoded fallback",
      },
      {
        has: () => false,
        translate: () => "unused",
      },
      "Tour title"
    );
    assert.equal(message, "Hardcoded fallback");
  });

  it("falls back when code is missing", () => {
    const message = resolveWizardValidationIssueMessage(
      {
        path: "title",
        message: "Legacy message only",
      },
      {
        has: () => true,
        translate: () => "unused",
      },
      "Tour title"
    );
    assert.equal(message, "Legacy message only");
  });
});
