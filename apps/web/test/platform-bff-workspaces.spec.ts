import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform BFF workspaces", () => {
  it("fetch platform/v1/workspaces", () => {
    const source = readFileSync(
      new URL("../app/api/platform/workspaces/route.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /\/platform\/v1\/workspaces/);
    assert.match(source, /proxyPlatformApi/);
  });
});
