import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform BFF tenant detail", () => {
  it("GET by id", () => {
    const source = readFileSync(
      new URL("../app/api/platform/tenants/[id]/route.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /\/platform\/v1\/tenants\/\$\{id\}/);
    assert.match(source, /export async function GET/);
  });

  it("PATCH status route", () => {
    const source = readFileSync(
      new URL("../app/api/platform/tenants/[id]/status/route.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /\/status/);
    assert.match(source, /PATCH/);
  });

  it("POST owner invite route", () => {
    const source = readFileSync(
      new URL("../app/api/platform/tenants/[id]/owner-invite/route.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /owner-invite/);
    assert.match(source, /POST/);
  });
});
