import assert from "node:assert/strict";
import test from "node:test";

import type { TourSort } from "@repo/shared-contracts";

import { applyTourSort } from "../repositories/tours-query-builder";

type RecordedOrder = { expr: string; dir: string };

class MockQb {
  public orders: RecordedOrder[] = [];
  public selects: Array<{ expr: string; alias: string }> = [];

  addSelect(expr: string, alias: string): this {
    this.selects.push({ expr, alias });
    return this;
  }

  orderBy(expr: string, dir: string): this {
    this.orders.push({ expr, dir });
    return this;
  }

  addOrderBy(expr: string, dir: string): this {
    this.orders.push({ expr, dir });
    return this;
  }
}

function runSort(sort: TourSort): MockQb {
  const qb = new MockQb();
  applyTourSort(qb as never, sort);
  return qb;
}

test("applyTourSort: difficulty sort uses weighted expression", () => {
  const qb = runSort({ field: "difficulty", dir: "asc" });
  const orders = qb.orders;
  assert.equal(orders.length >= 3, true);
  assert.equal(qb.selects[0].expr.includes("details.difficulty"), true);
  assert.equal(qb.selects[0].alias, "sort_difficulty");
  assert.equal(orders[0].expr, "sort_difficulty");
  assert.equal(orders[0].dir, "ASC");
});

test("applyTourSort: category sort uses tourType expression", () => {
  const qb = runSort({ field: "category", dir: "desc" });
  const orders = qb.orders;
  assert.equal(orders.length >= 3, true);
  assert.equal(qb.selects[0].expr.includes("t.tourType"), true);
  assert.equal(qb.selects[0].alias, "sort_category");
  assert.equal(orders[0].expr, "sort_category");
  assert.equal(orders[0].dir, "DESC");
});

test("applyTourSort: non-created sort keeps stable tie-breakers", () => {
  const orders = runSort({ field: "difficulty", dir: "asc" }).orders;
  const tie1 = orders[1];
  const tie2 = orders[2];
  assert.deepEqual(tie1, { expr: "t.createdAt", dir: "DESC" });
  assert.deepEqual(tie2, { expr: "t.id", dir: "DESC" });
});

test("applyTourSort: created_at keeps stable id tie-breaker", () => {
  const orders = runSort({ field: "created_at", dir: "asc" }).orders;
  assert.deepEqual(orders, [
    { expr: "t.createdAt", dir: "ASC" },
    { expr: "t.id", dir: "ASC" },
  ]);
});

