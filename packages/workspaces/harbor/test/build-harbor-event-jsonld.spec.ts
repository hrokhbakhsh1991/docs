import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildHarborEventJsonLd } from "../src/catalog/build-harbor-event-jsonld";

describe("buildHarborEventJsonLd", () => {
  it("DG-4.7 builds minimal Event JSON-LD", () => {
    const jsonLd = buildHarborEventJsonLd({
      id: "t1",
      title: "Harbor evening sail",
      shortDescription: "Waterfront",
      category: "city_sail",
      departureAt: null,
      endAt: null,
      priceAmount: null,
      priceCurrency: "IRR",
      coverImageUrl: null,
      totalCapacity: null,
      catalogUpdatedAt: "2026-07-31T12:00:00.000Z",
    });
    assert.equal(jsonLd["@type"], "Event");
    assert.equal(jsonLd.name, "Harbor evening sail");
    assert.equal(jsonLd.eventStatus, "https://schema.org/EventScheduled");
    assert.equal(jsonLd.dateModified, "2026-07-31T12:00:00.000Z");
  });
});
