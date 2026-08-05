import assert from "node:assert/strict";
import { test } from "node:test";

import { localizeDenaliValidationIssueMessage } from "../src/wizard/localize-denali-validation-message.ts";

const MESSAGES: Record<string, string> = {
  "validation.requiredField": "{field} is required.",
  "validation.invalidNumber": "{field} must be a valid number.",
  "validation.invalidBoolean": "{field} must be true or false.",
  "validation.invalidText": "{field} must be text.",
  "validation.invalidValue": "{field} has an invalid value.",
};

function t(key: string, values?: Record<string, string | number>): string {
  const template = MESSAGES[key] ?? key;
  if (values == null) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ""));
}

test("localizeDenaliValidationIssueMessage maps missing canonical path", () => {
  assert.equal(
    localizeDenaliValidationIssueMessage(
      t,
      'No value at canonical path "title"',
      "Title"
    ),
    "Title is required."
  );
});

test("localizeDenaliValidationIssueMessage maps number type mismatch", () => {
  assert.equal(
    localizeDenaliValidationIssueMessage(
      t,
      'Canonical path "capacityMax" expects kind "number" but got object',
      "Capacity"
    ),
    "Capacity must be a valid number."
  );
});

test("localizeDenaliValidationIssueMessage does not expose unknown platform copy", () => {
  assert.equal(
    localizeDenaliValidationIssueMessage(t, "Internal validator detail", "Capacity"),
    "Capacity has an invalid value."
  );
});
