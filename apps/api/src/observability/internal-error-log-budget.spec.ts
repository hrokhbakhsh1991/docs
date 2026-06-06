import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  acquireInternalErrorLogSlot,
  resetInternalErrorLogBudgetForTests,
  resolveInternalErrorLogBurstMax,
} from "./internal-error-log-budget.js";

describe("internal-error-log-budget (LOG-BP-04 / DEC-128)", () => {
  it("defaults burst max to 32", () => {
    assert.equal(resolveInternalErrorLogBurstMax(), 32);
  });

  it("allows burst max logs per 1s window then suppresses", () => {
    resetInternalErrorLogBudgetForTests();
    const max = resolveInternalErrorLogBurstMax();
    const start = 1_000;

    for (let i = 0; i < max; i += 1) {
      assert.equal(acquireInternalErrorLogSlot(start + i), true, `slot ${i} should log`);
    }
    assert.equal(acquireInternalErrorLogSlot(start + max), false, "overflow should suppress");
    assert.equal(acquireInternalErrorLogSlot(start + max + 1), false);
  });

  it("resets window after 1s", () => {
    resetInternalErrorLogBudgetForTests();
    const max = resolveInternalErrorLogBurstMax();
    const start = 5_000;

    for (let i = 0; i < max; i += 1) {
      acquireInternalErrorLogSlot(start);
    }
    assert.equal(acquireInternalErrorLogSlot(start + 1), false);

    assert.equal(acquireInternalErrorLogSlot(start + 1001), true, "new window should allow logs");
  });
});
