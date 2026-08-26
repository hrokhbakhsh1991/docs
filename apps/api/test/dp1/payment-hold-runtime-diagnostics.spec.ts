/**
 * DP1-E — payment hold expiry runtime diagnostics (config visibility).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { readPaymentHoldRuntimeDiagnostics } from "../../src/finance/payment-hold-runtime-diagnostics.ts";
import { resetPaymentHoldExpirySchedulerForTests } from "../../src/finance/start-payment-hold-expiry-scheduler.ts";

describe("payment-hold-runtime-diagnostics", () => {
  const env = { ...process.env };

  before(() => {
    resetPaymentHoldExpirySchedulerForTests();
  });

  after(() => {
    process.env = { ...env };
  });

  it("reports scheduler off when expiry flag disabled", () => {
    process.env.PAYMENT_HOLD_ENABLED = "true";
    process.env.PAYMENT_HOLD_EXPIRY_ENABLED = "false";
    const diag = readPaymentHoldRuntimeDiagnostics();
    assert.equal(diag.paymentHoldEnabled, true);
    assert.equal(diag.paymentHoldExpiryEnabled, false);
    assert.equal(diag.expirySchedulerWouldStart, false);
  });

  it("reports scheduler on when both flags enabled", () => {
    process.env.PAYMENT_HOLD_ENABLED = "true";
    process.env.PAYMENT_HOLD_EXPIRY_ENABLED = "true";
    process.env.PAYMENT_HOLD_EXPIRY_INTERVAL_MS = "45000";
    const diag = readPaymentHoldRuntimeDiagnostics();
    assert.equal(diag.expirySchedulerWouldStart, true);
    assert.equal(diag.expiryIntervalMs, 45_000);
  });

  it("main bootstrap imports expiry scheduler", async () => {
    const mainSource = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../../src/main.ts", import.meta.url), "utf8")
    );
    assert.match(mainSource, /startPaymentHoldExpiryScheduler/);
  });
});
