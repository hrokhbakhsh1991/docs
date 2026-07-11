/**
 * Denali leader picker helpers
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { leaderDisplayInitials } from "@app-tour/workspace-denali/host/ui/logic/denali-leader-picker-logic";

describe("denali-leader-picker-logic.spec.ts", () => {
  it("WEB-DENALI-LEADER-01 builds display initials from names", () => {
    assert.equal(leaderDisplayInitials("علی رضایی"), "عر");
    assert.equal(leaderDisplayInitials("Sara"), "SA");
    assert.equal(leaderDisplayInitials("  "), "?");
    assert.equal(leaderDisplayInitials("Mary Jane Watson"), "MW");
  });
});
