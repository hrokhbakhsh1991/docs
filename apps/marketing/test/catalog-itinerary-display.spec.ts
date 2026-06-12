import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatCatalogItinerarySegmentLine,
  readCatalogItinerarySegmentPhotoUrls,
} from "../src/catalog/catalog-itinerary-display-logic";

describe("catalog-itinerary-display.spec.ts", () => {
  it("MKT-07 formatCatalogItinerarySegmentLine joins time title and location", () => {
    assert.equal(
      formatCatalogItinerarySegmentLine({
        title: "Briefing",
        startTime: "09:00",
        locationLabel: "Base camp",
      }),
      "09:00 — Briefing — Base camp"
    );
    assert.equal(
      formatCatalogItinerarySegmentLine({ title: "Panel" }),
      "Panel"
    );
  });

  it("MKT-08 readCatalogItinerarySegmentPhotoUrls filters blank urls", () => {
    assert.deepEqual(
      readCatalogItinerarySegmentPhotoUrls({
        title: "Hike",
        photoUrls: ["https://cdn.example/a.jpg", "  ", ""],
      }),
      ["https://cdn.example/a.jpg"]
    );
    assert.deepEqual(
      readCatalogItinerarySegmentPhotoUrls({ title: "Rest" }),
      []
    );
  });
});
