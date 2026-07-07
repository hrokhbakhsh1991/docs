import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform tab domains ssl", () => {
  it("tab-domains renders data-ssl-status", () => {
    const source = readFileSync(
      new URL("../src/platform/club-detail/tab-domains.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /data-ssl-status/);
  });
});
