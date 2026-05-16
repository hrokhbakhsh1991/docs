import assert from "node:assert/strict";
import test from "node:test";
import { detectPaymentMismatch } from "./detect-payment-mismatch";
import { ReconciliationMismatchReason } from "./reconciliation-mismatch";

const base = {
  tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  currency: "IRR"
};

test("detectPaymentMismatch returns null when triad matches", () => {
  assert.equal(
    detectPaymentMismatch({
      ...base,
      pspAmountMinor: "1000",
      ledgerAmountMinor: "1000",
      bookingSnapshotAmountMinor: "1000"
    }),
    null
  );
});

test("detectPaymentMismatch returns mismatch when PSP differs", () => {
  const m = detectPaymentMismatch({
    ...base,
    pspAmountMinor: "1001",
    ledgerAmountMinor: "1000",
    bookingSnapshotAmountMinor: "1000"
  });
  assert.ok(m);
  assert.equal(m.reason, ReconciliationMismatchReason.AMOUNT_TRIAD_MISMATCH);
  assert.equal(m.delta_psp_vs_ledger_minor, "1");
  assert.equal(m.delta_psp_vs_snapshot_minor, "1");
  assert.equal(m.delta_ledger_vs_snapshot_minor, "0");
});

test("detectPaymentMismatch flags invalid amount format", () => {
  const m = detectPaymentMismatch({
    ...base,
    pspAmountMinor: "10x0",
    ledgerAmountMinor: "1000",
    bookingSnapshotAmountMinor: "1000"
  });
  assert.ok(m);
  assert.equal(m.reason, ReconciliationMismatchReason.INVALID_AMOUNT_FORMAT);
});

test("detectPaymentMismatch empty currency is inconsistent", () => {
  const m = detectPaymentMismatch({
    ...base,
    currency: "   ",
    pspAmountMinor: "1",
    ledgerAmountMinor: "1",
    bookingSnapshotAmountMinor: "1"
  });
  assert.ok(m);
  assert.equal(m.reason, ReconciliationMismatchReason.CURRENCY_INCONSISTENT);
});
