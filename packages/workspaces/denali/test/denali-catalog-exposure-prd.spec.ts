import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toDenaliCatalogCard } from "../src/catalog/denali-catalog-card";
import { applyDenaliCatalogCardExposure } from "../src/catalog/denali-catalog-exposure-bindings";

describe("applyDenaliCatalogCardExposure PR-D", () => {
  it("DN-EXP-PRD-01 meetingPoint redaction clears logistics without itinerary", () => {
    const card = toDenaliCatalogCard({
      id: "tour-1",
      canonical: {
        schemaVersion: 1,
        data: {
          title: "Alpine trek",
          publishStatus: "active",
          startDateTime: "2026-07-01T08:00:00.000Z",
          capacityMax: 12,
          meetingPoint: "Base camp",
          program: {
            shortDescription: "Short",
            difficultyLevel: 5,
            itinerary: [
              {
                dayNumber: 1,
                title: "Day 1",
                segments: [{ id: "s1", title: "Hike", kind: "activity" }],
              },
            ],
          },
          participants: { fitnessLevel: "medium" },
          transport: { mode: "bus" },
          pricing: { basePricePerPerson: 1000 },
        },
      },
    });

    assert.equal(card.meetingPointText, "Base camp");

    const redacted = applyDenaliCatalogCardExposure(
      card,
      new Set(["title", "denali.datetime"]),
    );
    assert.equal(redacted.meetingPointText, null);
    assert.equal(redacted.gatheringPoint, null);
    assert.equal(redacted.itineraryDays?.length, 1);
    const itinerary = (redacted.structuredData as { itinerary?: { itemListElement?: unknown[] } })
      ?.itinerary;
    assert.equal(itinerary?.itemListElement?.length, 1);
  });

  it("DN-EXP-PRD-02 photo exposure redaction clears gallery fields and JSON-LD image", () => {
    const card = toDenaliCatalogCard({
      id: "tour-1",
      canonical: {
        schemaVersion: 1,
        data: {
          title: "Alpine trek",
          publishStatus: "active",
          startDateTime: "2026-07-01T08:00:00.000Z",
          capacityMax: 12,
          photos: [
            { url: "https://cdn.example/cover.jpg" },
            { url: "https://cdn.example/gallery-2.jpg" },
          ],
          pricing: { basePricePerPerson: 1000 },
        },
      },
    });

    assert.equal(card.coverImageUrl, "https://cdn.example/cover.jpg");
    assert.equal(card.photoUrls?.length, 2);

    const redacted = applyDenaliCatalogCardExposure(
      card,
      new Set(["title", "denali.datetime"]),
    );
    assert.equal(redacted.coverImageUrl, null);
    assert.equal("photoUrls" in redacted, false);
    assert.equal(
      (redacted.structuredData as { image?: string } | undefined)?.image,
      undefined,
    );
  });
});
