import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform internal provision deprecation", () => {
  it("file mentions platform/v1/tenants", () => {
    const source = readFileSync(new URL("../src/routes/internal/tenants.ts", import.meta.url), "utf8");
    assert.match(source, /\/platform\/v1\/tenants/);
    assert.match(source, /@deprecated/i);
  });
});
