import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("lazy-finance-service", () => {
  it("keeps legacy boot composition comments product-generic", () => {
    const source = readFileSync(new URL("./lazy-finance-service.ts", import.meta.url), {
      encoding: "utf8",
    });
    assert.doesNotMatch(source, /Denali workspace type/);
    assert.match(source, /workspace type comes from the boot resolver/);
  });
});
