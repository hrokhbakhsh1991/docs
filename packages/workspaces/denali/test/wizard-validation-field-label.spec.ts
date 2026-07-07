import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDenaliWizardValidationFieldLabel } from "../src/ui/adapters/wizard-validation-field-label";

const messages: Record<string, string> = {
  "composites.pricingParticipants.sectionTitle": "Participant requirements",
  "composites.destination.sectionTitle": "Destination",
  "composites.destinationCatalogMetric.peakHeight.sectionTitle": "Peak height (m)",
  "fields.participants.minimumAge": "Minimum age",
};

function mockDenaliTranslator(key: string): string {
  return messages[key] ?? key;
}

describe("resolveDenaliWizardValidationFieldLabel", () => {
  it("DN-VLABEL-01 resolves composite renderer ids via section title", () => {
    assert.equal(
      resolveDenaliWizardValidationFieldLabel({
        canonicalPath: "denali.pricing-participants",
        translateWorkspaceMessage: mockDenaliTranslator,
      }),
      "Participant requirements"
    );
  });

  it("DN-VLABEL-02 resolves canonical leaf paths via fields.*", () => {
    assert.equal(
      resolveDenaliWizardValidationFieldLabel({
        canonicalPath: "participants.minimumAge",
        translateWorkspaceMessage: mockDenaliTranslator,
      }),
      "Minimum age"
    );
  });

  it("DN-VLABEL-04 resolves destination composite ids via section title", () => {
    assert.equal(
      resolveDenaliWizardValidationFieldLabel({
        canonicalPath: "denali.destination",
        translateWorkspaceMessage: mockDenaliTranslator,
      }),
      "Destination"
    );
    assert.equal(
      resolveDenaliWizardValidationFieldLabel({
        canonicalPath: "denali.destination-catalog-metric.peak-height",
        translateWorkspaceMessage: mockDenaliTranslator,
      }),
      "Peak height (m)"
    );
  });

  it("DN-VLABEL-03 returns raw path when no translator is provided", () => {
    assert.equal(
      resolveDenaliWizardValidationFieldLabel({
        canonicalPath: "denali.pricing-participants",
      }),
      "denali.pricing-participants"
    );
  });
});
