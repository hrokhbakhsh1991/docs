import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("tab actions danger", () => {
  it("renders danger zone markers", () => {
    const source = readFileSync(
      new URL("../src/platform/club-detail/tab-actions-danger.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /data-danger-zone/);
    assert.match(source, /data-offboard-start/);
    assert.match(source, /data-export-tenant/);
  });
});
