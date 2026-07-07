import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computePlatformOverviewStats } from "../src/platform/platform-overview-stats";

describe("platform-overview-stats", () => {
  it("returns number fields", () => {
    const stats = computePlatformOverviewStats([
      { subdomain: "a", status: "active" },
      { subdomain: "b", status: "suspended" },
      { subdomain: "c", status: "active" },
    ]);
    assert.equal(typeof stats.total, "number");
    assert.equal(typeof stats.active, "number");
    assert.equal(typeof stats.suspended, "number");
    assert.equal(typeof stats.unhealthyCount, "number");
    assert.equal(stats.total, 3);
    assert.equal(stats.active, 2);
    assert.equal(stats.suspended, 1);
  });

  it("includes sslExpiringWithin14Days", () => {
    const stats = computePlatformOverviewStats([], 0, 3);
    assert.equal(stats.sslExpiringWithin14Days, 3);
  });
});
