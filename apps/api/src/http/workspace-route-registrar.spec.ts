import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("workspace-route-registrar", () => {
  it("keeps finance route dependency comments product-generic", () => {
    const source = readFileSync(new URL("./workspace-route-registrar.ts", import.meta.url), {
      encoding: "utf8",
    });
    assert.doesNotMatch(source, /forced Denali boot type/);
    assert.match(source, /product boot type/);
  });
});
