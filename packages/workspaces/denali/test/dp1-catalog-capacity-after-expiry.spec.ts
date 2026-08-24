/**
 * DP1-G — catalog spots after expiry (S5).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeSpotsRemaining } from "@app-tour/tour-core";

describe("DP1-G catalog capacity after payment expiry", () => {
  it("S5: spotsRemaining increases when approved-unpaid expires to cancelled", () => {
    const capacityMax = 10;
    const partySize = 3;
    const before = computeSpotsRemaining(capacityMax, 8);
    const after = computeSpotsRemaining(capacityMax, 8 - partySize);
    assert.equal(before, 2);
    assert.equal(after, 5);
    assert.ok(after > before, "expiry must release seats into catalog availability");
  });
});
