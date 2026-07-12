import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCatalogListHref,
  buildCatalogListQueryWithoutFilters,
  catalogFiltersToQueryInput,
  catalogListHasActiveFilters,
  catalogListHasClientFilters,
  parseCatalogListFilters,
  resolveCatalogListFetchLimit,
} from "../src/catalog/catalog-list-query";

describe("catalog-list-query.spec.ts — PR-21.1", () => {
  it("widens fetch limit only when narrowing filters are client-side", () => {
    const denaliServerFilters = [
      "q",
      "category",
      "difficulty",
      "fitness",
      "availability",
      "sort",
    ] as const;

    assert.equal(resolveCatalogListFetchLimit(parseCatalogListFilters({})), 20);
    assert.equal(resolveCatalogListFetchLimit(parseCatalogListFilters({ q: "damavand" })), 50);
    assert.equal(
      resolveCatalogListFetchLimit(parseCatalogListFilters({ q: "damavand" }), [
        ...denaliServerFilters,
      ]),
      20
    );
    assert.equal(
      resolveCatalogListFetchLimit(parseCatalogListFilters({ category: "mountain" }), [
        ...denaliServerFilters,
      ]),
      20
    );
    assert.equal(
      resolveCatalogListFetchLimit(parseCatalogListFilters({ category: "mountain" })),
      50
    );
    assert.equal(
      resolveCatalogListFetchLimit(parseCatalogListFilters({ sort: "price_asc" })),
      20
    );
    assert.equal(
      resolveCatalogListFetchLimit(parseCatalogListFilters({ fitness: "low" }), [
        "q",
        "category",
        "sort",
      ]),
      50
    );
  });

  it("builds locale-aware list href with cursor", () => {
    const filters = parseCatalogListFilters({ category: "mountain", sort: "price_asc" });
    assert.equal(
      buildCatalogListHref("/tours", filters, "tour-2"),
      "/tours?category=mountain&sort=price_asc&cursor=tour-2"
    );
    assert.equal(
      buildCatalogListHref("/en/tours", filters),
      "/en/tours?category=mountain&sort=price_asc"
    );
  });

  it("treats category=all as no category filter (reset chip)", () => {
    const filters = parseCatalogListFilters({ category: "all" });
    assert.equal(filters.category, undefined);
    assert.equal(buildCatalogListHref("/tours", filters), "/tours");
  });

  it("parses repeated searchParams values", () => {
    const filters = parseCatalogListFilters({
      category: ["mountain", "nature"],
      difficulty: ["4"],
    });
    assert.equal(filters.category, "mountain");
    assert.equal(filters.difficulty, 4);
  });

  it("detects active filters for pills even when server-backed", () => {
    const denaliServerFilters = [
      "q",
      "category",
      "difficulty",
      "fitness",
      "availability",
      "sort",
    ] as const;
    assert.equal(
      catalogListHasActiveFilters(parseCatalogListFilters({ category: "mountain" }), [
        ...denaliServerFilters,
      ]),
      true
    );
    assert.equal(
      catalogListHasActiveFilters(parseCatalogListFilters({ sort: "price_asc" }), [
        ...denaliServerFilters,
      ]),
      true
    );
  });

  it("detects client filters separately from server-backed params", () => {
    const serverFilters = ["q", "category", "sort"];
    assert.equal(
      catalogListHasClientFilters(parseCatalogListFilters({ category: "peak" }), serverFilters),
      false
    );
    assert.equal(
      catalogListHasClientFilters(parseCatalogListFilters({ fitness: "low" }), serverFilters),
      true
    );
  });

  it("rebuilds load-more query from parsed filters", () => {
    const filters = parseCatalogListFilters({
      q: "ridge",
      category: "mountain_multi",
      difficulty: "4",
      fitness: "high",
      availability: "open",
      sort: "departure_asc",
    });
    const query = catalogFiltersToQueryInput(filters, "cursor-2");
    assert.equal(query.cursor, "cursor-2");
    assert.equal(query.q, "ridge");
    assert.equal(query.category, "mountain_multi");
    assert.equal(query.difficulty, "4");
    assert.equal(query.fitness, "high");
    assert.equal(query.availability, "open");
    assert.equal(query.sort, "departure_asc");
  });

  it("clears cursor when removing an active filter pill", () => {
    const filters = parseCatalogListFilters({
      q: "ridge",
      category: "mountain_multi",
      cursor: "cursor-2",
    });
    const href = buildCatalogListQueryWithoutFilters(filters, ["q"]);
    assert.doesNotMatch(href, /cursor=/);
    assert.doesNotMatch(href, /q=/);
    assert.match(href, /category=mountain_multi/);
  });
});
