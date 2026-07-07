import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform BFF tenants", () => {
  it("POST forwards key", () => {
    const source = readFileSync(
      new URL("../app/api/platform/tenants/route.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /Idempotency-Key/);
    assert.match(source, /POST/);
  });

  it("GET list", () => {
    const source = readFileSync(
      new URL("../app/api/platform/tenants/route.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /\/platform\/v1\/tenants/);
    assert.match(source, /export async function GET/);
  });
});
