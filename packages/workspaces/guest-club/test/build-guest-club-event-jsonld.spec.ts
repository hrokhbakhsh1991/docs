import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGuestClubEventJsonLd } from "../src/catalog/build-guest-club-event-jsonld";

describe("buildGuestClubEventJsonLd", () => {
  it("GC-SEO-01 builds minimal Event JSON-LD", () => {
    const jsonLd = buildGuestClubEventJsonLd({
      id: "tour-1",
      title: "Club tour",
      shortDescription: "Summary",
      category: null,
      departureAt: null,
      endAt: null,
      priceAmount: null,
      priceCurrency: "IRR",
      coverImageUrl: null,
      totalCapacity: null,
      catalogUpdatedAt: "2026-07-01T08:00:00.000Z",
    });
    assert.equal(jsonLd["@type"], "Event");
    assert.equal(jsonLd.name, "Club tour");
    assert.equal(jsonLd.dateModified, "2026-07-01T08:00:00.000Z");
  });
});
