import assert from "node:assert/strict";
import test from "node:test";

import { createDenaliFieldLabelResolver } from "@app-tour/workspace-denali/ui/field-label-resolver";

const messages: Record<string, string> = {
  "composites.pricingParticipants.sectionTitle": "Participant requirements",
  "fields.participants.minimumAge": "Minimum age",
};

function mockDenaliTranslator(key: string): string {
  return messages[key] ?? key;
}

const resolver = createDenaliFieldLabelResolver();

test("resolveDenaliValidationIssueLabel resolves composite renderer ids", () => {
  assert.equal(
    resolver.resolveValidationIssueLabel?.(mockDenaliTranslator, "denali.pricing-participants"),
    "Participant requirements"
  );
});

test("resolveDenaliValidationIssueLabel resolves canonical paths", () => {
  assert.equal(
    resolver.resolveValidationIssueLabel?.(mockDenaliTranslator, "participants.minimumAge"),
    "Minimum age"
  );
});
