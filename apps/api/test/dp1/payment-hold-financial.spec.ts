/**
 * DP1 financial paths — S2, S10, S10b, duplicate payment.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { createFinanceService } from "@app-tour/finance-core/application";
import type { FinanceActorContext } from "@app-tour/finance-core/ports";

import { resolveFinanceServiceForTenant } from "../../src/boot/lazy-finance-service.ts";
import {
  DP1_TENANT_DENALI,
  dp1CreateAndApprovePending,
  dp1GetBooking,
  requirePaymentHoldPort,
  resetDp1MemoryHarness,
} from "./dp1-test-harness.ts";

function opsAuth(): FinanceActorContext {
  return {
    userId: "00000000-0000-4000-8000-000000000201",
    tenantId: DP1_TENANT_DENALI,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-dp1-finance",
  };
}

describe("DP1 financial payment hold integration", { concurrency: false }, () => {
  before(() => resetDp1MemoryHarness());
  beforeEach(() => resetDp1MemoryHarness());
  after(() => resetDp1MemoryHarness());

  it("S2: full payment before deadline satisfies hold and locks quote", async () => {
    const { bookingId } = await dp1CreateAndApprovePending();
    const finance = await resolveFinanceServiceForTenant(DP1_TENANT_DENALI);
    const invoiceBefore = await finance.getRegistrationInvoice(opsAuth(), bookingId);
    const idem = `dp1-s2-${randomUUID()}`;
    await finance.createManualPayment(
      opsAuth(),
      {
        registrationId: bookingId,
        amount: invoiceBefore.invoiceTotalMinor,
        currency: "IRR",
      },
      idem
    );

    const holdPort = await requirePaymentHoldPort();
    const hold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, bookingId);
    assert.equal(hold?.status, "satisfied", "DP1-EXPECTED-FAIL: hold not satisfied on full payment");

    const invoice = await finance.getRegistrationInvoice(opsAuth(), bookingId);
    assert.equal(invoice.remainingMinor, "0");
    assert.equal(typeof createFinanceService, "function");
  });

  it("S10: partial payment keeps hold open with remaining > 0", async () => {
    const { bookingId } = await dp1CreateAndApprovePending();
    const finance = await resolveFinanceServiceForTenant(DP1_TENANT_DENALI);
    await finance.createManualPayment(
      opsAuth(),
      { registrationId: bookingId, amount: "1000000", currency: "IRR" },
      `dp1-s10-${randomUUID()}`
    );
    const invoice = await finance.getRegistrationInvoice(opsAuth(), bookingId);
    assert.ok(Number(invoice.remainingMinor) > 0);
    const holdPort = await requirePaymentHoldPort();
    const hold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, bookingId);
    assert.equal(hold?.status, "open");
  });

  it("S10b: partial then expiry cancels without auto-refund", async () => {
    const { bookingId } = await dp1CreateAndApprovePending();
    const finance = await resolveFinanceServiceForTenant(DP1_TENANT_DENALI);
    await finance.createManualPayment(
      opsAuth(),
      { registrationId: bookingId, amount: "1000000", currency: "IRR" },
      `dp1-s10b-${randomUUID()}`
    );
    const mod = await import("../../src/finance/payment-hold-expiry.ts");
    await mod.expirePaymentHoldForRegistration({
      tenantId: DP1_TENANT_DENALI,
      registrationId: bookingId,
    });
    const booking = await dp1GetBooking(bookingId);
    assert.equal(booking.status, "cancelled");
    assert.equal(booking.paymentStatus, "partial");
  });

  it("duplicate payment idempotency does not double-capture", async () => {
    const { bookingId } = await dp1CreateAndApprovePending();
    const finance = await resolveFinanceServiceForTenant(DP1_TENANT_DENALI);
    const idem = `dp1-dup-${randomUUID()}`;
    await finance.createManualPayment(
      opsAuth(),
      { registrationId: bookingId, amount: "5000000", currency: "IRR" },
      idem
    );
    await assert.rejects(
      () =>
        finance.createManualPayment(
          opsAuth(),
          { registrationId: bookingId, amount: "5000000", currency: "IRR" },
          idem
        ),
      /idempotency|duplicate/i
    );
  });
});
