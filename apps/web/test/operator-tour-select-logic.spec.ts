import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOperatorTourListUrl,
  mapOperatorTourSelectItemsToOptions,
  mergeOperatorTourSelectOptions,
  OPERATOR_TOUR_SELECT_DEFAULT_LIMIT,
  parseOperatorTourListResponse,
} from "../src/admin/patterns/operator-tour-select-logic";

describe("operator-tour-select-logic.spec.ts", () => {
  it("WEB-TOUR-SEL-01 builds operator list URL with search + limit", () => {
    const url = buildOperatorTourListUrl({ search: "alpine", limit: 25 });
    assert.match(url, /^\/api\/tours\?/);
    assert.match(url, /view=operator/);
    assert.match(url, /search=alpine/);
    assert.match(url, /limit=25/);
  });

  it("WEB-TOUR-SEL-02 parses operator tour list response", () => {
    const parsed = parseOperatorTourListResponse({
      items: [{ id: "t1", title: "North Ridge", departureAt: "2026-08-01T00:00:00.000Z" }],
      total: 1,
      page: 1,
      limit: OPERATOR_TOUR_SELECT_DEFAULT_LIMIT,
    });
    assert.ok(parsed !== null);
    assert.equal(parsed.items[0]?.id, "t1");
    assert.equal(parsed.items[0]?.title, "North Ridge");
  });

  it("WEB-TOUR-SEL-03 merges seed + remote options without duplicates", () => {
    const merged = mergeOperatorTourSelectOptions(
      [{ value: "a", label: "Alpha" }],
      [
        { value: "a", label: "Alpha duplicate" },
        { value: "b", label: "Beta" },
      ]
    );
    assert.deepEqual(merged, [
      { value: "a", label: "Alpha" },
      { value: "b", label: "Beta" },
    ]);
  });

  it("WEB-TOUR-SEL-04 maps select items to searchable options", () => {
    const options = mapOperatorTourSelectItemsToOptions(
      [{ id: "t1", title: "Trek", departureAt: null }],
      (item) => item.id
    );
    assert.deepEqual(options, [{ value: "t1", label: "Trek", description: "t1" }]);
  });
});
