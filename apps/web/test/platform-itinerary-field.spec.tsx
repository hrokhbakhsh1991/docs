import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { getCanonicalValue } from "../src/tours/tour-wizard-draft-path";
import {
  appendPlatformItineraryDay,
  parsePlatformItineraryData,
} from "../src/wizard/platform/platform-itinerary-types";
import { resolvePlatformCompositeRenderer } from "../src/wizard/platform/platform-composite-renderers";
import { setCanonicalValue } from "../src/tours/tour-wizard-draft-path";

describe("platform.itinerary composite (P3-B-N-008)", () => {
  it("IT-01 registry resolves platform.itinerary", () => {
    const renderer = resolvePlatformCompositeRenderer("platform.itinerary");
    assert.equal(typeof renderer, "function");
  });

  it("IT-02 adding day mutates draft canonical path", () => {
    const canonicalPath = "itinerary.days";
    const draft = emptyTourWizardDraft();
    assert.deepEqual(parsePlatformItineraryData(getCanonicalValue(draft, canonicalPath)).days, []);

    const nextItinerary = appendPlatformItineraryDay(parsePlatformItineraryData(undefined));
    const nextDraft = setCanonicalValue(draft, canonicalPath, {
      days: nextItinerary.days.map((day) => ({
        dayIndex: day.dayIndex,
        title: day.title ?? "",
        segments: (day.segments ?? []).map((segment) => ({
          destination: segment.destination ?? "",
          notes: segment.notes ?? "",
        })),
      })),
    });

    const parsed = parsePlatformItineraryData(getCanonicalValue(nextDraft, canonicalPath));
    assert.equal(parsed.days.length, 1);
    assert.equal(parsed.days[0]?.dayIndex, 1);
  });
});
