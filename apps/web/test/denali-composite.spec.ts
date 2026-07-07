/**
 * Denali wizard location composite helpers
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import {
  getCanonicalValue,
  setCanonicalValue,
} from "../src/tours/tour-wizard-draft-path";
import {
  isDenaliCompositeImplemented,
  DENALI_IMPLEMENTED_COMPOSITE_IDS,
} from "@app-tour/workspace-denali/ui/composite-ids";
import { parseDenaliGearItems } from "@app-tour/workspace-denali/ui/logic/denali-gear-types";
import {
  parseDenaliGatheringPoints,
  parseDenaliLocationData,
} from "@app-tour/workspace-denali/ui/logic/denali-location-types";

describe("denali-composite.spec.ts", () => {
  it("WEB-DENALI-COMP-01 exposes implemented location composite ids", () => {
    assert.deepEqual(DENALI_IMPLEMENTED_COMPOSITE_IDS, [
      "denali.tour-kind-basics",
      "denali.destination",
      "denali.datetime",
      "denali.datetime-end",
      "denali.location-zones",
      "denali.gathering-points",
      "denali.transport-mode",
      "denali.difficulty-level",
      "denali.elevation-gain",
      "denali.destination-catalog-metric.peak-height",
      "denali.destination-catalog-metric.trail-distance",
      "denali.gear",
      "denali.program-content",
      "denali.peak-experience",
      "denali.pricing-payment",
      "denali.pricing-participants",
      "denali.approximate-return-time",
      "denali.leader-user-ids",
      "denali.social-media-link",
      "denali.guide-language-ids",
      "denali.custom-services",
      "denali.tour-services",
      "denali.photos",
      "denali.itinerary",
    ]);
    assert.equal(isDenaliCompositeImplemented("denali.leader-user-ids"), true);
    assert.equal(isDenaliCompositeImplemented("denali.custom-services"), true);
    assert.equal(isDenaliCompositeImplemented("denali.tour-services"), true);
    assert.equal(isDenaliCompositeImplemented("denali.approximate-return-time"), true);
  });

  it("WEB-DENALI-COMP-02 parses location and gathering point payloads", () => {
    assert.deepEqual(
      parseDenaliLocationData({
        label: "Base camp",
        latitude: 35.1,
        longitude: 51.2,
      }),
      { label: "Base camp", latitude: 35.1, longitude: 51.2 }
    );
    assert.deepEqual(
      parseDenaliGatheringPoints([
        { name: "Parking", latitude: 35, longitude: 51, isPrimary: true },
      ]),
      [{ name: "Parking", latitude: 35, longitude: 51, isPrimary: true }]
    );
  });

  it("WEB-DENALI-COMP-04 parses gear item payloads", () => {
    assert.deepEqual(
      parseDenaliGearItems([{ equipmentId: "eq-1", name: "Ice axe", isRequired: true }]),
      [{ equipmentId: "eq-1", name: "Ice axe", isRequired: true }]
    );
    assert.deepEqual(
      parseDenaliGearItems([{ equipmentId: "eq-2", name: "Rope", isRequired: false }]),
      [{ equipmentId: "eq-2", name: "Rope", isRequired: false }]
    );
    assert.deepEqual(parseDenaliGearItems([{ equipmentId: "eq-3", name: "Helmet" }]), [
      { equipmentId: "eq-3", name: "Helmet", isRequired: true },
    ]);
  });

  it("WEB-DENALI-COMP-03 writes nested gathering points on draft", () => {
    const draft = emptyTourWizardDraft();
    const next = setCanonicalValue(draft, "tripDetails.logistics.gatheringPoints", [
      { name: "Main gate", latitude: 35.7, longitude: 51.4, isPrimary: true },
    ]);
    const stored = parseDenaliGatheringPoints(
      getCanonicalValue(next, "tripDetails.logistics.gatheringPoints")
    );
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.name, "Main gate");
  });

  it("WEB-DENALI-COMP-05 writes tour service buckets on draft", () => {
    const draft = emptyTourWizardDraft();
    let next = setCanonicalValue(draft, "tripDetails.logistics.includedServices", ["صبحانه"]);
    next = setCanonicalValue(next, "tripDetails.logistics.excludedServices", ["ناهار"]);
    assert.deepEqual(getCanonicalValue(next, "tripDetails.logistics.includedServices"), ["صبحانه"]);
    assert.deepEqual(getCanonicalValue(next, "tripDetails.logistics.excludedServices"), ["ناهار"]);
  });
});
