import assert from "node:assert";
import { describe, it } from "node:test";
import { runProvisionTransaction } from "../src/platform/run-provision-transaction.ts";

describe("P1-N-046: runProvisionTransaction", () => {
  it("should be a function that accepts a callback", () => {
    assert.strictEqual(typeof runProvisionTransaction, "function");
    assert.strictEqual(runProvisionTransaction.length, 1);
  });

  it("should return a Promise", async () => {
    // Mock callback that returns a resolved promise
    const mockCallback = async () => ({ test: true });
    const result = runProvisionTransaction(mockCallback);
    assert.ok(result instanceof Promise, "Should return a Promise");

    // Catch the promise to prevent unhandled rejection
    await result.catch(() => {
      // Expected to fail without DATABASE_URL, but we verified it returns a Promise
    });
  });
});

// Made with Bob
