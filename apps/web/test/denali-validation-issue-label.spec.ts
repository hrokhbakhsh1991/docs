import assert from "node:assert/strict";
import test from "node:test";

import { createDenaliFieldLabelResolver } from "@app-tour/workspace-denali/host/ui/field-label-resolver";

const messages: Record<string, string> = {
  "composites.pricingParticipants.sectionTitle": "Participant requirements",
  "fields.participants.minimumAge": "Minimum age",
};

function mockDenaliTranslator(key: string): string {
  return messages[key] ?? key;
}

const resolver = createDenaliFieldLabelResolver();

test("resolveDenaliValidationIssueLabel prefers leaf over sectionTitle (INV-DENALI-WIZ-018)", () => {
  assert.equal(
    resolver.resolveValidationIssueLabel?.(mockDenaliTranslator, "denali.pricing-participants"),
    "Minimum age"
  );
});

test("resolveDenaliValidationIssueLabel resolves canonical paths", () => {
  assert.equal(
    resolver.resolveValidationIssueLabel?.(mockDenaliTranslator, "participants.minimumAge"),
    "Minimum age"
  );
});
