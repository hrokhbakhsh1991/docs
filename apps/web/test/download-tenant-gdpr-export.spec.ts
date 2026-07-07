import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("download tenant gdpr export", () => {
  it("uses fetchPlatformApi export path", () => {
    const source = readFileSync(
      new URL("../src/platform/club-detail/download-tenant-gdpr-export.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /\/export/);
    assert.match(source, /blob/);
  });
});
