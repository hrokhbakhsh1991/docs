import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCatalogListFetchQuery } from "../src/catalog/build-catalog-list-fetch-query";
import { parseCatalogListFilters } from "../src/catalog/catalog-list-query";

describe("build-catalog-list-fetch-query.spec.ts — PR-22", () => {
  it("passes denali server list filters to upstream query", () => {
    const filters = parseCatalogListFilters({
      q: "ridge",
      category: "mountain_multi",
      difficulty: "4",
      fitness: "high",
      availability: "open",
      sort: "departure_asc",
    });
    const query = buildCatalogListFetchQuery({
      pluginId: "denali",
      cursor: "cursor-1",
      limit: 20,
      filters,
    });

    assert.equal(query.get("cursor"), "cursor-1");
    assert.equal(query.get("limit"), "20");
    assert.equal(query.get("q"), "ridge");
    assert.equal(query.get("category"), "mountain_multi");
    assert.equal(query.get("difficulty"), "4");
    assert.equal(query.get("fitness"), "high");
    assert.equal(query.get("availability"), "open");
    assert.equal(query.get("sort"), "departure_asc");
  });

  it("does not pass denali filters for urban (client-only)", () => {
    const filters = parseCatalogListFilters({
      q: "concert",
      category: "event",
      sort: "price_asc",
    });
    const query = buildCatalogListFetchQuery({
      pluginId: "urban",
      city: "Tehran",
      filters,
    });

    assert.equal(query.get("city"), "Tehran");
    assert.equal(query.get("q"), null);
    assert.equal(query.get("category"), null);
    assert.equal(query.get("sort"), null);
  });
});
