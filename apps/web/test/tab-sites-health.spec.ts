import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("tab-sites health", () => {
  it("fetch on click", () => {
    const source = readFileSync(
      new URL("../src/platform/club-detail/tab-sites.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /Check health/);
    assert.match(source, /sites\/check/);
    assert.match(source, /fetchPlatformApi/);
  });
});
