import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform club status actions", () => {
  it("uses PATCH status BFF", () => {
    const source = readFileSync(
      new URL("../src/platform/club-detail/platform-club-detail-client.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /\/tenants\/\$\{detail\.tenant\.id\}\/status/);
    assert.match(source, /method: "PATCH"/);
    assert.match(source, /"suspended"/);
    assert.match(source, /"active"/);
  });
});
