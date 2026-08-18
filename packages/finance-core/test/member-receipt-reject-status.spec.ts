/**
 * Member receipt panel after operator reject — invoice remaining is money SoT.
 * Status is never paid/waived while remaining > 0.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import { createFinanceService } from "../src/application/finance.service.ts";
import type { FinanceActorContext } from "../src/ports/finance-actor-context.ts";
import type { FinanceObligationPort } from "../src/ports/finance-receipt-defaults.port.ts";
import type {
  BookingPaymentSyncStatus,
  IBookingPaymentPort,
} from "../src/ports/booking-payment.port.ts";
import {
  FakeAuthz,
  FakeCapability,
  FakeClock,
  FakeDisplay,
  FakeLogger,
  FakeMetrics,
  FakeProof,
  FakeReceiptDefaults,
  FakeSchedules,
  FakeStorage,
  createFakeLedgerPolicy,
} from "./isolation/fakes.ts";
import {
  InMemoryFinanceRepository,
  resetInMemoryFinanceRepositoryForTests,
} from "./isolation/in-memory-finance.repository.ts";

const TENANT = "00000000-0000-4000-8000-0000000000aa";
const OWNER = "00000000-0000-4000-8000-000000000021";

const OPERATOR: FinanceActorContext = {
  userId: OWNER,
  tenantId: TENANT,
  role: "admin",
  status: "ACTIVE",
  workspaceId: "ws-reject-probe",
};

const MEMBER: FinanceActorContext = {
  userId: OWNER,
  tenantId: TENANT,
  role: "member",
  status: "ACTIVE",
  workspaceId: "ws-reject-probe",
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

/** Production-like ratchet: unpaid → partial → paid, never down. */
function createBookingPort(initial: BookingPaymentSyncStatus = "unpaid"): IBookingPaymentPort & {
  paymentStatus: BookingPaymentSyncStatus;
} {
  const rank: Record<BookingPaymentSyncStatus, number> = { unpaid: 0, partial: 1, paid: 2 };
  const state: { paymentStatus: BookingPaymentSyncStatus } = { paymentStatus: initial };
  const raise = (target: BookingPaymentSyncStatus): BookingPaymentSyncStatus => {
    if (rank[target] > rank[state.paymentStatus]) {
      state.paymentStatus = target;
    }
    return state.paymentStatus;
  };
  return {
    get paymentStatus() {
      return state.paymentStatus;
    },
    async syncStatus(input) {
      return raise(input.paymentStatus);
    },
    async raisePaidInTx(_tx, input) {
      return raise(input.paymentStatus);
    },
    async memberOwnsRegistration(input) {
      return input.tenantId === TENANT && input.userId === OWNER;
    },
    async getPaymentStatus() {
      return state.paymentStatus;
    },
    async getRegistrationLifecycleStatus() {
      return "approved";
    },
  };
}

function createService(
  repo: InMemoryFinanceRepository,
  booking: IBookingPaymentPort,
  obligation: FinanceObligationPort = offlineObligation()
) {
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
    obligation
  );
}

describe("member receipt status after reject (remaining SoT)", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
  });

  it("A — sole pending receipt reject: member status is rejected, outstanding stays unpaid", async () => {
    const registrationId = randomUUID();
    const booking = createBookingPort("unpaid");
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);

    const payment = await finance.createManualPayment(
      OPERATOR,
      { registrationId, amount: "1000000", currency: "IRR" },
      `idem-a-pay-${registrationId}`
    );
    const receipt = await finance.submitReceipt(
      OPERATOR,
      { paymentId: payment.id, fileKey: `receipts/${payment.id}.jpg` },
      `idem-a-rcpt-${payment.id}`
    );
    await finance.reviewReceipt(OPERATOR, receipt.id, { decision: "reject", reviewNote: "blurry" });

    const member = await finance.getMemberReceiptStatusForRegistration(MEMBER, registrationId);
    const outstanding = await finance.listOutstandingBalances(OPERATOR, { limit: 50 });
    const hit = outstanding.items.find((row) => row.registrationId === registrationId);

    assert.equal(member.status, "rejected");
    assert.equal(member.previewKind, "image");
    assert.ok(BigInt((member.remainingMinor ?? "0").replace(/\D/g, "")) > 0n);
    assert.equal(booking.paymentStatus, "unpaid");
    assert.equal(payment.status, "Pending");
    assert.ok(hit, "remaining invoice still outstanding after reject");
    assert.ok(BigInt(hit.invoice.remainingMinor.replace(/\D/g, "")) > 0n);
    assert.equal(hit.bookingPaymentStatus, "unpaid");
  });

  it("B — leftover Paid payment + later rejected receipt: member status is rejected while remaining unpaid", async () => {
    const registrationId = randomUUID();
    const booking = createBookingPort("unpaid");
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);

    const paidPayment = await finance.createManualPayment(
      OPERATOR,
      { registrationId, amount: "1000000", currency: "IRR" },
      `idem-b-paid-${registrationId}`
    );
    await repo.markPaymentPaid(TENANT, paidPayment.id, "journal:probe-b");
    assert.equal(booking.paymentStatus, "unpaid", "booking ratchet not raised — leftover remaining");

    const pendingPayment = await finance.createManualPayment(
      OPERATOR,
      { registrationId, amount: "1500000", currency: "IRR" },
      `idem-b-pending-${registrationId}`
    );
    const receipt = await finance.submitReceipt(
      OPERATOR,
      { paymentId: pendingPayment.id, fileKey: `receipts/${pendingPayment.id}.jpg` },
      `idem-b-rcpt-${pendingPayment.id}`
    );
    await finance.reviewReceipt(OPERATOR, receipt.id, { decision: "reject", reviewNote: "wrong amount" });

    const member = await finance.getMemberReceiptStatusForRegistration(MEMBER, registrationId);
    const outstanding = await finance.listOutstandingBalances(OPERATOR, { limit: 50 });
    const hit = outstanding.items.find((row) => row.registrationId === registrationId);

    assert.equal(member.status, "rejected");
    assert.equal(booking.paymentStatus, "unpaid");
    assert.ok(hit);
    assert.ok(BigInt((member.remainingMinor ?? "0").replace(/\D/g, "")) > 0n);
    assert.equal(hit.bookingPaymentStatus, "unpaid");
  });

  it("C — booking ratchet paid + reject pending receipt: member status is rejected while remaining unpaid", async () => {
    const registrationId = randomUUID();
    const booking = createBookingPort("unpaid");
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);

    const payment = await finance.createManualPayment(
      OPERATOR,
      { registrationId, amount: "1000000", currency: "IRR" },
      `idem-c-pay-${registrationId}`
    );
    const receipt = await finance.submitReceipt(
      OPERATOR,
      { paymentId: payment.id, fileKey: `receipts/${payment.id}.jpg` },
      `idem-c-rcpt-${payment.id}`
    );
    await booking.syncStatus({
      tenantId: TENANT,
      registrationId,
      paymentStatus: "paid",
    });
    await finance.reviewReceipt(OPERATOR, receipt.id, { decision: "reject", reviewNote: "late reject" });

    const member = await finance.getMemberReceiptStatusForRegistration(MEMBER, registrationId);
    assert.equal(member.status, "rejected");
    assert.ok(BigInt((member.remainingMinor ?? "0").replace(/\D/g, "")) > 0n);
    assert.equal(booking.paymentStatus, "paid");
  });

  it("D — portal detail does not override receipt status from booking paymentStatus", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const page = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../apps/portal/app/me/registrations/[id]/page.tsx"
      ),
      "utf8"
    );
    assert.doesNotMatch(page, /paymentStatus === ["']paid["']/);
    assert.match(page, /initialPanel=\{receiptPanel\}/);
  });

  it("E — partial approve then reject second receipt: member rejected, outstanding remaining, booking partial", async () => {
    const registrationId = randomUUID();
    const booking = createBookingPort("unpaid");
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);

    const first = await finance.createManualPayment(
      OPERATOR,
      { registrationId, amount: "1000000", currency: "IRR" },
      `idem-e-pay1-${registrationId}`
    );
    const firstReceipt = await finance.submitReceipt(
      OPERATOR,
      { paymentId: first.id, fileKey: `receipts/${first.id}.jpg` },
      `idem-e-rcpt1-${first.id}`
    );
    await finance.reviewReceipt(OPERATOR, firstReceipt.id, { decision: "approve" });

    const second = await finance.createManualPayment(
      OPERATOR,
      { registrationId, amount: "1500000", currency: "IRR" },
      `idem-e-pay2-${registrationId}`
    );
    const secondReceipt = await finance.submitReceipt(
      OPERATOR,
      { paymentId: second.id, fileKey: `receipts/${second.id}.jpg` },
      `idem-e-rcpt2-${second.id}`
    );
    await finance.reviewReceipt(OPERATOR, secondReceipt.id, {
      decision: "reject",
      reviewNote: "second slip",
    });

    const member = await finance.getMemberReceiptStatusForRegistration(MEMBER, registrationId);
    const outstanding = await finance.listOutstandingBalances(OPERATOR, { limit: 50 });
    const hit = outstanding.items.find((row) => row.registrationId === registrationId);

    assert.equal(member.status, "rejected");
    assert.equal(booking.paymentStatus, "partial");
    assert.ok(BigInt((member.remainingMinor ?? "0").replace(/\D/g, "")) > 0n);
    assert.ok(hit);
    assert.ok(BigInt(hit.invoice.remainingMinor.replace(/\D/g, "")) > 0n);
    assert.equal(hit.bookingPaymentStatus, "partial");
  });
});
