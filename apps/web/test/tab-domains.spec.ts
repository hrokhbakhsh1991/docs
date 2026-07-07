import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("tab-domains", () => {
  it("CNAME text", () => {
    const source = readFileSync(
      new URL("../src/platform/club-detail/tab-domains.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /CNAME/);
    assert.match(source, /cnameTarget/);
  });

  it("add form", () => {
    const source = readFileSync(
      new URL("../src/platform/club-detail/tab-domains.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /Add custom domain/);
    assert.match(source, /fetchPlatformApi/);
  });
});
