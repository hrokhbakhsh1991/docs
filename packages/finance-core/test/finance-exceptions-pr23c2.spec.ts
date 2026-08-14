/**
 * PR23-C2 — read-only finance exception aggregation (domain + in-memory).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import { createFinanceService } from "../src/application/finance.service.ts";
import {
  FINANCE_EXCEPTION_TYPE,
  financeExceptionTypePriority,
} from "../src/domain/finance-exception.ts";
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
  workspaceId: "ws-exceptions-c2",
};
const AUTH_B: FinanceActorContext = {
  ...AUTH,
  tenantId: TENANT_B,
  workspaceId: "ws-exceptions-c2-b",
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

function throwingObligation(): FinanceObligationPort {
  return {
    async resolveRegistrationObligation() {
      throw new Error("INVOICE_UNAVAILABLE");
    },
    async resolveRegistrationPaymentCollection() {
      return "offline";
    },
    async setRegistrationObligationOverride() {
      return false;
    },
  };
}

function createService(
  repo: InMemoryFinanceRepository,
  booking = createFakeBookingPort(),
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

async function pendingWithRejectedReceipt(
  finance: ReturnType<typeof createService>,
  repo: InMemoryFinanceRepository,
  registrationId: string
) {
  const payment = await finance.createManualPayment(
    AUTH,
    { registrationId, amount: "1000000", currency: "IRR" },
    `idem-pay-${registrationId}`
  );
  const receipt = await finance.submitReceipt(
    AUTH,
    {
      paymentId: payment.id,
      fileKey: `receipts/${payment.id}.jpg`,
      note: "wire",
    },
    `idem-rcpt-${payment.id}`
  );
  await finance.reviewReceipt(AUTH, receipt.id, {
    decision: "reject",
    reviewNote: "blurry",
  });
  return { payment, receipt };
}

describe("finance-exceptions PR23-C2", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
  });

  it("E1 — pending + rejected receipt appears", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);
    const registrationId = randomUUID();
    const { payment } = await pendingWithRejectedReceipt(finance, repo, registrationId);

    const page = await finance.listOperatorFinanceExceptions(AUTH, { limit: 50 });
    const hit = page.items.find((item) => item.payment.id === payment.id);
    assert.ok(hit);
    assert.equal(hit.type, FINANCE_EXCEPTION_TYPE.REJECTED_RECEIPT_PENDING_PAYMENT);
    assert.equal(hit.payment.status, "Pending");
    assert.equal(hit.reason, "blurry");
    assert.match(hit.href.payments, /tab=payments/);
    assert.match(hit.href.receipts ?? "", /tab=receipts/);
  });

  it("E1 — pending + approved receipt absent", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);
    const registrationId = randomUUID();
    const payment = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-approved-latest"
    );
    const receipt = await finance.submitReceipt(
      AUTH,
      { paymentId: payment.id, fileKey: `receipts/${payment.id}.jpg` },
      "idem-approved-rcpt"
    );
    // Keep payment Pending; only latest receipt status matters for E1.
    await repo.updateReceiptReview(TENANT, receipt.id, {
      status: "Approved",
      reviewedByUserId: AUTH.userId,
      reviewNote: "ok",
    });

    const page = await finance.listOperatorFinanceExceptions(AUTH, { limit: 50 });
    assert.equal(
      page.items.some((item) => item.payment.id === payment.id),
      false
    );
  });

  it("E1 — rejected receipt on another payment does not attach", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);
    const registrationId = randomUUID();

    // Seed payment B with rejected receipt first, then cancel it, then create clean pending A.
    const paymentB = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "400000", currency: "IRR" },
      "idem-b-seed"
    );
    const receiptB = await finance.submitReceipt(
      AUTH,
      { paymentId: paymentB.id, fileKey: `receipts/${paymentB.id}.jpg` },
      "idem-b-rcpt"
    );
    await finance.reviewReceipt(AUTH, receiptB.id, {
      decision: "reject",
      reviewNote: "bad",
    });
    await finance.cancelPendingManualPayment(AUTH, {
      paymentId: paymentB.id,
      reasonCode: "abandoned",
    });

    const paymentA = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "600000", currency: "IRR" },
      "idem-a-clean"
    );

    const page = await finance.listOperatorFinanceExceptions(AUTH, { limit: 50 });
    assert.equal(
      page.items.some(
        (item) =>
          item.type === FINANCE_EXCEPTION_TYPE.REJECTED_RECEIPT_PENDING_PAYMENT &&
          item.payment.id === paymentA.id
      ),
      false,
      "clean pending must not inherit rejected receipt from another payment"
    );
  });

  it("E2 — cancelled + remaining > 0 appears", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking, offlineObligation("2500000"));
    const registrationId = randomUUID();
    const payment = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-e2-pos"
    );
    await finance.cancelPendingManualPayment(AUTH, {
      paymentId: payment.id,
      reasonCode: "abandoned",
    });

    const page = await finance.listOperatorFinanceExceptions(AUTH, { limit: 50 });
    const hit = page.items.find((item) => item.payment.id === payment.id);
    assert.ok(hit);
    assert.equal(hit.type, FINANCE_EXCEPTION_TYPE.CANCELLED_PAYMENT_WITH_BALANCE);
    assert.equal(hit.payment.status, "Cancelled");
    assert.ok(hit.balanceDueMinor !== null && BigInt(hit.balanceDueMinor.replace(/\D/g, "")) > 0n);
  });

  it("E2 — cancelled + zero balance absent", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking, offlineObligation("1000000"));
    const registrationId = randomUUID();

    // Cover invoice via Paid payment so remaining is zero.
    const paid = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-e2-paid-cover"
    );
    const paidReceipt = await finance.submitReceipt(
      AUTH,
      { paymentId: paid.id, fileKey: `receipts/${paid.id}.jpg` },
      "idem-e2-paid-rcpt"
    );
    await finance.reviewReceipt(AUTH, paidReceipt.id, { decision: "approve" });

    // Seed a Cancelled payment after settle (repo bypasses debt gate).
    const cancelled = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId,
      amount: "500000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    await repo.cancelPendingManualPaymentAtomic({
      tenantId: TENANT,
      paymentId: cancelled.id,
      actorUserId: AUTH.userId,
      reasonCode: "abandoned",
      reasonNote: null,
      occurredAtIso: FakeClock.nowIso(),
    });

    const page = await finance.listOperatorFinanceExceptions(AUTH, { limit: 50 });
    assert.equal(
      page.items.some((item) => item.payment.id === cancelled.id),
      false
    );
  });

  it("E2 — cancelled without invoice data absent", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking, offlineObligation("2500000"));
    const registrationId = randomUUID();
    const payment = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-e2-no-inv"
    );
    await finance.cancelPendingManualPayment(AUTH, {
      paymentId: payment.id,
      reasonCode: "abandoned",
    });

    // Invoice compile fails only on the read path (balance SoT unavailable → omit).
    const financeBrokenInvoice = createService(repo, booking, throwingObligation());
    const page = await financeBrokenInvoice.listOperatorFinanceExceptions(AUTH, {
      limit: 50,
    });
    assert.equal(
      page.items.some((item) => item.payment.id === payment.id),
      false
    );
  });

  it("tenant isolation — exceptions do not cross tenants", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);
    const regA = randomUUID();
    const regB = randomUUID();
    const { payment: payA } = await pendingWithRejectedReceipt(finance, repo, regA);

    const payB = await finance.createManualPayment(
      AUTH_B,
      { registrationId: regB, amount: "1000000", currency: "IRR" },
      "idem-b-tenant"
    );
    const rcptB = await finance.submitReceipt(
      AUTH_B,
      { paymentId: payB.id, fileKey: `receipts/${payB.id}.jpg` },
      "idem-b-rcpt-tenant"
    );
    await finance.reviewReceipt(AUTH_B, rcptB.id, {
      decision: "reject",
      reviewNote: "other tenant",
    });

    const pageA = await finance.listOperatorFinanceExceptions(AUTH, { limit: 50 });
    const pageB = await finance.listOperatorFinanceExceptions(AUTH_B, { limit: 50 });
    assert.equal(
      pageA.items.every((item) => item.registrationId === regA || item.payment.id === payA.id),
      true
    );
    assert.equal(
      pageA.items.some((item) => item.payment.id === payB.id),
      false
    );
    assert.equal(
      pageB.items.some((item) => item.payment.id === payB.id),
      true
    );
    assert.equal(
      pageB.items.some((item) => item.payment.id === payA.id),
      false
    );
  });

  it("cursor continuation + stable ordering (E1 before E2)", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking, offlineObligation("2500000"));

    const e1Early = randomUUID();
    const e1Late = randomUUID();
    const e2Reg = randomUUID();

    const { payment: p1 } = await pendingWithRejectedReceipt(finance, repo, e1Early);
    await new Promise((r) => setTimeout(r, 5));
    const { payment: p2 } = await pendingWithRejectedReceipt(finance, repo, e1Late);

    const cancelled = await finance.createManualPayment(
      AUTH,
      { registrationId: e2Reg, amount: "900000", currency: "IRR" },
      "idem-e2-order"
    );
    await finance.cancelPendingManualPayment(AUTH, {
      paymentId: cancelled.id,
      reasonCode: "abandoned",
    });

    const first = await finance.listOperatorFinanceExceptions(AUTH, { limit: 1 });
    assert.equal(first.items.length, 1);
    assert.equal(first.hasMore, true);
    assert.ok(first.nextCursor);
    assert.equal(
      first.items[0]?.type,
      FINANCE_EXCEPTION_TYPE.REJECTED_RECEIPT_PENDING_PAYMENT
    );

    const rest = await finance.listOperatorFinanceExceptions(AUTH, {
      limit: 50,
      cursor: first.nextCursor,
    });
    const all = [...first.items, ...rest.items];
    assert.ok(all.some((item) => item.payment.id === p1.id));
    assert.ok(all.some((item) => item.payment.id === p2.id));
    assert.ok(all.some((item) => item.payment.id === cancelled.id));

    for (let i = 1; i < all.length; i += 1) {
      const prev = all[i - 1]!;
      const cur = all[i]!;
      const prevPri = financeExceptionTypePriority(prev.type);
      const curPri = financeExceptionTypePriority(cur.type);
      assert.ok(prevPri <= curPri);
      if (prevPri === curPri) {
        const prevT = Date.parse(prev.occurredAt);
        const curT = Date.parse(cur.occurredAt);
        assert.ok(prevT < curT || (prevT === curT && prev.id <= cur.id));
      }
    }
  });

  it("read path does not mutate payments / receipts / ledger", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);
    const registrationId = randomUUID();
    const { payment, receipt } = await pendingWithRejectedReceipt(
      finance,
      repo,
      registrationId
    );

    const beforePayment = await repo.findPaymentById(TENANT, payment.id);
    const beforeReceipt = await repo.findReceiptById(TENANT, receipt.id);
    const beforeEvents = await repo.listLedgerEvents(TENANT, 100);

    await finance.listOperatorFinanceExceptions(AUTH, { limit: 50 });
    await finance.listOperatorFinanceExceptions(AUTH, { limit: 50 });

    const afterPayment = await repo.findPaymentById(TENANT, payment.id);
    const afterReceipt = await repo.findReceiptById(TENANT, receipt.id);
    const afterEvents = await repo.listLedgerEvents(TENANT, 100);

    assert.equal(afterPayment?.status, beforePayment?.status);
    assert.equal(afterReceipt?.status, beforeReceipt?.status);
    assert.equal(afterEvents.length, beforeEvents.length);
  });
});
