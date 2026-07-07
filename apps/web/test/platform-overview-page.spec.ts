import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform overview page", () => {
  it("imports stats helper", () => {
    const source = readFileSync(
      new URL("../app/(platform)/platform/page.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /loadPlatformOverviewStats/);
    assert.match(source, /data-stat-total/);
    assert.match(source, /data-stat-ssl-expiring/);
    assert.match(source, /data-platform-overview/);
  });
});
