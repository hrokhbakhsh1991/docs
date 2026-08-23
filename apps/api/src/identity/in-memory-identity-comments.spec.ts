import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("in-memory identity repository comments", () => {
  it("keeps shared fixture guidance product-generic", () => {
    const source = readFileSync(new URL("./in-memory-identity.repository.ts", import.meta.url), {
      encoding: "utf8",
    });
    assert.doesNotMatch(source, /denali host — sync/);
    assert.doesNotMatch(source, /urban smoke — sync/);
    assert.doesNotMatch(source, /Denali host login/);
  });
});
