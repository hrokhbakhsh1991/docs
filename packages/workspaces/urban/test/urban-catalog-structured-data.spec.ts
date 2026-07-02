import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildUrbanEventJsonLd } from "../src/catalog/build-urban-event-jsonld";
import { toUrbanPublicCatalogCard } from "../src/catalog/urban-public-catalog-surface";
import { applyUrbanCatalogCardExposure } from "../src/catalog/urban-catalog-exposure-bindings";

describe("urban catalog structured data", () => {
  const tour = {
    id: "tour-1",
    canonical: {
      schemaVersion: 1,
      roots: ["tour"],
      data: {
        tour: {
          title: "City walk",
          city: "Tehran",
          venueName: "Azadi Tower",
          startDate: "2026-08-01",
          endDate: "2026-08-02",
          catalogSummary: "Evening stroll",
          coverImageUrl: "https://cdn.example/cover.jpg",
          publishedAt: "2026-07-15T10:00:00.000Z",
          publishStatus: "published",
        },
      },
    },
    catalogUpdatedAt: "2026-07-10T08:00:00.000Z",
  };

  it("UR-SEO-01 toUrbanPublicCatalogCard attaches Event JSON-LD", () => {
    const card = toUrbanPublicCatalogCard(tour);
    assert.equal(card.structuredData?.["@type"], "Event");
    const location = card.structuredData?.location as { name?: string } | undefined;
    assert.match(location?.name ?? "", /Tehran/);
    assert.equal(card.catalogUpdatedAt, "2026-07-10T08:00:00.000Z");
  });

  it("UR-SEO-02 buildUrbanEventJsonLd includes schedule and image", () => {
    const card = toUrbanPublicCatalogCard(tour);
    const jsonLd = buildUrbanEventJsonLd(card);
    assert.equal(jsonLd.startDate, "2026-08-01");
    assert.equal(jsonLd.endDate, "2026-08-02");
    assert.equal(jsonLd.image, "https://cdn.example/cover.jpg");
    assert.equal(jsonLd.eventStatus, "https://schema.org/EventScheduled");
    assert.equal(jsonLd.eventAttendanceMode, "https://schema.org/OfflineEventAttendanceMode");
  });

  it("UR-SEO-03 removes structured data when title is hidden", () => {
    const card = toUrbanPublicCatalogCard(tour);
    const redacted = applyUrbanCatalogCardExposure(card, new Set(["tour.city"]));
    assert.equal("structuredData" in redacted, false);
  });
});
