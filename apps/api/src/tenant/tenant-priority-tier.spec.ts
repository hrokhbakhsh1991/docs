import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePriorityTierFromTheme } from "./tenant-priority-tier";

describe("tenant priority tier (DEC-114)", () => {
  it("defaults to normal when theme missing", () => {
    assert.equal(parsePriorityTierFromTheme(null), "normal");
    assert.equal(parsePriorityTierFromTheme({}), "normal");
  });

  it("parses low and high tiers", () => {
    assert.equal(parsePriorityTierFromTheme({ priorityTier: "low" }), "low");
    assert.equal(parsePriorityTierFromTheme({ priorityTier: "high" }), "high");
  });

  it("ignores invalid tier values", () => {
    assert.equal(parsePriorityTierFromTheme({ priorityTier: "vip" }), "normal");
    assert.equal(parsePriorityTierFromTheme({ priorityTier: 1 }), "normal");
  });
});
