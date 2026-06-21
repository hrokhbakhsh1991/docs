import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform async states", () => {
  it("exports loading error empty", () => {
    const source = readFileSync(
      new URL("../src/platform/platform-async-states.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /PlatformLoadingState/);
    assert.match(source, /PlatformErrorState/);
    assert.match(source, /PlatformEmptyState/);
    assert.match(source, /data-platform-loading/);
  });
});
