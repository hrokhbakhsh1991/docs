/**
 * PR23-A.2 — cancelPendingManualPayment domain contract.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import { createFinanceService } from "../src/application/finance.service.ts";
import { assertManualPaymentDebtAllowed } from "../src/domain/manual-payment-debt-policy.ts";
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
const TENANT_B = "00000000-0000-4000-8000-000000000098";
const AUTH: FinanceActorContext = {
  userId: "00000000-0000-4000-8000-000000000001",
  tenantId: TENANT,
  role: "admin",
  status: "ACTIVE",
  workspaceId: "ws-cancel",
};

function offlineObligation(amountMinor = "2500000"): FinanceObligationPort {
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

function createService(repo: InMemoryFinanceRepository, booking = createFakeBookingPort()) {
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
    offlineObligation()
  );
}

describe("PR23-A.2 cancelPendingManualPayment", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
  });

  it("happy path — Pending Manual → Cancelled + audit emitted", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);
    const registrationId = randomUUID();
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId,
      amount: "2500000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });

    const result = await finance.cancelPendingManualPayment(AUTH, {
      paymentId: payment.id,
      reasonCode: "abandoned",
    });

    assert.equal(result.status, "Cancelled");
    assert.equal(result.replay, false);
    assert.equal(result.audit.fromStatus, "Pending");
    assert.equal(result.audit.toStatus, "Cancelled");
    assert.equal(result.audit.method, "Manual");
    assert.equal(result.audit.reasonCode, "abandoned");
    assert.equal(result.audit.openReceiptCount, 0);
    assert.equal(result.audit.registrationId, registrationId);
    assert.equal(result.domainEventId, `payment-cancelled:${payment.id}`);

    const stored = await repo.findPaymentById(TENANT, payment.id);
    assert.equal(stored?.status, "Cancelled");

    const events = await repo.listLedgerEvents(TENANT, 20);
    const cancelEvent = events.find((e) => e.eventType === "finance.payment.cancelled");
    assert.ok(cancelEvent);
    assert.equal(cancelEvent?.domainEventId, `payment-cancelled:${payment.id}`);

    const summary = await repo.getSummary(TENANT);
    assert.equal(summary.cancelledPayments, 1);
    assert.equal(summary.failedPayments, 0);
    assert.equal(summary.pendingManualPayments, 0);
  });

  it("debt gate — Cancelled releases Pending lock for new manual payment", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);
    const registrationId = randomUUID();

    const first = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-cancel-debt-1"
    );
    await assert.rejects(
      () =>
        finance.createManualPayment(
          AUTH,
          { registrationId, amount: "500000", currency: "IRR" },
          "idem-cancel-debt-2"
        ),
      /pending payment already exists/
    );

    await finance.cancelPendingManualPayment(AUTH, {
      paymentId: first.id,
      reasonCode: "wrong_amount",
      reasonNote: "operator corrected amount",
    });

    const statuses = await repo.findPaymentStatusesByRegistration(TENANT, registrationId);
    assert.deepEqual(statuses, ["Cancelled"]);
    assert.doesNotThrow(() =>
      assertManualPaymentDebtAllowed({
        statuses,
        balanceDueMinor: "2500000",
      })
    );

    const second = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "500000", currency: "IRR" },
      "idem-cancel-debt-2"
    );
    assert.equal(second.status, "Pending");
    assert.notEqual(second.id, first.id);
  });

  it("forbidden — Paid → Cancelled", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId: randomUUID(),
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    await repo.markPaymentPaid(TENANT, payment.id, randomUUID());

    await assert.rejects(
      () =>
        finance.cancelPendingManualPayment(AUTH, {
          paymentId: payment.id,
          reasonCode: "abandoned",
        }),
      /PAYMENT_NOT_CANCELLABLE/
    );
  });

  it("forbidden — Failed → Cancelled", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);
    const failed = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId: randomUUID(),
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Failed",
    });

    await assert.rejects(
      () =>
        finance.cancelPendingManualPayment(AUTH, {
          paymentId: failed.id,
          reasonCode: "abandoned",
        }),
      /PAYMENT_NOT_CANCELLABLE/
    );
  });

  it("idempotent — Cancelled → Cancelled replays", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId: randomUUID(),
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });

    const first = await finance.cancelPendingManualPayment(
      AUTH,
      { paymentId: payment.id, reasonCode: "superseded" },
      "idem-cancel-replay"
    );
    const second = await finance.cancelPendingManualPayment(
      AUTH,
      { paymentId: payment.id, reasonCode: "abandoned" },
      "idem-cancel-replay-2"
    );

    assert.equal(first.replay, false);
    assert.equal(second.replay, true);
    assert.equal(second.status, "Cancelled");
    assert.equal(second.domainEventId, first.domainEventId);

    const events = (await repo.listLedgerEvents(TENANT, 50)).filter(
      (e) => e.eventType === "finance.payment.cancelled"
    );
    assert.equal(events.length, 1);
  });

  it("receipt guard — Pending receipt blocks cancel", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId: randomUUID(),
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    await repo.createReceipt({
      tenantId: TENANT,
      paymentId: payment.id,
      fileKey: `receipts/${payment.id}/proof.jpg`,
    });

    await assert.rejects(
      () =>
        finance.cancelPendingManualPayment(AUTH, {
          paymentId: payment.id,
          reasonCode: "abandoned",
        }),
      /PAYMENT_HAS_PENDING_RECEIPT/
    );

    const stored = await repo.findPaymentById(TENANT, payment.id);
    assert.equal(stored?.status, "Pending");
  });

  it("tenant isolation — cross-tenant cancel fails", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);
    const payment = await repo.createManualPayment({
      tenantId: TENANT_B,
      registrationId: randomUUID(),
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });

    await assert.rejects(
      () =>
        finance.cancelPendingManualPayment(AUTH, {
          paymentId: payment.id,
          reasonCode: "abandoned",
        }),
      /PAYMENT_NOT_IN_SCOPE/
    );
  });

  it("reason other requires note", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId: randomUUID(),
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });

    await assert.rejects(
      () =>
        finance.cancelPendingManualPayment(AUTH, {
          paymentId: payment.id,
          reasonCode: "other",
        }),
      /PAYMENT_CANCEL_REASON_INVALID/
    );
  });

  it("does not mutate booking payment status on cancel", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);
    const registrationId = randomUUID();
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId,
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });

    await finance.cancelPendingManualPayment(AUTH, {
      paymentId: payment.id,
      reasonCode: "abandoned",
    });

    assert.equal(booking.paidRegistrations.has(registrationId), false);
    const status = await booking.getPaymentStatus({
      tenantId: TENANT,
      registrationId,
    });
    assert.equal(status, "unpaid");
  });
});
