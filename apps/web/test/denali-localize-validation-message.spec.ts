import assert from "node:assert/strict";
import { before, test } from "node:test";

import {
  ensureDenaliHostAdapters,
  localizeDenaliValidationIssueMessage,
} from "../src/bootstrap/workspace-host-adapters.generated";

const messages: Record<string, string> = {
  "validation.requiredField": "{field} is required.",
  "validation.invalidNumber": "{field} must be a valid number.",
};

function t(key: string, values?: Record<string, string | number>): string {
  const template = messages[key] ?? key;
  if (values === undefined) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, token: string) => String(values[token] ?? ""));
}

before(async () => {
  await ensureDenaliHostAdapters();
});

test("localizeDenaliValidationIssueMessage maps missing canonical path", () => {
  assert.equal(
    localizeDenaliValidationIssueMessage(
      t,
      'No value at canonical path "tripDetails.overview.peakHeight"',
      "Peak height"
    ),
    "Peak height is required."
  );
});

test("localizeDenaliValidationIssueMessage maps number type mismatch", () => {
  assert.equal(
    localizeDenaliValidationIssueMessage(
      t,
      'Canonical path "capacityMax" expects kind "number" but got object',
      "Max capacity"
    ),
    "Max capacity must be a valid number."
  );
});
