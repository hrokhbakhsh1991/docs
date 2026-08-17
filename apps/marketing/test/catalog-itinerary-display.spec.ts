import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

import {
  formatCatalogItinerarySegmentLine,
  readCatalogItinerarySegmentPhotoUrls,
} from "../src/catalog/catalog-itinerary-display-logic";

describe("catalog-itinerary-display.spec.ts", () => {
  it("MKT-07 formatCatalogItinerarySegmentLine joins time title and location", () => {
    assert.equal(
      formatCatalogItinerarySegmentLine(
        {
          title: "Briefing",
          startTime: "09:00",
          locationLabel: "Base camp",
        },
        "en"
      ),
      "09:00 — Briefing — Base camp"
    );
    assert.equal(
      formatCatalogItinerarySegmentLine({ title: "Panel" }, "en"),
      "Panel"
    );
  });

  it("MKT-07b fa itinerary segment line uses Persian digits", () => {
    assert.equal(
      formatCatalogItinerarySegmentLine(
        {
          title: "جلسه",
          startTime: "09:30",
          locationLabel: "پایگاه",
        },
        "fa"
      ),
      "۰۹:۳۰ — جلسه — پایگاه"
    );
  });

  it("MKT-08 readCatalogItinerarySegmentPhotoUrls drops smoke placeholders", () => {
    assert.deepEqual(
      readCatalogItinerarySegmentPhotoUrls({
        title: "Hike",
        photoUrls: [
          "https://cdn.example/a.jpg",
          "https://cdn.example.com/reachable.jpg",
          "  ",
          "",
        ],
      }),
      ["https://cdn.example.com/reachable.jpg"]
    );
    assert.deepEqual(
      readCatalogItinerarySegmentPhotoUrls({ title: "Rest" }),
      []
    );
    assert.deepEqual(
      readCatalogItinerarySegmentPhotoUrls({
        title: "Smoke only",
        photoUrls: ["https://cdn.example/operator-smoke-cover.jpg"],
      }),
      []
    );
  });

  it("MKT-09 catalog itinerary empty copy does not invent photos", () => {
    const src = readFileSync(
      new URL("../src/catalog/catalog-itinerary-section.tsx", import.meta.url),
      "utf8"
    );
    assert.match(src, /data-marketing-catalog-segment-photos-empty/);
    assert.match(src, /segmentPhotosEmpty/);
    assert.match(src, /role="status"/);
    const fa = JSON.parse(
      readFileSync(new URL("../messages/fa/catalog.json", import.meta.url), "utf8")
    ) as { detail: { itinerarySegmentPhotosEmpty: string } };
    const en = JSON.parse(
      readFileSync(new URL("../messages/en/catalog.json", import.meta.url), "utf8")
    ) as { detail: { itinerarySegmentPhotosEmpty: string } };
    assert.match(fa.detail.itinerarySegmentPhotosEmpty, /برنامه روزانه/);
    assert.match(en.detail.itinerarySegmentPhotosEmpty, /program section/i);
    assert.equal(/ذخیره|wizard|save/i.test(fa.detail.itinerarySegmentPhotosEmpty), false);
    assert.equal(/save|wizard/i.test(en.detail.itinerarySegmentPhotosEmpty), false);
  });

  it("MKT-08b itinerary photo reader uses the shared unreachable-host filter", () => {
    const src = readFileSync(
      new URL("../src/catalog/catalog-itinerary-display-logic.ts", import.meta.url),
      "utf8"
    );
    assert.match(src, /resolveMarketingCatalogPhotoUrl/);
  });
});
