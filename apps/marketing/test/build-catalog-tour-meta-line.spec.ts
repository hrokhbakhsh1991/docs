import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCatalogTourMetaLine } from "../src/catalog/build-catalog-tour-meta-line";

describe("build-catalog-tour-meta-line", () => {
  it("MKT-07 joins normalized subtitle and formatted dates", () => {
    const line = buildCatalogTourMetaLine(
      {
        id: "1",
        listSubtitle: "Trek",
        departureAt: "2026-07-01T08:00:00.000Z",
        endAt: "2026-07-03T18:00:00.000Z",
      },
      "en-US",
      "Dates TBA"
    );
    assert.match(line, /^Trek · /);
    assert.match(line, /Jul/);
  });

  it("MKT-08 omits empty subtitle segment", () => {
    const line = buildCatalogTourMetaLine(
      {
        id: "1",
        departureAt: "2026-07-01T08:00:00.000Z",
      },
      "en-US",
      "Dates TBA"
    );
    assert.doesNotMatch(line, /^ · /);
    assert.doesNotMatch(line, /^— · /);
    assert.match(line, /Jul/);
  });
});
