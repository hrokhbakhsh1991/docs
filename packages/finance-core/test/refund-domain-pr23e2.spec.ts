/**
 * PR23-E2 — Refund domain + invoice integration (R-01…R-12).
 * @see docs/phase-20/p7/appendices/FINANCE_REFUND_DOMAIN_IMPLEMENTATION_PR23_E2.md
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import { createFinanceService } from "../src/application/finance.service.ts";
import { compileRegistrationInvoice } from "../src/domain/compile-invoice-balances.ts";
import type { FinanceArObservationPort } from "../src/ports/finance-ar-observation.port.ts";
import type { FinanceActorContext } from "../src/ports/finance-actor-context.ts";
import type { FinanceObligationPort } from "../src/ports/finance-receipt-defaults.port.ts";
import {
  FakeCapability,
  FakeAuthz,
  FakeClock,
  FakeDisplay,
  FakeLogger,
  FakeMetrics,
  FakeProof,
  FakeReceiptDefaults,
  FakeSchedules,
  FakeStorage,
  createFakeBookingPort,
  createFakeLedgerPolicy,
} from "./isolation/fakes.ts";
import {
  InMemoryFinanceRepository,
  resetInMemoryFinanceRepositoryForTests,
} from "./isolation/in-memory-finance.repository.ts";

const TENANT = "00000000-0000-4000-8000-000000000099";
const AUTH: FinanceActorContext = {
  userId: "00000000-0000-4000-8000-000000000001",
  tenantId: TENANT,
  role: "admin",
  status: "ACTIVE",
  workspaceId: "ws-refund-e2",
};

function offlineObligation(amountMinor = "100000000"): FinanceObligationPort {
  return {
    async resolveRegistrationObligation() {
      return { currency: "IRR", obligationMinor: amountMinor, source: "tour_canonical" };
    },
    async resolveRegistrationPaymentCollection() {
      return "offline";
    },
    async setRegistrationObligationOverride() {
      return false;
    },
  };
}

type ArEpisode = {
  arOpenedAt: string | null;
  arOpenedAtSource: "observed_transition_v1" | null;
};

function createRecordingArObserver(): FinanceArObservationPort & {
  readonly episodes: Map<string, ArEpisode>;
  readonly calls: Array<{ registrationId: string; balanceDueMinor: string; nowIso: string }>;
} {
  const episodes = new Map<string, ArEpisode>();
  const calls: Array<{ registrationId: string; balanceDueMinor: string; nowIso: string }> = [];
  return {
    episodes,
    calls,
    async observeRegistrationArState(input) {
      calls.push({
        registrationId: input.registrationId,
        balanceDueMinor: input.balanceDueMinor,
        nowIso: input.nowIso,
      });
      const remaining = BigInt(input.balanceDueMinor.replace(/\D/g, "") || "0");
      const key = `${input.tenantId}:${input.registrationId}`;
      const current = episodes.get(key) ?? { arOpenedAt: null, arOpenedAtSource: null };
      if (remaining > BigInt(0) && current.arOpenedAt === null) {
        episodes.set(key, {
          arOpenedAt: input.nowIso,
          arOpenedAtSource: "observed_transition_v1",
        });
        return;
      }
      if (remaining <= BigInt(0) && current.arOpenedAt !== null) {
        episodes.set(key, { arOpenedAt: null, arOpenedAtSource: null });
      }
    },
  };
}

function createService(
  repo: InMemoryFinanceRepository,
  opts?: {
    readonly obligationMinor?: string;
    readonly ar?: FinanceArObservationPort;
    readonly booking?: ReturnType<typeof createFakeBookingPort>;
  }
) {
  const booking = opts?.booking ?? createFakeBookingPort();
  return createFinanceService(
    createFakeLedgerPolicy(),
    repo,
    booking,
    FakeReceiptDefaults,
    FakeDisplay,
    FakeMetrics,
    FakeStorage,
    FakeProof,
    FakeCapability,
    FakeAuthz,
    FakeSchedules,
    FakeLogger,
    FakeClock,
    offlineObligation(opts?.obligationMinor ?? "100000000"),
    "0",
    opts?.ar
  );
}

async function createPaidPayment(
  repo: InMemoryFinanceRepository,
  registrationId: string,
  amount: string
) {
  return repo.createManualPayment({
    tenantId: TENANT,
    registrationId,
    amount,
    currency: "IRR",
    method: "Manual",
    provider: "manual",
    status: "Paid",
  });
}

describe("PR23-E2 refund domain", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
  });

  it("R-01 Paid payment refund request → Requested", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, { booking });
    const registrationId = randomUUID();
    const payment = await createPaidPayment(repo, registrationId, "100000000");

    const refund = await finance.requestRefund(AUTH, {
      registrationId,
      sourceKind: "payment",
      paymentId: payment.id,
      amountMinor: "30000000",
      reasonCode: "overpayment",
    });

    assert.equal(refund.status, "Requested");
    assert.equal(refund.paymentId, payment.id);
    assert.equal(refund.amountMinor, "30000000");
    assert.equal(refund.replay, false);
  });

  it("R-02 Pending payment rejected", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, { booking });
    const registrationId = randomUUID();
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId,
      amount: "100000000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });

    await assert.rejects(
      () =>
        finance.requestRefund(AUTH, {
          registrationId,
          sourceKind: "payment",
          paymentId: payment.id,
          amountMinor: "10000000",
          reasonCode: "ops_correction",
        }),
      /REFUND_PAYMENT_NOT_PAID/
    );
  });

  it("R-03 Cancelled payment rejected", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, { booking });
    const registrationId = randomUUID();
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId,
      amount: "100000000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Cancelled",
    });

    await assert.rejects(
      () =>
        finance.requestRefund(AUTH, {
          registrationId,
          sourceKind: "payment",
          paymentId: payment.id,
          amountMinor: "10000000",
          reasonCode: "ops_correction",
        }),
      /REFUND_PAYMENT_NOT_PAID/
    );
  });

  it("R-04 Over-cap rejected", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, { booking });
    const registrationId = randomUUID();
    const payment = await createPaidPayment(repo, registrationId, "100000000");

    await assert.rejects(
      () =>
        finance.requestRefund(AUTH, {
          registrationId,
          sourceKind: "payment",
          paymentId: payment.id,
          amountMinor: "100000001",
          reasonCode: "overpayment",
        }),
      /REFUND_OVER_CAP/
    );
  });

  it("R-05 Partial refund Completes → invoice nets", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, { booking, obligationMinor: "100000000" });
    const registrationId = randomUUID();
    const payment = await createPaidPayment(repo, registrationId, "100000000");
    const refund = await finance.requestRefund(AUTH, {
      registrationId,
      sourceKind: "payment",
      paymentId: payment.id,
      amountMinor: "30000000",
      reasonCode: "overpayment",
    });
    await finance.completeRefund(AUTH, refund.id);

    const invoice = await finance.getRegistrationInvoice(AUTH, registrationId);
    assert.equal(invoice.invoiceTotalMinor, "100000000");
    assert.equal(invoice.refundedMinor, "30000000");
    assert.equal(invoice.paidAmountMinor, "70000000");
    assert.equal(invoice.balanceDueMinor, "30000000");
  });

  it("R-06 Multiple refunds within cap", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, { booking, obligationMinor: "100000000" });
    const registrationId = randomUUID();
    const payment = await createPaidPayment(repo, registrationId, "100000000");

    const r1 = await finance.requestRefund(AUTH, {
      registrationId,
      sourceKind: "payment",
      paymentId: payment.id,
      amountMinor: "40000000",
      reasonCode: "overpayment",
    });
    await finance.completeRefund(AUTH, r1.id);

    const r2 = await finance.requestRefund(AUTH, {
      registrationId,
      sourceKind: "payment",
      paymentId: payment.id,
      amountMinor: "60000000",
      reasonCode: "member_withdrawal",
    });
    await finance.completeRefund(AUTH, r2.id);

    const invoice = await finance.getRegistrationInvoice(AUTH, registrationId);
    assert.equal(invoice.refundedMinor, "100000000");
    assert.equal(invoice.paidAmountMinor, "0");
    assert.equal(invoice.balanceDueMinor, "100000000");

    await assert.rejects(
      () =>
        finance.requestRefund(AUTH, {
          registrationId,
          sourceKind: "payment",
          paymentId: payment.id,
          amountMinor: "1",
          reasonCode: "ops_correction",
        }),
      /REFUND_OVER_CAP/
    );
  });

  it("R-07 Full refund Completes → paid net 0", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, { booking, obligationMinor: "100000000" });
    const registrationId = randomUUID();
    const payment = await createPaidPayment(repo, registrationId, "100000000");
    const refund = await finance.requestRefund(AUTH, {
      registrationId,
      sourceKind: "payment",
      paymentId: payment.id,
      amountMinor: "100000000",
      reasonCode: "member_withdrawal",
    });
    await finance.completeRefund(AUTH, refund.id);
    const invoice = await finance.getRegistrationInvoice(AUTH, registrationId);
    assert.equal(invoice.refundedMinor, "100000000");
    assert.equal(invoice.paidAmountMinor, "0");
    assert.equal(invoice.balanceDueMinor, "100000000");
  });

  it("R-08 Prepayment-only refund", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, { booking, obligationMinor: "100000000" });
    const registrationId = randomUUID();
    await finance.recordPrepayment(
      AUTH,
      {
        registrationId,
        amountMinor: "100000000",
        currency: "IRR",
        method: "Manual",
      },
      `idem-prepay-refund-${registrationId}`
    );

    const refund = await finance.requestRefund(AUTH, {
      registrationId,
      sourceKind: "prepayment",
      amountMinor: "40000000",
      reasonCode: "overpayment",
    });
    assert.equal(refund.paymentId, null);
    assert.equal(refund.sourceKind, "prepayment");
    await finance.completeRefund(AUTH, refund.id);
    const invoice = await finance.getRegistrationInvoice(AUTH, registrationId);
    assert.equal(invoice.refundedMinor, "40000000");
    assert.equal(invoice.paidAmountMinor, "60000000");
  });

  it("R-09 Requested refund does not change invoice", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, { booking, obligationMinor: "100000000" });
    const registrationId = randomUUID();
    const payment = await createPaidPayment(repo, registrationId, "100000000");
    const before = await finance.getRegistrationInvoice(AUTH, registrationId);
    await finance.requestRefund(AUTH, {
      registrationId,
      sourceKind: "payment",
      paymentId: payment.id,
      amountMinor: "30000000",
      reasonCode: "overpayment",
    });
    const after = await finance.getRegistrationInvoice(AUTH, registrationId);
    assert.deepEqual(
      {
        total: after.invoiceTotalMinor,
        paid: after.paidAmountMinor,
        remaining: after.balanceDueMinor,
        refunded: after.refundedMinor,
      },
      {
        total: before.invoiceTotalMinor,
        paid: before.paidAmountMinor,
        remaining: before.balanceDueMinor,
        refunded: before.refundedMinor,
      }
    );
  });

  it("R-10 Completed refund changes invoice", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, { booking, obligationMinor: "100000000" });
    const registrationId = randomUUID();
    const payment = await createPaidPayment(repo, registrationId, "100000000");
    const refund = await finance.requestRefund(AUTH, {
      registrationId,
      sourceKind: "payment",
      paymentId: payment.id,
      amountMinor: "25000000",
      reasonCode: "ops_correction",
    });
    const before = await finance.getRegistrationInvoice(AUTH, registrationId);
    await finance.completeRefund(AUTH, refund.id);
    const after = await finance.getRegistrationInvoice(AUTH, registrationId);
    assert.equal(before.refundedMinor, "0");
    assert.equal(after.refundedMinor, "25000000");
    assert.notEqual(after.paidAmountMinor, before.paidAmountMinor);
  });

  it("R-11 Complete is idempotent", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, { booking, obligationMinor: "100000000" });
    const registrationId = randomUUID();
    const payment = await createPaidPayment(repo, registrationId, "100000000");
    const refund = await finance.requestRefund(AUTH, {
      registrationId,
      sourceKind: "payment",
      paymentId: payment.id,
      amountMinor: "20000000",
      reasonCode: "overpayment",
    });
    const first = await finance.completeRefund(AUTH, refund.id);
    const second = await finance.completeRefund(AUTH, refund.id);
    assert.equal(first.replay, false);
    assert.equal(second.replay, true);
    const invoice = await finance.getRegistrationInvoice(AUTH, registrationId);
    assert.equal(invoice.refundedMinor, "20000000");
  });

  it("R-12 Completed refund reopens AR when remaining 0 → >0", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const ar = createRecordingArObserver();
    const finance = createService(repo, {
      booking,
      obligationMinor: "100000000",
      ar,
    });
    const registrationId = randomUUID();
    const payment = await createPaidPayment(repo, registrationId, "100000000");

    const beforeInvoice = await finance.getRegistrationInvoice(AUTH, registrationId);
    assert.equal(beforeInvoice.balanceDueMinor, "0");
    ar.episodes.set(`${TENANT}:${registrationId}`, {
      arOpenedAt: null,
      arOpenedAtSource: null,
    });

    const refund = await finance.requestRefund(AUTH, {
      registrationId,
      sourceKind: "payment",
      paymentId: payment.id,
      amountMinor: "30000000",
      reasonCode: "overpayment",
    });
    await finance.completeRefund(AUTH, refund.id);

    const afterInvoice = await finance.getRegistrationInvoice(AUTH, registrationId);
    assert.ok(BigInt(afterInvoice.balanceDueMinor) > BigInt(0));
    assert.equal(ar.calls.length, 1);
    assert.equal(ar.calls[0]?.balanceDueMinor, afterInvoice.balanceDueMinor);
    const episode = ar.episodes.get(`${TENANT}:${registrationId}`);
    assert.ok(episode?.arOpenedAt);
    assert.equal(episode?.arOpenedAtSource, "observed_transition_v1");
  });

  it("compile unit — total stable with refunds; Requested ignored", () => {
    const registrationId = randomUUID();
    const withCompleted = compileRegistrationInvoice({
      registrationId,
      currency: "IRR",
      prepaymentMinor: "0",
      paidPaymentsMinor: "100000000",
      paymentAmountsMinor: ["100000000"],
      scheduleAmountsMinor: [],
      obligationMinor: "100000000",
      refundedCompletedMinor: "30000000",
    });
    assert.equal(withCompleted.invoiceTotalMinor, "100000000");
    assert.equal(withCompleted.refundedMinor, "30000000");
    assert.equal(withCompleted.paidAmountMinor, "70000000");

    const withoutRefundInput = compileRegistrationInvoice({
      registrationId,
      currency: "IRR",
      prepaymentMinor: "0",
      paidPaymentsMinor: "100000000",
      paymentAmountsMinor: ["100000000"],
      scheduleAmountsMinor: [],
      obligationMinor: "100000000",
    });
    assert.equal(withoutRefundInput.refundedMinor, "0");
    assert.equal(withoutRefundInput.paidAmountMinor, "100000000");
  });
});
