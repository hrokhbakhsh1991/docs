import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sortMarketingCatalogItems } from "../src/catalog/sort-marketing-catalog-items";

describe("sort-marketing-catalog-items.spec.ts — PR-21", () => {
  const items = [
    {
      id: "a",
      title: "Late",
      departureAt: "2026-08-01T08:00:00.000Z",
      priceAmount: 500,
      difficultyLevel: 3,
    },
    {
      id: "b",
      title: "Early",
      departureAt: "2026-07-01T08:00:00.000Z",
      priceAmount: 200,
      difficultyLevel: 1,
    },
    {
      id: "c",
      title: "Mid",
      departureAt: "2026-07-15T08:00:00.000Z",
      priceAmount: 800,
      difficultyLevel: 5,
    },
  ];

  it("preserves API order for newest", () => {
    assert.deepEqual(
      sortMarketingCatalogItems(items, "newest").map((item) => item.id),
      ["a", "b", "c"]
    );
  });

  it("sorts by departure ascending", () => {
    assert.deepEqual(
      sortMarketingCatalogItems(items, "departure_asc").map((item) => item.id),
      ["b", "c", "a"]
    );
  });

  it("sorts by price descending", () => {
    assert.deepEqual(
      sortMarketingCatalogItems(items, "price_desc").map((item) => item.id),
      ["c", "a", "b"]
    );
  });

  it("BUG-STG-081 sorts by the member payable amount when a preview exists", () => {
    const result = sortMarketingCatalogItems(
      [
        { id: "base-low", title: "Base low", priceAmount: 1_500_000 },
        { id: "member-low", title: "Member low", priceAmount: 2_000_000 },
      ],
      "price_asc",
      {
        "member-low": {
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

    assert.deepEqual(result.map((item) => item.id), ["member-low", "base-low"]);
  });

  it("BUG-STG-081 fails closed when an authenticated preview is missing", () => {
    const items = [
      { id: "member-tour", title: "Member tour", priceAmount: 1_000_000 },
      { id: "public-tour", title: "Public tour", priceAmount: 2_000_000 },
    ];
    const sorted = sortMarketingCatalogItems(
      items,
      "price_asc",
      {
        "public-tour": {
          grossMinor: "2000000",
          discountableBaseMinor: "2000000",
          memberDiscountPercentage: 0,
          memberDiscountMinor: "0",
          payableMinor: "2000000",
          currency: "IRR",
          source: "tour_canonical",
          lines: [],
        },
      },
      "partial"
    );
    assert.deepEqual(sorted.map((item) => item.id), ["public-tour", "member-tour"]);
  });

  it("BUG-STG-027 sorts free collection as price zero", () => {
    const result = sortMarketingCatalogItems(
      [
        ...items,
        {
          id: "free",
          title: "Free walk",
          paymentCollection: "free",
          priceAmount: null,
        },
      ],
      "price_asc"
    );

    assert.deepEqual(
      result.map((item) => item.id),
      ["free", "b", "a", "c"]
    );
    assert.deepEqual(
      sortMarketingCatalogItems(
        [
          ...items,
          {
            id: "free",
            title: "Free walk",
            paymentCollection: "free",
            priceAmount: null,
          },
        ],
        "price_desc"
      ).map((item) => item.id),
      ["c", "a", "b", "free"]
    );
  });

  it("sorts by difficulty ascending", () => {
    assert.deepEqual(
      sortMarketingCatalogItems(items, "difficulty_asc").map((item) => item.id),
      ["b", "a", "c"]
    );
  });
});
