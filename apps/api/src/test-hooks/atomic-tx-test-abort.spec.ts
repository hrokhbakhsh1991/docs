/**
 * Phase 4B H0.3 — P5_ATOMIC_TX_TEST_ABORT production gate.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  isAtomicTxTestAbortEnabled,
  shouldAbortAtomicTx,
} from "./atomic-tx-test-abort.ts";

describe("atomic-tx-test-abort — Phase 4B H0.3", () => {
  const priorNodeEnv = process.env.NODE_ENV;
  const priorAbort = process.env.P5_ATOMIC_TX_TEST_ABORT;
  const priorTier = process.env.APPS_API_TEST_TIER;

  afterEach(() => {
    if (priorNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = priorNodeEnv;
    }
    if (priorAbort === undefined) {
      delete process.env.P5_ATOMIC_TX_TEST_ABORT;
    } else {
      process.env.P5_ATOMIC_TX_TEST_ABORT = priorAbort;
    }
    if (priorTier === undefined) {
      delete process.env.APPS_API_TEST_TIER;
    } else {
      process.env.APPS_API_TEST_TIER = priorTier;
    }
  });

  it("ABORT-PROD-01 production ignores abort env", () => {
    process.env.NODE_ENV = "production";
    process.env.P5_ATOMIC_TX_TEST_ABORT = "finance_approve_before_commit";
    process.env.APPS_API_TEST_TIER = "trunk";
    assert.equal(isAtomicTxTestAbortEnabled(), false);
    assert.equal(shouldAbortAtomicTx("finance_approve_before_commit"), false);
  });

  it("ABORT-TEST-01 test runtime honors abort env", () => {
    process.env.NODE_ENV = "test";
    process.env.P5_ATOMIC_TX_TEST_ABORT = "finance_approve_before_commit";
    assert.equal(isAtomicTxTestAbortEnabled(), true);
    assert.equal(shouldAbortAtomicTx("finance_approve_before_commit"), true);
    assert.equal(shouldAbortAtomicTx("other"), false);
  });

  it("ABORT-PROD-02 production ignores canonical persist abort hooks", () => {
    process.env.NODE_ENV = "production";
    for (const hook of [
      "before_outbox",
      "process_exit",
      "pre_commit",
      "before_update_audit",
    ] as const) {
      process.env.P5_ATOMIC_TX_TEST_ABORT = hook;
      assert.equal(shouldAbortAtomicTx(hook), false);
    }
  });
});
