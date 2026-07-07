import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computePlatformOverviewStats } from "../src/platform/platform-overview-stats";

describe("platform overview unhealthy", () => {
  it("field exists number", () => {
    const stats = computePlatformOverviewStats([], 2);
    assert.equal(typeof stats.unhealthyCount, "number");
    assert.equal(stats.unhealthyCount, 2);
  });
});
