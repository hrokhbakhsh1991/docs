import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOperatorTourWhere,
  compareOperatorTourPrices,
  publishStatusesForOperatorFilter,
  readOperatorTourPrice,
} from "../src/tours/operator-tour-list-db-query";

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

  it("searches both the projection and canonical basics title", () => {
    const where = buildOperatorTourWhere({
      tenantId: "00000000-0000-4000-8000-000000000014",
      search: "پیش",
    });

    assert.deepEqual(where.OR, [
      { title: { contains: "پیش", mode: "insensitive" } },
      {
        canonical: {
          path: ["data", "basics", "title"],
          string_contains: "پیش",
          mode: "insensitive",
        },
      },
    ]);
  });

  it("maps the UI draft and active filters to the correct stored statuses", () => {
    // The query contract keeps legacy names: `active` means the UI draft filter,
    // while `completed` means the UI active/published filter.
    assert.deepEqual(publishStatusesForOperatorFilter("active"), ["draft"]);
    assert.deepEqual(publishStatusesForOperatorFilter("completed"), [
      "active",
      "published",
      "open",
    ]);
  });

  it("sorts canonical prices numerically and keeps missing prices last", () => {
    const cheap = { data: { pricing: { basePricePerPerson: 123_333 } } };
    const expensive = { data: { pricing: { basePricePerPerson: 2_500_000 } } };
    const missing = { data: { pricing: {} } };

    assert.equal(readOperatorTourPrice(cheap), 123_333);
    assert.equal(
      compareOperatorTourPrices(cheap, expensive, "cheap", "expensive", "asc") < 0,
      true
    );
    assert.equal(
      compareOperatorTourPrices(expensive, cheap, "expensive", "cheap", "desc") < 0,
      true
    );
    assert.equal(compareOperatorTourPrices(missing, cheap, "missing", "cheap", "asc") > 0, true);
  });
});
