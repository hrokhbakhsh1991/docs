/**
 * Operator list query — category filter param parsing.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseListToursQuery } from "../src/tours/list-tours-query";

describe("list-tours-query-category.spec.ts", () => {
  it("parses valid Denali category slug on operator view", () => {
    const query = parseListToursQuery(new URLSearchParams("view=operator&category=mountain_day"));
    assert.equal(query.view, "operator");
    assert.equal(query.operator?.category, "mountain_day");
  });

  it("ignores unknown category slugs", () => {
    const query = parseListToursQuery(new URLSearchParams("view=operator&category=invalid_kind"));
    assert.equal(query.operator?.category, undefined);
  });

  it("parses departure_at sort column on operator view", () => {
    const query = parseListToursQuery(
      new URLSearchParams("view=operator&sort_by=departure_at&sort_dir=asc")
    );
    assert.equal(query.operator?.sortBy, "departure_at");
    assert.equal(query.operator?.sortDir, "asc");
  });
});
