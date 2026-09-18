import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildOperatorTourWhere } from "../src/tours/operator-tour-list-db-query";

describe("operator-tour-list-db-query", () => {
  it("applies category before Prisma pagination", () => {
    const where = buildOperatorTourWhere({
      tenantId: "00000000-0000-4000-8000-000000000014",
      category: "mountain_day",
    });

    assert.deepEqual(where.canonical, {
      path: ["data", "category"],
      equals: "mountain_day",
    });
  });

  it("does not add a category predicate when no category is selected", () => {
    const where = buildOperatorTourWhere({
      tenantId: "00000000-0000-4000-8000-000000000014",
    });

    assert.equal("canonical" in where, false);
  });
});
