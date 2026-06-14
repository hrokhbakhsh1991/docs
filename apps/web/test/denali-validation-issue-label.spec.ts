import assert from "node:assert/strict";
import test from "node:test";

import { resolveDenaliValidationIssueLabel } from "../src/wizard/denali/denali-validation-issue-label";

const messages: Record<string, string> = {
  "composites.pricingParticipants.sectionTitle": "Participant requirements",
  "fields.participants.minimumAge": "Minimum age",
};

function mockDenaliTranslator(key: string): string {
  return messages[key] ?? key;
}

test("resolveDenaliValidationIssueLabel resolves composite renderer ids", () => {
  assert.equal(
    resolveDenaliValidationIssueLabel(mockDenaliTranslator, "denali.pricing-participants"),
    "Participant requirements"
  );
});

test("resolveDenaliValidationIssueLabel resolves canonical paths", () => {
  assert.equal(
    resolveDenaliValidationIssueLabel(mockDenaliTranslator, "participants.minimumAge"),
    "Minimum age"
  );
});
