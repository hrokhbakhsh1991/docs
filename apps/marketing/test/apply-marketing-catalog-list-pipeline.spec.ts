import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyMarketingCatalogListPipeline } from "../src/catalog/apply-marketing-catalog-list-pipeline";
import { parseCatalogListFilters } from "../src/catalog/catalog-list-query";

describe("apply-marketing-catalog-list-pipeline.spec.ts — PR-21.1 / PR-22", () => {
  const items = [
    { id: "1", title: "Late", departureAt: "2026-08-01T08:00:00.000Z", category: "a" },
    { id: "2", title: "Early", departureAt: "2026-07-01T08:00:00.000Z", category: "b" },
  ];

  it("returns matched and fetched counts", async () => {
    const filters = parseCatalogListFilters({ category: "b", sort: "departure_asc" });
    const result = await applyMarketingCatalogListPipeline(items, filters);
    assert.equal(result.fetchedCount, 2);
    assert.equal(result.matchedCount, 1);
    assert.deepEqual(result.items.map((item) => item.id), ["2"]);
  });

  it("applies client filter and sort even when server also handles params", async () => {
    const filters = parseCatalogListFilters({ category: "b", sort: "departure_asc" });
    const serverFilters = ["category", "sort"];
    const result = await applyMarketingCatalogListPipeline(items, filters, serverFilters);
    assert.equal(result.matchedCount, 1);
    assert.deepEqual(result.items.map((item) => item.id), ["2"]);
  });

  it("uses the member payable amount for price filters", async () => {
    const filters = parseCatalogListFilters({ minPrice: "1000000", maxPrice: "1200000" });
    const result = await applyMarketingCatalogListPipeline(
      [
        { id: "member", title: "Member", priceAmount: 2_000_000 },
        { id: "outside", title: "Outside", priceAmount: 1_500_000 },
      ],
      filters,
      [],
      undefined,
      {
        member: {
          grossMinor: "2000000",
          discountableBaseMinor: "2000000",
          memberDiscountPercentage: 50,
          memberDiscountMinor: "1000000",
          payableMinor: "1000000",
          currency: "IRR",
          source: "member_discount",
          lines: [],
        },
      }
    );

    assert.deepEqual(result.items.map((item) => item.id), ["member"]);
  });
});
