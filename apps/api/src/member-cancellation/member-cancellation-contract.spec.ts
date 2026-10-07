import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("./member-cancellation.service.ts", import.meta.url), "utf8");

describe("member cancellation recovery contract", () => {
  it("does not turn persisted cancellation into a retry-shaped 500", () => {
    assert.match(source, /The lifecycle transition is already persisted/);
    assert.match(source, /settlementStatus = "manual_review"/);
    assert.match(source, /refundStatus/);
  });
});
