import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("resolveProductTourStore", () => {
  it("keeps shared host tour-store comments product-generic", () => {
    const source = readFileSync(new URL("./resolve-product-tour-store.ts", import.meta.url), {
      encoding: "utf8",
    });
    assert.doesNotMatch(source, /Denali \+ Urban/);
    assert.match(source, /generated product HTTP hosts/);
  });
});
