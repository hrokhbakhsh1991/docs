import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isUnresolvedDenaliTranslation,
  resolveDenaliFieldLabel,
} from "../src/ui/adapters/field-labels";
import { resolveDenaliWizardValidationFieldLabel } from "../src/ui/adapters/wizard-validation-field-label";

const messages: Record<string, string> = {
  "composites.pricingParticipants.sectionTitle": "Participant requirements",
  "composites.destination.sectionTitle": "Destination",
  "composites.destinationCatalogMetric.peakHeight.sectionTitle": "Peak height (m)",
  "composites.datetime.sectionTitle": "Tour date and time",
  "composites.itinerary.sectionTitle": "Day-by-day itinerary",
  "composites.itinerary.dayTitle": "Day title",
  "composites.itinerary.daySummary": "Day summary",
  "composites.itinerary.segmentsHeading": "Segments",
  "fields.participants.minimumAge": "Minimum age",
  "fields.destinationId": "Destination",
  "fields.startDateTime": "Start date & time",
  "fields.program.itinerary": "Day-by-day itinerary",
};

function mockDenaliTranslator(key: string): string {
  return messages[key] ?? key;
}

/** Mimics next-intl missing-key echo under useTranslations("denali"). */
function echoNamespacedTranslator(key: string): string {
  if (messages[key] !== undefined) {
    return messages[key]!;
  }
  return `denali.${key}`;
}

describe("resolveDenaliWizardValidationFieldLabel", () => {
  it("DN-VLABEL-01 prefers leaf over composite sectionTitle (INV-DENALI-WIZ-018)", () => {
    assert.equal(
      resolveDenaliWizardValidationFieldLabel({
        canonicalPath: "denali.pricing-participants",
        translateWorkspaceMessage: mockDenaliTranslator,
      }),
      "Minimum age"
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

  it("DN-VLABEL-04 resolves destination composite ids via leaf map", () => {
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

  it("DN-VLABEL-05 resolves the datetime composite via startDateTime leaf (INV-DENALI-WIZ-018)", () => {
    assert.equal(
      resolveDenaliWizardValidationFieldLabel({
        canonicalPath: "denali.datetime",
        translateWorkspaceMessage: mockDenaliTranslator,
      }),
      "Start date & time"
    );
  });

  it("DN-VLABEL-06 resolves itinerary composite via leaf fields.program.itinerary (INV-DENALI-WIZ-009/018)", () => {
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

  it("DN-VLABEL-08 rejects denali.fields.* next-intl echoes (ED-VAL-01)", () => {
    assert.equal(
      isUnresolvedDenaliTranslation(
        "fields.programNature.itinerary.2.title",
        "denali.fields.programNature.itinerary.2.title"
      ),
      true
    );
    assert.equal(
      resolveDenaliFieldLabel(echoNamespacedTranslator, "programNature.itinerary.2.title"),
      "Day title"
    );
    assert.equal(
      resolveDenaliWizardValidationFieldLabel({
        canonicalPath: "programNature.itinerary.2.segments.0.title",
        translateWorkspaceMessage: echoNamespacedTranslator,
      }),
      "Day title"
    );
  });

  it("DN-VLABEL-09 maps programNature itinerary leaf to program.itinerary when present", () => {
    assert.equal(
      resolveDenaliWizardValidationFieldLabel({
        canonicalPath: "programNature.itinerary",
        translateWorkspaceMessage: mockDenaliTranslator,
      }),
      "Day-by-day itinerary"
    );
  });
});
