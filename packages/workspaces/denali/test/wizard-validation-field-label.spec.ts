import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDenaliWizardValidationFieldLabel } from "../src/ui/adapters/wizard-validation-field-label";

const messages: Record<string, string> = {
  "composites.pricingParticipants.sectionTitle": "Participant requirements",
  "composites.destination.sectionTitle": "Destination",
  "composites.destinationCatalogMetric.peakHeight.sectionTitle": "Peak height (m)",
  "composites.datetime.sectionTitle": "Tour date and time",
  "composites.itinerary.sectionTitle": "Day-by-day itinerary",
  "fields.participants.minimumAge": "Minimum age",
  "fields.program.itinerary": "Day-by-day itinerary",
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

  it("DN-VLABEL-05 resolves the datetime composite through its catalog key", () => {
    assert.equal(
      resolveDenaliWizardValidationFieldLabel({
        canonicalPath: "denali.datetime",
        translateWorkspaceMessage: mockDenaliTranslator,
      }),
      "Tour date and time"
    );
  });

  it("DN-VLABEL-06 resolves itinerary composite via sectionTitle (INV-DENALI-WIZ-009)", () => {
    assert.equal(
      resolveDenaliWizardValidationFieldLabel({
        canonicalPath: "denali.itinerary",
        translateWorkspaceMessage: mockDenaliTranslator,
      }),
      "Day-by-day itinerary"
    );
  });

  it("DN-VLABEL-07 rejects namespaced missing-key echoes for sectionTitle", () => {
    assert.equal(
      resolveDenaliWizardValidationFieldLabel({
        canonicalPath: "denali.gear",
        translateWorkspaceMessage: (key) => {
          if (key === "composites.gear.sectionTitle") {
            return "denali.composites.gear.sectionTitle";
          }
          if (key === "fields.participants.gearItems") {
            return "Required gear";
          }
          return key;
        },
      }),
      "Required gear"
    );
  });
});
