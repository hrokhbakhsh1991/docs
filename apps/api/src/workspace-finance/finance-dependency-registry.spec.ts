/**
 * Phase 1.3 — finance dependency registry (Denali + finance-ws2 architecture fixture).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  listRegisteredFinanceWorkspaceTypes,
  resolveBootFinanceWorkspaceType,
  resolveFinanceBookingPayments,
  resolveFinanceLedgerPolicy,
  resolveFinanceReceiptDefaults,
} from "./finance-dependency-registry.ts";
import { BookingPaymentAdapter } from "./infrastructure/booking-payment.adapter.ts";
import { DenaliFinanceLedgerPolicyAdapter } from "./infrastructure/denali-finance-ledger-policy.adapter.ts";
import { DenaliFinanceReceiptDefaultsAdapter } from "./infrastructure/denali-finance-receipt-defaults.adapter.ts";
import {
  FINANCE_WS2_LEDGER_ACCOUNTS,
  FINANCE_WS2_WORKSPACE_TYPE,
  financeWs2BookingWalletId,
} from "./infrastructure/finance-ws2-chart-of-accounts.ts";
import { FinanceWs2LedgerPolicyAdapter } from "./infrastructure/finance-ws2-ledger-policy.adapter.ts";
import { FinanceWs2ReceiptDefaultsAdapter } from "./infrastructure/finance-ws2-receipt-defaults.adapter.ts";

const DENALI = "denali";
const WS2 = FINANCE_WS2_WORKSPACE_TYPE;

describe("finance-dependency-registry", { concurrency: false }, () => {
  it("FIN-REG-01 denali resolves DenaliFinanceLedgerPolicyAdapter", () => {
    const policy = resolveFinanceLedgerPolicy(DENALI);
    assert.ok(policy instanceof DenaliFinanceLedgerPolicyAdapter);
  });

  it("FIN-REG-02 denali receipt defaults match prior offline literals (IRR / 2500000)", () => {
    const defaults = resolveFinanceReceiptDefaults(DENALI);
    assert.ok(defaults instanceof DenaliFinanceReceiptDefaultsAdapter);
    assert.deepEqual(defaults.offlineReceiptPaymentDefaults(), {
      amountMinor: "2500000",
      currency: "IRR",
    });
  });

  it("FIN-REG-03 boot finance workspace type remains denali", () => {
    assert.equal(resolveBootFinanceWorkspaceType(), DENALI);
  });

  it("FIN-REG-04 unknown workspaceType fails clearly for ledger policy", () => {
    assert.throws(
      () => resolveFinanceLedgerPolicy("urban"),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith("FINANCE_LEDGER_POLICY_UNSUPPORTED:") &&
        error.message.includes("urban")
    );
  });

  it("FIN-REG-05 unknown workspaceType fails clearly for receipt defaults", () => {
    assert.throws(
      () => resolveFinanceReceiptDefaults("not-a-workspace"),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith("FINANCE_RECEIPT_DEFAULTS_UNSUPPORTED:")
    );
  });

  it("FIN-REG-06 empty workspaceType fails with FINANCE_WORKSPACE_TYPE_REQUIRED", () => {
    assert.throws(
      () => resolveFinanceLedgerPolicy("   "),
      (error: unknown) =>
        error instanceof Error && error.message.startsWith("FINANCE_WORKSPACE_TYPE_REQUIRED:")
    );
    assert.throws(
      () => resolveFinanceReceiptDefaults(""),
      (error: unknown) =>
        error instanceof Error && error.message.startsWith("FINANCE_WORKSPACE_TYPE_REQUIRED:")
    );
  });

  it("FIN-REG-07 denali ledger capture domainEventId formula unchanged", () => {
    const policy = resolveFinanceLedgerPolicy(DENALI);
    const paymentId = "11111111-1111-4111-8111-111111111111";
    const capture = policy.buildPaymentCaptureJournal({
      tenantId: "00000000-0000-4000-8000-000000000001",
      registrationId: "22222222-2222-4222-8222-222222222222",
      paymentId,
      amountMinor: "2500000",
      currency: "IRR",
      capturedAtIso: "2026-07-18T00:00:00.000Z",
    });
    assert.equal(capture.domainEventId, `payment:${paymentId}:ledger-capture-anchor`);
  });

  it("FIN-REG-08 finance-ws2 resolves WS2 adapters (not Denali)", () => {
    const policy = resolveFinanceLedgerPolicy(WS2);
    const defaults = resolveFinanceReceiptDefaults(WS2);
    assert.ok(policy instanceof FinanceWs2LedgerPolicyAdapter);
    assert.ok(defaults instanceof FinanceWs2ReceiptDefaultsAdapter);
    assert.ok(!(policy instanceof DenaliFinanceLedgerPolicyAdapter));
    assert.ok(!(defaults instanceof DenaliFinanceReceiptDefaultsAdapter));
  });

  it("FIN-REG-09 finance-ws2 receipt defaults are USD / 10000 (not Denali IRR)", () => {
    assert.deepEqual(resolveFinanceReceiptDefaults(WS2).offlineReceiptPaymentDefaults(), {
      amountMinor: "10000",
      currency: "USD",
    });
  });

  it("FIN-REG-10 finance-ws2 capture uses WS2 CoA — no Denali account leakage", () => {
    const registrationId = "33333333-3333-4333-8333-333333333333";
    const paymentId = "44444444-4444-4444-8444-444444444444";
    const capture = resolveFinanceLedgerPolicy(WS2).buildPaymentCaptureJournal({
      tenantId: "00000000-0000-4000-8000-000000000001",
      registrationId,
      paymentId,
      amountMinor: "10000",
      currency: "USD",
      capturedAtIso: "2026-07-18T00:00:00.000Z",
    });
    const accounts = capture.lines.map((line) => line.account);
    assert.deepEqual(
      accounts.sort(),
      [FINANCE_WS2_LEDGER_ACCOUNTS.OPERATOR_CASH_CLEARING, financeWs2BookingWalletId(registrationId)].sort()
    );
    assert.ok(!accounts.some((a) => a.startsWith("gl:") || a.startsWith("booking:")));
    assert.equal(capture.domainEventId, `payment:${paymentId}:ledger-capture-anchor`);
  });

  it("FIN-REG-11 registered workspace types include denali and finance-ws2", () => {
    assert.deepEqual(listRegisteredFinanceWorkspaceTypes(), [DENALI, WS2].sort());
  });

  it("FIN-REG-12 booking projection resolves BookingPaymentAdapter for denali and finance-ws2", () => {
    assert.ok(resolveFinanceBookingPayments(DENALI) instanceof BookingPaymentAdapter);
    assert.ok(resolveFinanceBookingPayments(WS2) instanceof BookingPaymentAdapter);
  });

  it("FIN-REG-13 booking projection fails closed for unsupported workspaceType", () => {
    assert.throws(
      () => resolveFinanceBookingPayments("urban"),
      (error: unknown) =>
        error instanceof Error && error.message.startsWith("FINANCE_BOOKING_PAYMENT_UNSUPPORTED:")
    );
  });
});
